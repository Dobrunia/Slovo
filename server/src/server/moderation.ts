import type { DataLayer } from "../data/prisma.js";

/**
 * Минимальная форма участника сервера, достаточная для moderation-операций.
 */
export interface ModerationTargetMember {
  id: string;
  serverId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Загружает участника сервера, которого владелец хочет модерировать.
 */
export async function requireModerationTargetMember(args: {
  dataLayer: DataLayer;
  serverId: string;
  targetUserId: string;
}): Promise<ModerationTargetMember> {
  const membership = (await args.dataLayer.prisma.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId: args.serverId,
        userId: args.targetUserId,
      },
    },
  })) as ModerationTargetMember | null;

  if (!membership) {
    throw new Error("Участник сервера не найден.");
  }

  return membership;
}

/**
 * Проверяет, что moderation применяется только к обычному участнику,
 * а не к единственному владельцу сервера.
 */
export function assertModeratableServerMember(
  membership: ModerationTargetMember,
): ModerationTargetMember & {
  role: "MEMBER";
} {
  if (membership.role === "OWNER") {
    throw new Error("Нельзя модерировать владельца сервера.");
  }

  return membership as ModerationTargetMember & {
    role: "MEMBER";
  };
}
