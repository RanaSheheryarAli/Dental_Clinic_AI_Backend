import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface ValidationSchema {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export function validate(schema: ValidationSchema): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schema.body) {
        Object.defineProperty(req, 'body', {
          value: schema.body.parse(req.body),
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
      if (schema.query) {
        Object.defineProperty(req, 'query', {
          value: schema.query.parse(req.query),
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
      if (schema.params) {
        Object.defineProperty(req, 'params', {
          value: schema.params.parse(req.params),
          configurable: true,
          enumerable: true,
          writable: true
        });
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new AppError('VALIDATION_ERROR', error.issues.map((issue) => issue.message).join(', '), 400));
        return;
      }
      next(error);
    }
  };
}
