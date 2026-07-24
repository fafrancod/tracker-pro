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
import { tasksRouter } from './routes/tasks.js';
import { projectsRouter } from './routes/projects.js';
import { authRouter } from './routes/auth.js';

/** Directorio del build de Vite (packages/web/dist). Configurable para monorepo. */
function resolveWebDist(): string | null {
  const candidates = [
    process.env.WEB_DIST_DIR,
    path.resolve(process.cwd(), 'packages/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
  ].filter((p): p is string => Boolean(p));

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
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
      // SPA Vite: CSP estricto de helmet rompe assets; lo relajamos en monorepo.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // Same-origin SPA no manda Origin en algunos casos; si lo manda y es la propia URL, ok
        callback(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '256kb' }));
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // API siempre bajo /api/*
  app.use('/api/version', versionRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects', projectsRouter);

  // Health de API en /api (sin chocar con la SPA en /)
  app.get('/api', (_req, res) => {
    res.json({
      service: 'daily-tracker-api',
      status: 'ok',
      spa: serveSpa,
      docs: 'https://github.com/fafrancod/tracker-pro',
      endpoints: ['/api/version', '/api/auth/bootstrap', '/api/tasks', '/api/projects'],
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
    // React Router: cualquier ruta no-API devuelve index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'), err => {
        if (err) next(err);
      });
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        service: 'daily-tracker-api',
        status: 'ok',
        spa: false,
        hint: 'Frontend no empaquetado. Build con npm run build:web o define WEB_DIST_DIR.',
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
