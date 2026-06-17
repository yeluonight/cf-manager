import { Request, Response, NextFunction } from 'express';
import { appLogger } from '../services/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  appLogger.error(`[${code}] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) {
    return;
  }
  // Don't expose internal error details in production for 5xx errors
  const isClientError = statusCode >= 400 && statusCode < 500;
  const message = isClientError ? err.message : 'Internal Server Error';
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
