import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

const app = buildApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, channel: config.channel, version: config.version },
    'daily-tracker-api listening'
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown signal received');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
