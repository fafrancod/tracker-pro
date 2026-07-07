import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  base: { service: 'daily-tracker-api', version: config.version, channel: config.channel },
});
