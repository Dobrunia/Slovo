import type { DataLayer } from "../../src/data/prisma.js";

/**
 * Упрощенная запись пользователя для auth-тестов без реального Prisma и БД.
 */
export type StoredTestUser = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Упрощенная запись auth-сессии для auth-тестов.
 */
export type StoredTestAuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
};

/**
 * Создает минимальный in-memory data layer, достаточный для auth GraphQL-тестов.
 */
export function createAuthTestDataLayer() {
  const users: StoredTestUser[] = [];
  const sessions: StoredTestAuthSession[] = [];

  const dataLayer = {
    prisma: {
      user: {
        findFirst: async (args?: {
          where?: {
            OR?: Array<{
              email?: string;
              username?: string;
            }>;
          };
        }) =>
          users.find((user) =>
            args?.where?.OR?.some(
              (condition) =>
                (condition.email !== undefined && user.email === condition.email) ||
                (condition.username !== undefined && user.username === condition.username),
            ),
          ) ?? null,
        findUnique: async (args: {
          where: {
            email?: string;
            username?: string;
            id?: string;
          };
        }) =>
          users.find(
            (user) =>
              (args.where.email !== undefined && user.email === args.where.email) ||
              (args.where.username !== undefined && user.username === args.where.username) ||
              (args.where.id !== undefined && user.id === args.where.id),
          ) ?? null,
        create: async (args: {
          data: {
            email: string;
            username: string;
            passwordHash: string;
            displayName: string;
            avatarUrl?: string | null;
          };
        }) => {
          const now = new Date();
          const user: StoredTestUser = {
            id: `user-${users.length + 1}`,
            email: args.data.email,
            username: args.data.username,
            passwordHash: args.data.passwordHash,
            displayName: args.data.displayName,
            avatarUrl: args.data.avatarUrl ?? null,
            createdAt: now,
            updatedAt: now,
          };

          users.push(user);

          return user;
        },
      },
      authSession: {
        create: async (args: {
          data: {
            userId: string;
            tokenHash: string;
          };
        }) => {
          const session: StoredTestAuthSession = {
            id: `session-${sessions.length + 1}`,
            userId: args.data.userId,
            tokenHash: args.data.tokenHash,
            createdAt: new Date(),
          };

          sessions.push(session);

          return session;
        },
        findUnique: async (args: {
          where: {
            tokenHash: string;
          };
        }) =>
          sessions.find((session) => session.tokenHash === args.where.tokenHash) ?? null,
      },
      $disconnect: async () => undefined,
    },
  } as unknown as DataLayer;

  return {
    dataLayer,
    users,
    sessions,
  };
}
