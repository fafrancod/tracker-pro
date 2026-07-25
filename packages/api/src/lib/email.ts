import { config } from '../config.js';
import { logger } from '../logger.js';

export function isEmailConfigured(): boolean {
  return Boolean(config.email.resendApiKey?.trim());
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Envía email vía Resend HTTP API.
 * Si no hay RESEND_API_KEY, no falla: skipped=true (dev/demo).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = config.email.resendApiKey?.trim();
  if (!key) {
    logger.info(
      { to: input.to, subject: input.subject },
      'email skipped (RESEND_API_KEY not set)'
    );
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!res.ok) {
      const error = body.message ?? body.name ?? `HTTP ${res.status}`;
      logger.warn({ to: input.to, status: res.status, error }, 'email send failed');
      return { ok: false, error };
    }

    return { ok: true, id: body.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, to: input.to }, 'email send exception');
    return { ok: false, error };
  }
}

export function reminderEmailHtml(opts: {
  userName: string;
  title: string;
  dayId: string;
  startTime: string;
  body: string;
  kindLabel: string;
}): string {
  const app = config.email.appName;
  const url = config.email.appUrl;
  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0d1117;color:#e6edf3;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;">
    <p style="margin:0 0 8px;font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(app)}</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#e6edf3;">${escapeHtml(opts.body)}</h1>
    <p style="margin:0 0 4px;font-size:14px;color:#8b949e;">${escapeHtml(opts.kindLabel)}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#c9d1d9;">
      <strong style="color:#58a6ff;">${escapeHtml(opts.startTime)}</strong>
      · ${escapeHtml(opts.dayId)}
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#e6edf3;">${escapeHtml(opts.title)}</p>
    ${
      url
        ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#238636;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;">Abrir app</a>`
        : ''
    }
    <p style="margin:24px 0 0;font-size:11px;color:#6e7681;">
      Hola ${escapeHtml(opts.userName)}. Puedes desactivar el correo en Ajustes → Notificaciones.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
