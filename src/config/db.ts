import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn']
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
