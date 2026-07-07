import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { appCheckMiddleware } from './middleware/appCheck.js';
import { errorHandler } from './middleware/errorHandler.js';
import { versionRouter } from './routes/version.js';
import { tasksRouter } from './routes/tasks.js';
import { projectsRouter } from './routes/projects.js';
import { authRouter } from './routes/auth.js';

/**
 * Construye la app Express. Separado de `server.ts` para que los tests
 * (supertest) puedan importar la app sin levantar un listener.
 */
export function buildApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '256kb' }));
  // En tests deshabilitamos pino-http para que la salida no se ensucie.
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // Welcome / liveness en root: util cuando alguien abre http://localhost:4000
  // en el browser. No expone nada sensible.
  app.get('/', (_req, res) => {
    res.json({
      service: 'daily-tracker-api',
      status: 'ok',
      docs: 'https://github.com/your-org/daily-tracker',
      endpoints: ['/api/version', '/api/auth/bootstrap', '/api/tasks', '/api/projects'],
    });
  });

  // Endpoint publico (sin auth, sin App Check) para health checks y version banner.
  app.use('/api/version', versionRouter);

  // Resto de la API: App Check + auth en cada router.
  app.use('/api', appCheckMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/projects', projectsRouter);

  app.use((req, res) => {
    res
      .status(404)
      .json({ error: { code: 'not_found', message: `${req.method} ${req.path}` } });
  });

  app.use(errorHandler);

  return app;
}
