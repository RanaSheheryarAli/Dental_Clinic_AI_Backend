import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { ragService } from './modules/rag/rag.service.js';
import { logger } from './shared/utils/logger.js';

async function bootstrap() {
  await prisma.$connect();
  await ragService.initialize();
  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Dental Clinic AI backend is running');
  });
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, 'Failed to start backend');
  await prisma.$disconnect();
  process.exit(1);
});
