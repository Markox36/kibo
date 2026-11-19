import type { FastifyInstance } from 'fastify';
import { AuthRepository } from './auth.repository.js';
import { AuthService, AuthError } from './auth.service.js';
import { createEmailService } from '../email/email.service.js';
import type { Env } from '../../config/env.js';
import {
  RegisterInput,
  LoginInput,
  RefreshInput,
  VerifyEmailInput,
  ResendVerificationInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  GoogleLoginInput,
  type AuthResponse,
} from './auth.schemas.js';
import type { UserDoc } from './auth.repository.js';
import type { TokenPair } from './auth.service.js';

function toAuthResponse(user: UserDoc, workspaceId: string, tokens: TokenPair): AuthResponse {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    workspaceId,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
    },
  };
}

export async function authRoutes(app: FastifyInstance, env: Env): Promise<void> {
  const repo = new AuthRepository(app.db);
  const email = createEmailService(env, app.log);
  const service = new AuthService(app, repo, email, env);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AuthError) {
      reply.code(err.statusCode).send({ error: err.code });
      return;
    }
    app.log.error({ err }, 'unhandled error');
    reply.code(500).send({ error: 'internal_error' });
  });

  app.post('/auth/register', async (req, reply) => {
    if (!(await app.checkFlag('registrationEnabled', reply))) return;
    const parsed = RegisterInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
    const { tokens, user, workspaceId } = await service.register(parsed.data);
    return reply.code(201).send(toAuthResponse(user, workspaceId, tokens));
  });

  app.post('/auth/login', async (req, reply) => {
    const parsed = LoginInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    const { tokens, user, workspaceId } = await service.login(parsed.data);
    return toAuthResponse(user, workspaceId, tokens);
  });

  app.post('/auth/refresh', async (req, reply) => {
    const parsed = RefreshInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    const tokens = await service.refresh(parsed.data.refreshToken);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  });

  app.post('/auth/logout', async (req, reply) => {
    const parsed = RefreshInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await service.logout(parsed.data.refreshToken);
    return reply.code(204).send();
  });

  app.post('/auth/verify-email', async (req, reply) => {
    const parsed = VerifyEmailInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await service.verifyEmail(parsed.data.token);
    return { ok: true };
  });

  app.get<{ Querystring: { token?: string } }>('/auth/verify-email', async (req, reply) => {
    const token = req.query.token;
    if (!token) {
      return reply.type('text/html').code(400).send(renderVerifyPage({ ok: false, title: 'Falta el token', body: 'El enlace de verificación no está completo. Vuelve a solicitarlo desde Kibo.' }));
    }
    try {
      await service.verifyEmail(token);
    } catch {
      return reply.type('text/html').code(400).send(renderVerifyPage({
        ok: false,
        title: 'Enlace no válido',
        body: 'El enlace ha caducado o ya fue usado. Solicita otro desde Kibo.',
      }));
    }
    return reply.type('text/html').send(renderVerifyPage({
      ok: true,
      title: 'Email verificado',
      body: 'Ya puedes cerrar esta pestaña y volver a Kibo. La sincronización queda activada.',
    }));
  });

  app.post('/auth/resend-verification', async (req, reply) => {
    const parsed = ResendVerificationInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await service.resendVerification(parsed.data.email);
    return { ok: true };
  });

  app.post('/auth/request-password-reset', async (req, reply) => {
    const parsed = RequestPasswordResetInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await service.requestPasswordReset(parsed.data.email);
    return { ok: true };
  });

  app.post('/auth/reset-password', async (req, reply) => {
    const parsed = ResetPasswordInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await service.resetPassword(parsed.data.token, parsed.data.newPassword);
    return { ok: true };
  });

  app.post('/auth/google', async (req, reply) => {
    const parsed = GoogleLoginInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    const { tokens, user, workspaceId } = await service.googleLogin(parsed.data.idToken);
    return toAuthResponse(user, workspaceId, tokens);
  });
}

function renderVerifyPage(input: { ok: boolean; title: string; body: string }): string {
  const accent = input.ok ? '#7c8cff' : '#f97316';
  const glyph = input.ok
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M20 6L9 17l-5-5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)} · Kibo</title>
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0a0b;
      --surface: #111114;
      --border: #1f1f24;
      --muted: #8a8a94;
      --text: #e8e8ee;
      --accent: ${accent};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; }
    body {
      font-family: 'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif;
      background:
        radial-gradient(1200px 700px at 20% -10%, rgba(124, 140, 255, 0.10), transparent 60%),
        radial-gradient(900px 500px at 100% 100%, rgba(167, 139, 250, 0.09), transparent 60%),
        var(--bg);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 24px;
      letter-spacing: -0.005em;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)) , var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 28px 28px;
      box-shadow: 0 1px 0 rgba(255,255,255,0.03), 0 24px 60px -20px rgba(0,0,0,0.6);
      text-align: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 22px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .brand-mark {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #7c8cff, #a78bfa);
      color: #fff;
      display: inline-grid; place-items: center;
      font-size: 12px; font-weight: 700;
    }
    .icon {
      width: 56px; height: 56px;
      border-radius: 999px;
      display: grid; place-items: center;
      margin: 0 auto 18px;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 10px;
      letter-spacing: -0.015em;
    }
    p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transition: filter 120ms ease, background 120ms ease;
    }
    a.btn.primary {
      background: var(--accent);
      color: #0a0a0b;
    }
    a.btn.primary:hover { filter: brightness(1.08); }
    a.btn.ghost {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    a.btn.ghost:hover { border-color: var(--muted); }
    .foot {
      margin-top: 22px;
      font-size: 11.5px;
      color: var(--muted);
      opacity: 0.8;
    }
    .kbd {
      display: inline-block;
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <span class="brand-mark">K</span>
      <span>Kibo</span>
    </div>
    <div class="icon">${glyph}</div>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.body)}</p>
    <div class="actions">
      <a class="btn primary" href="kibo://app">Volver a Kibo</a>
      <a class="btn ghost" href="javascript:window.close()">Cerrar pestaña</a>
    </div>
    <div class="foot">También puedes cerrar con <span class="kbd">Ctrl</span> + <span class="kbd">W</span>.</div>
  </main>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
