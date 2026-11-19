import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { nowUtc } from '@kibo/shared';
import type { Env } from '../../config/env.js';
import { coll } from '../../utils/collections.js';
import { encryptString, decryptString } from '../../utils/crypto-box.js';
import { parseIcs, type ParsedIcs, type ParsedIcsEvent } from '../calendars-import/ical-parser.js';
import { importIcsAsNewCalendar, syncIcsUrlCalendar } from '../calendars-import/import.service.js';

interface GoogleEvent {
  id?: string;
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  recurrence?: string[];
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
  nextPageToken?: string;
  summary?: string;
}

interface IntegrationDoc {
  _id: string;
  userId: string;
  workspaceId: string;
  provider: 'google';
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: number;
  scope: string;
  email: string | null;
  calendarId: string | null;
  linkedAt: string;
  updatedAt: string;
  /** Set when Google rejected our refresh token (invalid_grant); user must re-link. */
  needsReauth?: boolean;
}

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function toParsedIcs(items: GoogleEvent[], calSummary?: string): ParsedIcs {
  const events: ParsedIcsEvent[] = [];
  for (const g of items) {
    const uid = g.iCalUID ?? g.id;
    if (!uid || !g.start || !g.end) continue;
    const isAllDay = Boolean(g.start.date && !g.start.dateTime);
    const startStr = g.start.dateTime ?? (g.start.date ? `${g.start.date}T00:00:00Z` : null);
    const endStr = g.end.dateTime ?? (g.end.date ? `${g.end.date}T00:00:00Z` : null);
    if (!startStr || !endStr) continue;
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

    const rruleLine = g.recurrence?.find((l) => l.startsWith('RRULE:'));
    const rrule = rruleLine ? rruleLine.slice('RRULE:'.length) : null;

    events.push({
      externalUid: uid,
      title: (g.summary ?? '(sin título)').slice(0, 500),
      description: g.description ? g.description.slice(0, 20000) : null,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: isAllDay,
      location: g.location ? g.location.slice(0, 500) : null,
      rrule,
    });
  }
  return { name: calSummary ?? null, events };
}

async function fetchGoogleEvents(accessToken: string): Promise<GoogleEventsResponse> {
  const all: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let summary: string | undefined;
  const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: '2500',
      singleEvents: 'false',
      showDeleted: 'false',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`google_events_${res.status}`);
    const data = (await res.json()) as GoogleEventsResponse;
    summary = summary ?? data.summary;
    if (data.items) all.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { items: all, summary };
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

/**
 * True when the failure means the stored grant is dead and only a new OAuth
 * consent can fix it (expired/revoked refresh token, or none stored at all).
 */
function isReauthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message === 'no_refresh_token' || err.message === 'refresh_failed') return true;
  if (err.message === 'invalid_grant') return true;
  const data = (err as { response?: { data?: { error?: string } } }).response?.data;
  return data?.error === 'invalid_grant';
}

async function refreshAccessToken(
  client: OAuth2Client,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('refresh_failed');
  const expiresAt = credentials.expiry_date ?? Date.now() + 55 * 60_000;
  return { accessToken: credentials.access_token, expiresAt };
}

async function getFreshAccessToken(
  integration: IntegrationDoc,
  env: Env,
  key: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const now = Date.now();
  if (integration.expiresAt - 30_000 > now) {
    return {
      accessToken: decryptString(integration.accessTokenEnc, key),
      expiresAt: integration.expiresAt,
    };
  }
  if (!integration.refreshTokenEnc) throw new Error('no_refresh_token');
  const client = new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
  const refreshed = await refreshAccessToken(
    client,
    decryptString(integration.refreshTokenEnc, key),
  );
  return refreshed;
}

