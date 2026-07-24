import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const port = Number(process.env.PORT ?? config.port ?? 4000);
if (!Number.isFinite(port) || port <= 0) {
  logger.fatal({ PORT: process.env.PORT }, 'PORT inválido');
  process.exit(1);
}

const app = buildApp();

// Railway / contenedores: hay que bindear 0.0.0.0 (no solo localhost)
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(
    {
      port,
      host: '0.0.0.0',
      channel: config.channel,
      version: config.version,
      nodeEnv: config.nodeEnv,
      cwd: process.cwd(),
    },
    'daily-tracker-api listening'
  );
});

server.on('error', (err: NodeJS.ErrnoException) => {
  logger.fatal({ err, port }, 'server failed to start');
  process.exit(1);
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown signal received');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', err => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  logger.fatal({ reason }, 'unhandledRejection');
  process.exit(1);
});
