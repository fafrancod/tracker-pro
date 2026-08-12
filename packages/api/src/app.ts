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
import { contactsRouter } from './routes/contacts.js';
import { authRouter } from './routes/auth.js';
import { notificationsRouter } from './routes/notifications.js';
import { financesRouter } from './routes/finances.js';

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
  // 4mb: adjuntos de tarea (hasta 4 data URLs imagen/PDF) + metadata.
  app.use(express.json({ limit: '4mb' }));
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.use('/api/version', versionRouter);
  app.use('/api/public-config', publicConfigRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/finances', financesRouter);

  app.get('/api', (_req, res) => {
    res.json({
      service: 'daily-tracker-api',
      status: 'ok',
      spa: serveSpa,
      webDist: serveSpa ? webDist : null,
      supabaseConfigured: Boolean(config.supabase.url && config.supabase.serviceRoleKey),
      publicConfigReady: Boolean(config.supabase.url && config.supabase.anonKey),
      emailConfigured: Boolean(config.email.resendApiKey),
      docs: 'https://github.com/fafrancod/tracker-pro',
      endpoints: [
        '/api/version',
        '/api/public-config',
        '/api/auth/bootstrap',
        '/api/tasks',
        '/api/projects',
        '/api/contacts',
        '/api/finances',
        '/api/notifications/status',
        '/api/notifications/test-email',
        '/api/notifications/dispatch',
      ],
    });
  });

  if (serveSpa && webDist) {
    logger.info({ webDist }, 'serving SPA from web dist');
    // Assets con hash: cache largo. SW / index / manifest: siempre revalidar
    // para que la PWA de escritorio detecte nuevas versiones.
    app.use(
      express.static(webDist, {
        index: false,
        maxAge: config.nodeEnv === 'production' ? '7d' : 0,
        setHeaders(res, filePath) {
          const base = path.basename(filePath);
          const noCache =
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'registerSW.js' ||
            base === 'manifest.webmanifest' ||
            base.startsWith('workbox-') ||
            base.endsWith('.webmanifest');
          if (noCache) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
          }
        },
      })
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
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
