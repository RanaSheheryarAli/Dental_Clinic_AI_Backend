import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { ragService } from './modules/rag/rag.service.js';
import { attachVoiceWebSocket } from './modules/voice/voice.ws.js';
import { logger } from './shared/utils/logger.js';

async function bootstrap() {
  await prisma.$connect();
  await ragService.initialize();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Dental Clinic AI backend is running');
  });

  // Twilio Media Streams WebSocket shares the same HTTP server/port.
  attachVoiceWebSocket(server);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, 'Failed to start backend');
  await prisma.$disconnect();
  process.exit(1);
});
