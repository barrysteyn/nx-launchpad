import pino from 'pino';
import PinoPretty from 'pino-pretty';

const isLocal = !process.env['ENVIRONMENT'] || process.env['ENVIRONMENT'] === 'local';

export const logger = pino(
  {
    name: process.env['SERVICE_NAME'] ?? 'app',
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
  isLocal ? PinoPretty({ colorize: true, sync: true }) : undefined,
);

export const flushLogger = (): Promise<void> =>
  new Promise((resolve) => logger.flush(() => resolve()));
