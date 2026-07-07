import { Router } from 'express';
import { config } from '../config.js';

export const versionRouter = Router();

// Endpoint publico. Sirve para health checks y para que el frontend o el
// admin sepan que version corre el backend.
versionRouter.get('/', (_req, res) => {
  res.json({
    service: 'daily-tracker-api',
    version: config.version,
    channel: config.channel,
    buildId: config.buildId,
    nodeEnv: config.nodeEnv,
    enforceAppCheck: config.enforceAppCheck,
  });
});
