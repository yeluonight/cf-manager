import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiSecret) {
    res.status(403).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'API_SECRET must be set. Refusing to run without authentication.' } });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
    return;
  }
  const token = authHeader.substring(7);
  // Use timing-safe comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token, 'utf8');
  const secretBuf = Buffer.from(config.apiSecret, 'utf8');
  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid API secret' } });
    return;
  }
  next();
}
