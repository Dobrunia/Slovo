import { PrismaClient } from "@prisma/client";

/**
 * Общий серверный data layer, отделенный от transport-слоя.
 */
export type DataLayer = {
  prisma: PrismaClient;
};

/**
 * Создает обычный Prisma client для единственного server instance.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  process.env.DATABASE_URL = databaseUrl;
  return new PrismaClient();
}

/**
 * Формирует единый data layer, который будут использовать GraphQL и realtime-обработчики.
 */
export function createDataLayer(databaseUrl: string): DataLayer {
  return {
    prisma: createPrismaClient(databaseUrl),
  };
}

/**
 * Явно открывает соединение data layer на старте сервера.
 */
export async function connectDataLayer(dataLayer: DataLayer): Promise<void> {
  await dataLayer.prisma.$connect();
}

/**
 * Корректно завершает все подключения data layer при остановке процесса.
 */
export async function disposeDataLayer(dataLayer: DataLayer): Promise<void> {
  await dataLayer.prisma.$disconnect();
}
