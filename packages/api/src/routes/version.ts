import { Router } from 'express';
import { config } from '../config.js';

export const versionRouter = Router();

versionRouter.get('/', (_req, res) => {
  res.json({
    service: 'daily-tracker-api',
    version: config.version,
    channel: config.channel,
    buildId: config.buildId,
    nodeEnv: config.nodeEnv,
    database: 'supabase',
    /** true si RESEND_API_KEY está definida (recordatorios por correo). */
    emailConfigured: Boolean(config.email.resendApiKey?.trim()),
    /** Worker embebido de notificaciones email. */
    emailWorkerEnabled: config.worker.runEmbedded,
    emailFrom: config.email.from || null,
  });
});