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
  });
});