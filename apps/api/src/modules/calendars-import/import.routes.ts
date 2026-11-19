import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import multipart from '@fastify/multipart';
import { OAuth2Client } from 'google-auth-library';
import type { Env } from '../../config/env.js';
import { coll } from '../../utils/collections.js';
import { parseIcs, type ParsedIcs, type ParsedIcsEvent } from './ical-parser.js';
import { importIcsAsNewCalendar, syncIcsUrlCalendar } from './import.service.js';

const IcsUrlBody = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(200).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const MAX_ICS_BYTES = 5 * 1024 * 1024;

async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: 'text/calendar, text/plain, */*' },
  });
  if (!res.ok) throw new Error(`fetch_failed_${res.status}`);
  const contentLength = Number(res.headers.get('content-length') ?? '0');
  if (contentLength && contentLength > MAX_ICS_BYTES) throw new Error('too_large');
  const text = await res.text();
  if (text.length > MAX_ICS_BYTES) throw new Error('too_large');
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not_ics');
  return text;
}

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

function toParsedIcsFromGoogle(items: GoogleEvent[], calSummary: string | undefined): ParsedIcs {
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

async function fetchAllGoogleEvents(accessToken: string, calendarId = 'primary'): Promise<GoogleEventsResponse> {
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
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
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

export async function calendarsImportRoutes(app: FastifyInstance, env?: Env): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: MAX_ICS_BYTES, files: 1 },
  });

  app.post(
    '/calendars/import/ics',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!(await app.checkFlag('icsFileImportEnabled', reply))) return;
      if (!(await app.ensureNotMaintenance(req, reply))) return;
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'no_file' });
      const bufs: Buffer[] = [];
      for await (const chunk of file.file) bufs.push(chunk as Buffer);
      const raw = Buffer.concat(bufs).toString('utf8');
      if (!raw.includes('BEGIN:VCALENDAR')) return reply.code(400).send({ error: 'not_ics' });

      const parsed = parseIcs(raw);

      const nameField = (file.fields.name as { value?: string } | undefined)?.value;
      const colorField = (file.fields.color as { value?: string } | undefined)?.value;

      const result = await importIcsAsNewCalendar({
        db: app.db,
        workspaceId: req.auth!.workspaceId,
        actorUserId: req.auth!.sub,
        parsed,
        calendar: {
          name: nameField,
          color: colorField,
          type: 'ics_file',
        },
      });
      return reply.code(201).send(result);
    },
  );

  app.post(
    '/calendars/import/ics-url',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!(await app.checkFlag('icsUrlImportEnabled', reply))) return;
      if (!(await app.ensureNotMaintenance(req, reply))) return;
      const parsedBody = IcsUrlBody.safeParse(req.body);
      if (!parsedBody.success)
        return reply.code(400).send({ error: 'bad_input', issues: parsedBody.error.flatten() });

      let raw: string;
      try {
        raw = await fetchIcs(parsedBody.data.url);
      } catch (err) {
        req.log.warn({ err }, 'ics url fetch failed');
        return reply.code(400).send({ error: 'fetch_failed' });
      }

      const parsed = parseIcs(raw);
      const result = await importIcsAsNewCalendar({
        db: app.db,
        workspaceId: req.auth!.workspaceId,
        actorUserId: req.auth!.sub,
        parsed,
        calendar: {
          name: parsedBody.data.name,
          color: parsedBody.data.color,
          type: 'ics_url',
          externalUrl: parsedBody.data.url,
        },
      });
      return reply.code(201).send(result);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/calendars/:id/sync',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const cal = await coll<{
        _id: string;
        workspaceId: string;
        type: string;
        externalUrl?: string | null;
        deletedAt: string | null;
      }>(app.db, 'calendars').findOne({
        _id: req.params.id,
        workspaceId: req.auth!.workspaceId,
        deletedAt: null,
      });
      if (!cal) return reply.code(404).send({ error: 'not_found' });
      if (cal.type !== 'ics_url' || !cal.externalUrl)
        return reply.code(400).send({ error: 'not_syncable' });

      let raw: string;
      try {
        raw = await fetchIcs(cal.externalUrl);
      } catch (err) {
        req.log.warn({ err }, 'ics sync fetch failed');
        return reply.code(400).send({ error: 'fetch_failed' });
      }
      const parsed = parseIcs(raw);
      const result = await syncIcsUrlCalendar({
        db: app.db,
        workspaceId: req.auth!.workspaceId,
        actorUserId: req.auth!.sub,
        calendarId: cal._id,
        parsed,
      });
      return result;
    },
  );

  const googleConfigured =
    Boolean(env?.GOOGLE_CLIENT_ID) &&
    Boolean(env?.GOOGLE_CLIENT_SECRET) &&
    Boolean(env?.GOOGLE_OAUTH_REDIRECT_URI);

  app.get('/calendars/import/google/status', { preHandler: app.requireAuth }, async () => ({
    configured: googleConfigured,
  }));

  const GoogleStartBody = z.object({
    name: z.string().min(1).max(200).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  });

  app.post(
    '/calendars/import/google/start',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!googleConfigured) return reply.code(501).send({ error: 'google_not_configured' });
      const body = GoogleStartBody.safeParse(req.body ?? {});
      if (!body.success)
        return reply.code(400).send({ error: 'bad_input', issues: body.error.flatten() });

      const client = new OAuth2Client({
        clientId: env!.GOOGLE_CLIENT_ID,
        clientSecret: env!.GOOGLE_CLIENT_SECRET,
        redirectUri: env!.GOOGLE_OAUTH_REDIRECT_URI,
      });
      const statePayload = {
        sub: req.auth!.sub,
        workspaceId: req.auth!.workspaceId,
        type: 'oauth_state' as const,
        purpose: 'google_calendar_import',
        name: body.data.name ?? null,
        color: body.data.color ?? null,
      };
      const state = app.jwt.sign(
        statePayload as unknown as Parameters<typeof app.jwt.sign>[0],
        { expiresIn: '10m' },
      );
      const authUrl = client.generateAuthUrl({
        access_type: 'online',
        scope: ['https://www.googleapis.com/auth/calendar.readonly'],
        state,
        prompt: 'consent',
      });
      return { authUrl };
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/calendars/import/google/callback',
    async (req, reply) => {
      const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
      const closeWithMessage = (payload: Record<string, unknown>) => {
        const json = JSON.stringify(payload);
        reply
          .header('Content-Type', 'text/html; charset=utf-8')
          .send(`<!doctype html><meta charset="utf-8"><title>Importando…</title>
<script>
  (function() {
    var msg = ${JSON.stringify(json)};
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'kibo-google-import', payload: JSON.parse(msg) }, ${JSON.stringify(webOrigin)});
      }
    } catch (e) {}
    document.body && (document.body.innerText = 'Podés cerrar esta ventana.');
    setTimeout(function(){ window.close(); }, 300);
  })();
</script>
<body style="font-family:sans-serif;background:#0d0d10;color:#e8e8ee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>Podés cerrar esta ventana.</p>
</body>`);
      };

      if (!googleConfigured) return closeWithMessage({ ok: false, error: 'not_configured' });
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
      if (statePayload.type !== 'oauth_state' || statePayload.purpose !== 'google_calendar_import') {
        return closeWithMessage({ ok: false, error: 'invalid_state' });
      }

      try {
        const client = new OAuth2Client({
          clientId: env!.GOOGLE_CLIENT_ID,
          clientSecret: env!.GOOGLE_CLIENT_SECRET,
          redirectUri: env!.GOOGLE_OAUTH_REDIRECT_URI,
        });
        const { tokens } = await client.getToken(req.query.code);
        if (!tokens.access_token) return closeWithMessage({ ok: false, error: 'no_token' });
        const { items = [], summary } = await fetchAllGoogleEvents(tokens.access_token);
        const parsed = toParsedIcsFromGoogle(items, summary);
        const result = await importIcsAsNewCalendar({
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
        return closeWithMessage({ ok: true, ...result });
      } catch (err) {
        req.log.warn({ err }, 'google import failed');
        return closeWithMessage({ ok: false, error: 'import_failed' });
      }
    },
  );
}
