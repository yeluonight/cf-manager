import { Request, Response, NextFunction } from 'express';
import { v1Logger as logger } from '../services/logger';

export function v1RequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  let logged = false;

  function log(suffix?: string) {
    if (logged) return;
    logged = true;
    const duration = Date.now() - start;
    const tag = suffix ? ` [${suffix}]` : '';
    logger.info(`${method} ${originalUrl} ${res.statusCode} ${duration}ms${tag}`);
  }

  res.on('finish', () => log());
  res.on('close', () => {
    if (!res.writableFinished) log('client_disconnected');
  });

  next();
}
