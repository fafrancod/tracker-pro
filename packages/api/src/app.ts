import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { versionRouter } from './routes/version.js';
import { publicConfigRouter } from './routes/publicConfig.js';
import { tasksRouter } from './routes/tasks.js';
import { projectsRouter } from './routes/projects.js';
import { authRouter } from './routes/auth.js';

/**
 * Busca packages/web/dist (cwd y ubicación del bundle varían en Docker/Railway).
 * En el bundle CJS, process.cwd() es /app y la SPA vive en packages/web/dist.
 */
function resolveWebDist(): string | null {
  const candidates = [
    process.env.WEB_DIST_DIR,
    path.resolve(process.cwd(), 'packages/web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
  ].filter((p): p is string => Boolean(p));

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function buildApp(): Express {
  const app = express();
  const webDist = resolveWebDist();
  const serveSpa = Boolean(webDist);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        // Sin Origin (healthchecks, same-origin navegación simple) → OK
        if (!origin) {
          callback(null, true);
          return;
        }
        if (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*')) {
          callback(null, true);
          return;
        }
        // No tirar Error (rompe el request con 500); denegar limpio
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '256kb' }));
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.use('/api/version', versionRouter);
  app.use('/api/public-config', publicConfigRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects', projectsRouter);

  app.get('/api', (_req, res) => {
    res.json({
      service: 'daily-tracker-api',
      status: 'ok',
      spa: serveSpa,
      webDist: serveSpa ? webDist : null,
      supabaseConfigured: Boolean(config.supabase.url && config.supabase.serviceRoleKey),
      publicConfigReady: Boolean(config.supabase.url && config.supabase.anonKey),
      docs: 'https://github.com/fafrancod/tracker-pro',
      endpoints: [
        '/api/version',
        '/api/public-config',
        '/api/auth/bootstrap',
        '/api/tasks',
        '/api/projects',
      ],
    });
  });

  if (serveSpa && webDist) {
    logger.info({ webDist }, 'serving SPA from web dist');
    app.use(
      express.static(webDist, {
        index: false,
        maxAge: config.nodeEnv === 'production' ? '1h' : 0,
      })
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    logger.warn(
      { cwd: process.cwd() },
      'SPA dist not found — serving API-only. Run build:web or set WEB_DIST_DIR.'
    );
    app.get('/', (_req, res) => {
      res.json({
        service: 'daily-tracker-api',
        status: 'ok',
        spa: false,
        hint: 'Frontend no empaquetado. Build con npm run build:prod.',
        docs: 'https://github.com/fafrancod/tracker-pro',
        endpoints: ['/api/version', '/api/auth/bootstrap', '/api/tasks', '/api/projects'],
      });
    });
  }

  app.use((req, res) => {
    res
      .status(404)
      .json({ error: { code: 'not_found', message: `${req.method} ${req.path}` } });
  });

  app.use(errorHandler);

  return app;
}
