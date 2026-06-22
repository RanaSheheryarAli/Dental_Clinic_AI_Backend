import cors from 'cors';
import express from 'express';
import pinoHttpModule from 'pino-http';
import { API_PREFIX } from './config/constants.js';
import { isCorsOriginAllowed } from './config/env.js';
import { bookingRouter } from './modules/booking/booking.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { clinicRouter } from './modules/clinic/clinic.routes.js';
import { ragRouter } from './modules/rag/rag.routes.js';
import { voiceRouter } from './modules/voice/voice.routes.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes.js';
import { errorMiddleware } from './shared/middleware/error.middleware.js';
import { logger } from './shared/utils/logger.js';

export function createApp() {
  const app = express();
  const pinoHttp = pinoHttpModule as unknown as (options: { logger: typeof logger }) => express.RequestHandler;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || isCorsOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      }
    })
  );
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok'
      }
    });
  });

  app.use(`${API_PREFIX}/clinic`, clinicRouter);
  app.use(`${API_PREFIX}/booking`, bookingRouter);
  app.use(`${API_PREFIX}/chat`, chatRouter);
  app.use(`${API_PREFIX}/rag`, ragRouter);
  app.use(`${API_PREFIX}/whatsapp`, whatsappRouter);
  app.use(`${API_PREFIX}/voice`, voiceRouter);
  app.use(errorMiddleware);

  return app;
}