export async function googleIntegrationRoutes(app: FastifyInstance, env: Env): Promise<void> {
  const configured =
    Boolean(env.GOOGLE_CLIENT_ID) &&
    Boolean(env.GOOGLE_CLIENT_SECRET) &&
    Boolean(env.GOOGLE_OAUTH_REDIRECT_URI) &&
    Boolean(env.INTEGRATIONS_KEY);

  const key = env.INTEGRATIONS_KEY ?? '';

  const integrations = () => coll<IntegrationDoc>(app.db, 'user_integrations');

  app.get(
    '/integrations/google',
    { preHandler: app.requireAuth },
    async (req) => {
      const doc = await integrations().findOne({
        userId: req.auth!.sub,
        workspaceId: req.auth!.workspaceId,
        provider: 'google',
      });
      return {
        configured,
        connected: Boolean(doc),
        email: doc?.email ?? null,
        linkedAt: doc?.linkedAt ?? null,
        calendarId: doc?.calendarId ?? null,
        needsReauth: Boolean(doc?.needsReauth),
      };
    },
  );

  const StartBody = z.object({
    name: z.string().min(1).max(200).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  });

  app.post(
    '/integrations/google/start',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!configured) return reply.code(501).send({ error: 'not_configured' });
      if (!(await app.checkFlag('googleCalendarEnabled', reply))) return;
      if (!(await app.ensureNotMaintenance(req, reply))) return;
      const body = StartBody.safeParse(req.body ?? {});
      if (!body.success)
        return reply.code(400).send({ error: 'bad_input', issues: body.error.flatten() });

      const client = new OAuth2Client({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
      });
      const statePayload = {
        sub: req.auth!.sub,
        workspaceId: req.auth!.workspaceId,
        type: 'oauth_state' as const,
        purpose: 'google_integration',
        name: body.data.name ?? null,
        color: body.data.color ?? null,
      };
      const state = app.jwt.sign(
        statePayload as unknown as Parameters<typeof app.jwt.sign>[0],
        { expiresIn: '10m' },
      );
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state,
        prompt: 'consent',
        include_granted_scopes: true,
      });
      return { authUrl };
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/integrations/google/callback',
    async (req, reply) => {
      const webOrigin = env.WEB_ORIGIN;
      const closeWithMessage = (payload: Record<string, unknown>) => {
        const json = JSON.stringify(payload);
        reply
          .header('Content-Type', 'text/html; charset=utf-8')
          .send(`<!doctype html><meta charset="utf-8"><title>Vinculando…</title>
<script>
  (function() {
    var msg = ${JSON.stringify(json)};
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'kibo-google-integration', payload: JSON.parse(msg) }, ${JSON.stringify(webOrigin)});
      }
    } catch (e) {}
    setTimeout(function(){ window.close(); }, 300);
  })();
</script>
<body style="font-family:sans-serif;background:#0d0d10;color:#e8e8ee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>Podés cerrar esta ventana.</p>
</body>`);
      };

      if (!configured) return closeWithMessage({ ok: false, error: 'not_configured' });
      if (req.query.error) return closeWithMessage({ ok: false, error: req.query.error });
      if (!req.query.code || !req.query.state)
        return closeWithMessage({ ok: false, error: 'missing_params' });

      let statePayload: {
        sub: string;
        workspaceId: string;
        type: string;
        purpose?: string;
        name: string | null;
        color: string | null;
      };
      try {
        statePayload = (await app.jwt.verify(req.query.state)) as typeof statePayload;
      } catch {
        return closeWithMessage({ ok: false, error: 'invalid_state' });
      }
      if (statePayload.type !== 'oauth_state' || statePayload.purpose !== 'google_integration') {
        return closeWithMessage({ ok: false, error: 'invalid_state' });
      }

      try {
        const client = new OAuth2Client({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
        });
        const { tokens } = await client.getToken(req.query.code);
        if (!tokens.access_token) return closeWithMessage({ ok: false, error: 'no_token' });

        const now = Date.now();
        const expiresAt = tokens.expiry_date ?? now + 55 * 60_000;
        const email = await fetchGoogleEmail(tokens.access_token);

        const { items = [], summary } = await fetchGoogleEvents(tokens.access_token);
        const parsed = toParsedIcs(items, summary);

        // On re-link (e.g. after reauth_required), reuse the previously linked
        // calendar instead of importing a duplicate one.
        const prior = await integrations().findOne({ _id: `${statePayload.sub}:google` });
        let calendarId: string | null = null;
        let eventsInserted = 0;
        if (prior && prior.workspaceId === statePayload.workspaceId && prior.calendarId) {
          const cal = await coll<{ _id: string }>(app.db, 'calendars').findOne({
            _id: prior.calendarId,
            workspaceId: statePayload.workspaceId,
            deletedAt: null,
          });
          if (cal) {
            const syncResult = await syncIcsUrlCalendar({
              db: app.db,
              workspaceId: statePayload.workspaceId,
              actorUserId: statePayload.sub,
              calendarId: prior.calendarId,
              parsed,
            });
            calendarId = prior.calendarId;
            eventsInserted = syncResult.eventsInserted;
          }
        }
        if (!calendarId) {
          const importResult = await importIcsAsNewCalendar({
            db: app.db,
            workspaceId: statePayload.workspaceId,
            actorUserId: statePayload.sub,
            parsed,
            calendar: {
              name: statePayload.name ?? summary ?? 'Google Calendar',
              color: statePayload.color ?? undefined,
              type: 'ics_url',
            },
          });
          calendarId = importResult.calendarId;
          eventsInserted = importResult.eventsInserted;
        }

        const doc: IntegrationDoc = {
          _id: `${statePayload.sub}:google`,
          userId: statePayload.sub,
          workspaceId: statePayload.workspaceId,
          provider: 'google',
          accessTokenEnc: encryptString(tokens.access_token, key),
          refreshTokenEnc: tokens.refresh_token
            ? encryptString(tokens.refresh_token, key)
            : null,
          expiresAt,
          scope: tokens.scope ?? SCOPES.join(' '),
          email,
          calendarId,
          linkedAt: nowUtc(),
          updatedAt: nowUtc(),
          needsReauth: false,
        };
        await integrations().updateOne(
          { _id: doc._id },
          { $set: doc },
          { upsert: true },
        );

        return closeWithMessage({
          ok: true,
          email,
          eventsInserted,
        });
      } catch (err) {
        req.log.warn({ err }, 'google integration failed');
        return closeWithMessage({ ok: false, error: 'exchange_failed' });
      }
    },
  );

  app.post(
    '/integrations/google/sync',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!configured) return reply.code(501).send({ error: 'not_configured' });
      if (!(await app.checkFlag('googleCalendarEnabled', reply))) return;
      const doc = await integrations().findOne({
        userId: req.auth!.sub,
        workspaceId: req.auth!.workspaceId,
        provider: 'google',
      });
      if (!doc) return reply.code(404).send({ error: 'not_connected' });
      if (!doc.calendarId) return reply.code(400).send({ error: 'no_linked_calendar' });

      try {
        const fresh = await getFreshAccessToken(doc, env, key);
        if (fresh.accessToken !== decryptString(doc.accessTokenEnc, key)) {
          await integrations().updateOne(
            { _id: doc._id },
            {
              $set: {
                accessTokenEnc: encryptString(fresh.accessToken, key),
                expiresAt: fresh.expiresAt,
                updatedAt: nowUtc(),
              },
            },
          );
        }
        const { items = [], summary } = await fetchGoogleEvents(fresh.accessToken);
        const parsed = toParsedIcs(items, summary);
        const result = await syncIcsUrlCalendar({
          db: app.db,
          workspaceId: req.auth!.workspaceId,
          actorUserId: req.auth!.sub,
          calendarId: doc.calendarId,
          parsed,
        });
        return result;
      } catch (err) {
        req.log.warn({ err }, 'google sync failed');
        if (isReauthError(err)) {
          // Grant is dead (e.g. testing-mode refresh tokens expire after 7 days,
          // or the user revoked access). Flag it so clients can prompt a re-link.
          await integrations().updateOne(
            { _id: doc._id },
            { $set: { needsReauth: true, updatedAt: nowUtc() } },
          );
          return reply.code(409).send({ error: 'reauth_required' });
        }
        return reply.code(400).send({ error: 'sync_failed' });
      }
    },
  );

  app.delete(
    '/integrations/google',
    { preHandler: app.requireAuth },
    async (req) => {
      const doc = await integrations().findOne({
        userId: req.auth!.sub,
        workspaceId: req.auth!.workspaceId,
        provider: 'google',
      });
      if (!doc) return { revoked: false };
      try {
        const token = decryptString(doc.accessTokenEnc, key);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
        });
      } catch {
        // ignore revoke errors
      }
      await integrations().deleteOne({ _id: doc._id });
      return { revoked: true };
    },
  );
}
