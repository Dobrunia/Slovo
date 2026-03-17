import { REALTIME_EVENT_NAMES } from "../../../shared/realtime/names.js";
import type { DataLayer } from "../data/prisma.js";
import {
  emitSystemRealtimeEvent,
  type SlovoRealtimeRuntime,
} from "../realtime/runtime.js";
import {
  toPublicVoiceChannel,
  type PublicVoiceChannel,
} from "./public-server.js";

/**
 * Загружает voice-каналы сервера в клиентской публичной форме и серверном порядке.
 */
export async function loadServerChannels(input: {
  dataLayer: DataLayer;
  serverId: string;
}): Promise<PublicVoiceChannel[]> {
  const channels = await input.dataLayer.prisma.voiceChannel.findMany({
    where: {
      serverId: input.serverId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return channels.map((channel) =>
    toPublicVoiceChannel({
      id: channel.id,
      name: channel.name,
      sortOrder: channel.sortOrder,
    }),
  );
}

/**
 * Уплотняет порядок каналов сервера после удаления или иных перестановок.
 */
export async function compactServerChannelOrder(input: {
  dataLayer: DataLayer;
  serverId: string;
}): Promise<void> {
  const channels = await input.dataLayer.prisma.voiceChannel.findMany({
    where: {
      serverId: input.serverId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  for (const [index, channel] of channels.entries()) {
    if (channel.sortOrder !== index) {
      await input.dataLayer.prisma.voiceChannel.update({
        where: {
          id: channel.id,
        },
        data: {
          sortOrder: index,
        },
      });
    }
  }
}

/**
 * Рассылает live-обновление структуры каналов сервера всем его подписчикам.
 */
export async function emitServerChannelsUpdated(input: {
  realtimeRuntime: SlovoRealtimeRuntime | null;
  serverId: string;
  channels: PublicVoiceChannel[];
  updatedAt?: string;
}): Promise<void> {
  if (!input.realtimeRuntime) {
    return;
  }

  await emitSystemRealtimeEvent(input.realtimeRuntime, REALTIME_EVENT_NAMES.channelsUpdated, {
    serverId: input.serverId,
    channels: input.channels,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
}
