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

  // Extract useful info from Cloudflare SDK errors
  const cfStatus = (err as any)?.status;
  const cfCode = (err as any)?.error?.code;
  const cfMessage = (err as any)?.error?.message || (err as any)?.message;

  if (res.headersSent) {
    return;
  }

  const isClientError = statusCode >= 400 && statusCode < 500;

  // For Cloudflare API errors, include the upstream status & message
  // so the user can distinguish network/proxy/permission issues
  let message = 'Internal Server Error';
  if (isClientError) {
    message = err.message;
  } else if (cfStatus) {
    message = `Cloudflare API ${cfStatus}: ${cfCode || ''} ${cfMessage || err.message}`;
  } else if (err.message && err.message !== 'Internal Server Error') {
    // Include the real error message for debugging (network errors, etc.)
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: cfCode || code,
      message,
    },
  });
}
