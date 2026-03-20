import type { DataLayer } from "../data/prisma.js";
import { REALTIME_CHANNEL_NAMES } from "../../../shared/realtime/names.js";

type RealtimeChannelContext = {
  user: {
    userId: string | null;
  };
};

/**
 * Возвращает `true`, если текущий пользователь состоит в указанном сервере.
 */
export async function canJoinServerChannel(args: {
  dataLayer: DataLayer;
  serverId: string;
  userId: string | null;
}): Promise<boolean> {
  if (!args.userId) {
    return false;
  }

  const membership = await args.dataLayer.prisma.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId: args.serverId,
        userId: args.userId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(membership);
}

/**
 * Создает authorizer-ы для server-scoped и user-scoped realtime-каналов.
 */
export function createRealtimeChannelJoinAuthorizers(dataLayer: DataLayer) {
  return {
    [REALTIME_CHANNEL_NAMES.serverStructure]: async ({
      key,
      context,
    }: {
      key: { serverId: string };
      context: RealtimeChannelContext;
    }) =>
      canJoinServerChannel({
        dataLayer,
        serverId: key.serverId,
        userId: context.user.userId,
      }),
    [REALTIME_CHANNEL_NAMES.serverPresence]: async ({
      key,
      context,
    }: {
      key: { serverId: string };
      context: RealtimeChannelContext;
    }) =>
      canJoinServerChannel({
        dataLayer,
        serverId: key.serverId,
        userId: context.user.userId,
      }),
    [REALTIME_CHANNEL_NAMES.voiceSession]: async ({
      key,
      context,
    }: {
      key: { serverId: string; channelId: string };
      context: RealtimeChannelContext;
    }) =>
      canJoinServerChannel({
        dataLayer,
        serverId: key.serverId,
        userId: context.user.userId,
      }),
    [REALTIME_CHANNEL_NAMES.voiceSignaling]: async ({
      key,
      context,
    }: {
      key: { serverId: string; channelId: string };
      context: RealtimeChannelContext;
    }) =>
      canJoinServerChannel({
        dataLayer,
        serverId: key.serverId,
        userId: context.user.userId,
      }),
    [REALTIME_CHANNEL_NAMES.userProfile]: ({
      key,
      context,
    }: {
      key: { userId: string };
      context: RealtimeChannelContext;
    }) => Boolean(context.user.userId && context.user.userId === key.userId),
  };
}
