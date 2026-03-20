import type { DataLayer } from "../data/prisma.js";
import type { RuntimePresenceRegistry, RuntimePresenceMember } from "./presence.js";

type VoiceCommandAck = {
  accepted: boolean;
  acknowledgedAt: string;
};

type EmitPresenceUpdated = (payload: {
  serverId: string;
  member: RuntimePresenceMember;
  previousChannelId: string | null;
  action: "joined" | "left" | "moved";
  occurredAt: string;
}) => Promise<unknown>;

type BaseVoiceCommandInput = {
  dataLayer: DataLayer;
  presenceRegistry: RuntimePresenceRegistry;
  emitPresenceUpdated: EmitPresenceUpdated;
  userId: string;
  connectionId: string;
  serverId: string;
};

type JoinVoiceChannelCommandInput = BaseVoiceCommandInput & {
  channelId: string;
};

type MoveVoiceChannelCommandInput = BaseVoiceCommandInput & {
  channelId: string;
  targetChannelId: string;
};

type LeaveVoiceChannelCommandInput = BaseVoiceCommandInput & {
  channelId: string;
};

type VoiceCommandUserMembership = {
  serverId: string;
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

/**
 * Выполняет join-команду для voice-канала и эмитит live-события presence.
 */
export async function joinVoiceChannelCommand(
  input: JoinVoiceChannelCommandInput,
): Promise<VoiceCommandAck> {
  const occurredAt = new Date().toISOString();
  const membership = await requireVoiceChannelMembership({
    dataLayer: input.dataLayer,
    serverId: input.serverId,
    channelId: input.channelId,
    userId: input.userId,
  });
  const mutation = input.presenceRegistry.setPresence({
    userId: membership.user.id,
    displayName: membership.user.displayName,
    avatarUrl: membership.user.avatarUrl,
    serverId: input.serverId,
    channelId: input.channelId,
    connectionId: input.connectionId,
    occurredAt,
  });

  if (!mutation.previous) {
    await input.emitPresenceUpdated({
      serverId: input.serverId,
      member: mutation.current,
      previousChannelId: null,
      action: "joined",
      occurredAt,
    });
  } else if (mutation.previous.serverId === mutation.current.serverId) {
    if (mutation.previous.channelId !== mutation.current.channelId) {
      await input.emitPresenceUpdated({
        serverId: input.serverId,
        member: mutation.current,
        previousChannelId: mutation.previous.channelId,
        action: "moved",
        occurredAt,
      });
    }
  } else {
    await input.emitPresenceUpdated({
      serverId: mutation.previous.serverId,
      member: mutation.previous,
      previousChannelId: mutation.previous.channelId,
      action: "left",
      occurredAt,
    });
    await input.emitPresenceUpdated({
      serverId: input.serverId,
      member: mutation.current,
      previousChannelId: null,
      action: "joined",
      occurredAt,
    });
  }

  return {
    accepted: true,
    acknowledgedAt: occurredAt,
  };
}

/**
 * Выполняет leave-команду для voice-канала и эмитит live-событие выхода.
 */
export async function leaveVoiceChannelCommand(
  input: LeaveVoiceChannelCommandInput,
): Promise<VoiceCommandAck> {
  const occurredAt = new Date().toISOString();
  await requireVoiceChannelMembership({
    dataLayer: input.dataLayer,
    serverId: input.serverId,
    channelId: input.channelId,
    userId: input.userId,
  });

  const currentPresence = input.presenceRegistry.getUserPresenceRecord(input.userId);

  if (!currentPresence) {
    return {
      accepted: true,
      acknowledgedAt: occurredAt,
    };
  }

  if (
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId ||
    currentPresence.connectionId !== input.connectionId
  ) {
    throw new Error("Текущее присутствие пользователя уже изменилось.");
  }

  const removal = input.presenceRegistry.clearPresence(input.userId);

  if (removal) {
    await input.emitPresenceUpdated({
      serverId: removal.previous.serverId,
      member: removal.previous,
      previousChannelId: removal.previous.channelId,
      action: "left",
      occurredAt,
    });
  }

  return {
    accepted: true,
    acknowledgedAt: occurredAt,
  };
}

/**
 * Выполняет move-команду между voice-каналами сервера и эмитит live-событие переноса.
 */
export async function moveVoiceChannelCommand(
  input: MoveVoiceChannelCommandInput,
): Promise<VoiceCommandAck> {
  const currentPresence = input.presenceRegistry.getUserPresenceRecord(input.userId);

  if (!currentPresence) {
    throw new Error("Пользователь сейчас не находится в голосовом канале.");
  }

  if (
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId ||
    currentPresence.connectionId !== input.connectionId
  ) {
    throw new Error("Текущее присутствие пользователя уже изменилось.");
  }

  return joinVoiceChannelCommand({
    dataLayer: input.dataLayer,
    presenceRegistry: input.presenceRegistry,
    emitPresenceUpdated: input.emitPresenceUpdated,
    userId: input.userId,
    connectionId: input.connectionId,
    serverId: input.serverId,
    channelId: input.targetChannelId,
  });
}

/**
 * Проверяет membership пользователя в сервере и существование voice-канала.
 */
async function requireVoiceChannelMembership(args: {
  dataLayer: DataLayer;
  serverId: string;
  channelId: string;
  userId: string;
}): Promise<VoiceCommandUserMembership> {
  const membership = await args.dataLayer.prisma.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId: args.serverId,
        userId: args.userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Сервер недоступен.");
  }

  const user = await args.dataLayer.prisma.user.findUnique({
    where: {
      id: args.userId,
    },
  });

  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  const channel = await args.dataLayer.prisma.voiceChannel.findUnique({
    where: {
      id: args.channelId,
    },
  });

  if (!channel || channel.serverId !== args.serverId) {
    throw new Error("Голосовой канал не найден.");
  }

  return {
    serverId: membership.serverId,
    userId: membership.userId,
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  };
}
