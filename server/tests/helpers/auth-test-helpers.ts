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
 * Упрощенная запись сервера для GraphQL-тестов без реального Prisma и БД.
 */
export type StoredTestServer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Упрощенная запись membership сервера для GraphQL-тестов без реального Prisma и БД.
 */
export type StoredTestServerMember = {
  id: string;
  serverId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Упрощенная запись voice-канала для GraphQL-тестов без реальной БД.
 */
export type StoredTestVoiceChannel = {
  id: string;
  serverId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Создает минимальный in-memory data layer, достаточный для auth GraphQL-тестов.
 */
export function createAuthTestDataLayer() {
  const users: StoredTestUser[] = [];
  const sessions: StoredTestAuthSession[] = [];
  const servers: StoredTestServer[] = [];
  const serverMembers: StoredTestServerMember[] = [];
  const voiceChannels: StoredTestVoiceChannel[] = [];

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
        update: async (args: {
          where: {
            id: string;
          };
          data: {
            displayName?: string;
            avatarUrl?: string | null;
          };
        }) => {
          const user = users.find((storedUser) => storedUser.id === args.where.id);

          if (!user) {
            throw new Error("User not found");
          }

          if (args.data.displayName !== undefined) {
            user.displayName = args.data.displayName;
          }

          if (args.data.avatarUrl !== undefined) {
            user.avatarUrl = args.data.avatarUrl;
          }

          user.updatedAt = new Date();

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
      server: {
        count: async (args?: {
          where?: {
            ownerId?: string;
          };
        }) =>
          servers.filter(
            (server) => args?.where?.ownerId === undefined || server.ownerId === args.where.ownerId,
          ).length,
        create: async (args: {
          data: {
            name: string;
            avatarUrl?: string | null;
            isPublic?: boolean;
            ownerId: string;
          };
        }) => {
          const now = new Date();
          const server: StoredTestServer = {
            id: `server-${servers.length + 1}`,
            name: args.data.name,
            avatarUrl: args.data.avatarUrl ?? null,
            isPublic: args.data.isPublic ?? false,
            ownerId: args.data.ownerId,
            createdAt: now,
            updatedAt: now,
          };

          servers.push(server);

          return server;
        },
      },
      serverMember: {
        create: async (args: {
          data: {
            serverId: string;
            userId: string;
            role: "OWNER" | "ADMIN" | "MEMBER";
          };
        }) => {
          const now = new Date();
          const member: StoredTestServerMember = {
            id: `membership-${serverMembers.length + 1}`,
            serverId: args.data.serverId,
            userId: args.data.userId,
            role: args.data.role,
            createdAt: now,
            updatedAt: now,
          };

          serverMembers.push(member);

          return member;
        },
        findUnique: async (args: {
          where: {
            serverId_userId: {
              serverId: string;
              userId: string;
            };
          };
          include?: {
            server?: boolean;
          };
        }) => {
          const member =
            serverMembers.find(
              (storedMember) =>
                storedMember.serverId === args.where.serverId_userId.serverId &&
                storedMember.userId === args.where.serverId_userId.userId,
            ) ?? null;

          if (!member) {
            return null;
          }

          if (!args.include?.server) {
            return member;
          }

          return {
            ...member,
            server: servers.find((server) => server.id === member.serverId) ?? null,
          };
        },
        findMany: async (args?: {
          where?: {
            userId?: string;
          };
          orderBy?: {
            server?: {
              updatedAt?: "asc" | "desc";
            };
          };
          include?: {
            server?: boolean;
          };
        }) => {
          const filteredMembers = serverMembers.filter(
            (member) => args?.where?.userId === undefined || member.userId === args.where.userId,
          );

          const enrichedMembers = filteredMembers.map((member) => ({
            ...member,
            server: servers.find((server) => server.id === member.serverId) ?? null,
          }));

          const updatedAtOrder = args?.orderBy?.server?.updatedAt;

          if (updatedAtOrder) {
            enrichedMembers.sort((left, right) => {
              const leftTime = left.server?.updatedAt.getTime() ?? 0;
              const rightTime = right.server?.updatedAt.getTime() ?? 0;

              return updatedAtOrder === "desc" ? rightTime - leftTime : leftTime - rightTime;
            });
          }

          return args?.include?.server
            ? enrichedMembers
            : enrichedMembers.map(({ server, ...member }) => member);
        },
      },
      voiceChannel: {
        findMany: async (args?: {
          where?: {
            serverId?: string;
          };
          orderBy?: {
            sortOrder?: "asc" | "desc";
          };
        }) => {
          const channels = voiceChannels.filter(
            (channel) => args?.where?.serverId === undefined || channel.serverId === args.where.serverId,
          );

          if (args?.orderBy?.sortOrder) {
            channels.sort((left, right) =>
              args.orderBy?.sortOrder === "desc"
                ? right.sortOrder - left.sortOrder
                : left.sortOrder - right.sortOrder,
            );
          }

          return channels;
        },
      },
      $disconnect: async () => undefined,
    },
  } as unknown as DataLayer;

  return {
    dataLayer,
    users,
    sessions,
    servers,
    serverMembers,
    voiceChannels,
  };
}
