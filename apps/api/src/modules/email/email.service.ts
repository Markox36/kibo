import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';
import type { FastifyBaseLogger } from 'fastify';

export interface EmailService {
  sendVerification(to: string, url: string): Promise<void>;
  sendPasswordReset(to: string, url: string): Promise<void>;
}

export function createEmailService(env: Env, log: FastifyBaseLogger): EmailService {
  const enabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  let transporter: Transporter | null = null;

  if (enabled) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    });
  }

  const from = env.SMTP_FROM ?? 'Kibo <noreply@example.com>';

  const send = async (to: string, subject: string, html: string, text: string) => {
    if (!transporter) {
      log.warn({ to, subject }, 'SMTP not configured; email skipped');
      return;
    }
    await transporter.sendMail({ from, to, subject, html, text });
  };

  return {
    async sendVerification(to, url) {
      await send(
        to,
        'Verifica tu email en Kibo',
        `<p>Hola,</p><p>Verifica tu email para activar la sincronización:</p><p><a href="${url}">${url}</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
        `Verifica tu email: ${url}`,
      );
    },
    async sendPasswordReset(to, url) {
      await send(
        to,
        'Restablece tu contraseña de Kibo',
        `<p>Recibimos una petición para restablecer tu contraseña.</p><p>Enlace válido 1 hora:</p><p><a href="${url}">${url}</a></p><p>Si no fuiste tú, ignora este correo.</p>`,
        `Restablece tu contraseña: ${url}`,
      );
    },
  };
}
