import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Общий серверный data layer, отделенный от transport-слоя.
 */
export type DataLayer = {
  prisma: PrismaClient;
};

type GlobalWithPrisma = typeof globalThis & {
  __slovoPrismaClient__?: PrismaClient;
};

/**
 * Создает новый Prisma client с явной привязкой к серверной конфигурации.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = createMariaDbAdapter(databaseUrl);

  return new PrismaClient({
    adapter,
  });
}

/**
 * Возвращает singleton Prisma client для локальной разработки и тестов.
 */
export function getPrismaClient(databaseUrl: string): PrismaClient {
  const globalState = globalThis as GlobalWithPrisma;

  if (!globalState.__slovoPrismaClient__) {
    globalState.__slovoPrismaClient__ = createPrismaClient(databaseUrl);
  }

  return globalState.__slovoPrismaClient__;
}

/**
 * Формирует единый data layer, который будут использовать GraphQL и realtime-обработчики.
 */
export function createDataLayer(databaseUrl: string): DataLayer {
  return {
    prisma: getPrismaClient(databaseUrl),
  };
}

/**
 * Корректно завершает все подключения data layer при остановке процесса.
 */
export async function disposeDataLayer(dataLayer: DataLayer): Promise<void> {
  await dataLayer.prisma.$disconnect();
}

/**
 * Преобразует стандартный MySQL URL в конфигурацию MariaDB adapter для Prisma 7.
 */
function createMariaDbAdapter(databaseUrl: string): PrismaMariaDb {
  const parsedUrl = new URL(databaseUrl);
  const database = parsedUrl.pathname.replace(/^\//u, "");

  if (parsedUrl.protocol !== "mysql:") {
    throw new Error("DATABASE_URL должен использовать протокол mysql://.");
  }

  if (!database) {
    throw new Error("DATABASE_URL должен содержать имя базы данных.");
  }

  return new PrismaMariaDb({
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database,
  });
}
