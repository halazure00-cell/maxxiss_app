import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __maxxissPrisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const options: {
    log: ('warn' | 'error')[];
    adapter?: PrismaPg;
  } = {
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  };

  if (process.env.DATABASE_URL) {
    options.adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return new PrismaClient(options);
}

export const prisma =
  global.__maxxissPrisma ||
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__maxxissPrisma = prisma;
}
