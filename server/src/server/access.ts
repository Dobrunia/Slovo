import type { DataLayer } from "../data/prisma.js";

type ServerMembershipWithServer = {
  role: "OWNER" | "ADMIN" | "MEMBER";
  server: {
    id: string;
    name: string;
    avatarUrl: string | null;
    inviteToken?: string | null;
    isPublic: boolean;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

/**
 * Загружает membership текущего пользователя в сервере вместе с записью сервера.
 */
async function getServerMembershipWithServer(args: {
  dataLayer: DataLayer;
  serverId: string;
  userId: string;
}): Promise<ServerMembershipWithServer | null> {
  return (await args.dataLayer.prisma.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId: args.serverId,
        userId: args.userId,
      },
    },
    include: {
      server: true,
    },
  })) as ServerMembershipWithServer | null;
}

/**
 * Проверяет, что пользователь может управлять сервером как OWNER или ADMIN.
 */
function assertServerManageAccess(
  membership: ServerMembershipWithServer | null,
): ServerMembershipWithServer & {
  server: NonNullable<ServerMembershipWithServer["server"]>;
} {
  if (!membership?.server) {
    throw new Error("Сервер не найден или доступ запрещен.");
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    throw new Error("Недостаточно прав для управления сервером.");
  }

  return membership as ServerMembershipWithServer & {
    server: NonNullable<ServerMembershipWithServer["server"]>;
  };
}

/**
 * Проверяет, что пользователь состоит в сервере и может читать его содержимое.
 */
function assertServerMembershipAccess(
  membership: ServerMembershipWithServer | null,
): ServerMembershipWithServer & {
  server: NonNullable<ServerMembershipWithServer["server"]>;
} {
  if (!membership?.server) {
    throw new Error("Сервер недоступен.");
  }

  return membership as ServerMembershipWithServer & {
    server: NonNullable<ServerMembershipWithServer["server"]>;
  };
}

/**
 * Возвращает membership текущего пользователя в конкретном сервере
 * или завершает операцию ошибкой доступа.
 */
export async function requireServerMember(args: {
  dataLayer: DataLayer;
  serverId: string;
  userId: string;
}): Promise<
  ServerMembershipWithServer & {
    server: NonNullable<ServerMembershipWithServer["server"]>;
  }
> {
  const membership = await getServerMembershipWithServer(args);
  return assertServerMembershipAccess(membership);
}

/**
 * Возвращает membership текущего пользователя с правом управления конкретным сервером
 * или завершает операцию ошибкой доступа.
 */
export async function requireServerManager(args: {
  dataLayer: DataLayer;
  serverId: string;
  userId: string;
}): Promise<
  ServerMembershipWithServer & {
    server: NonNullable<ServerMembershipWithServer["server"]>;
  }
> {
  const membership = await getServerMembershipWithServer(args);
  return assertServerManageAccess(membership);
}
