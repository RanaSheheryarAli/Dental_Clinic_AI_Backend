import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.httpStatus).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled application error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.'
    }
  });
};
