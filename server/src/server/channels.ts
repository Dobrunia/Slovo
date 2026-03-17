import { REALTIME_EVENT_NAMES } from "../../../shared/realtime/names.js";
import type { DataLayer } from "../data/prisma.js";
import type { SlovoRealtimeRuntime } from "../realtime/runtime.js";
import type { PublicVoiceChannel } from "./public-server.js";
import { toPublicVoiceChannel } from "./public-server.js";

/**
 * Загружает отсортированный публичный snapshot voice-каналов выбранного сервера.
 */
export async function loadServerChannels(args: {
  dataLayer: DataLayer;
  serverId: string;
}): Promise<PublicVoiceChannel[]> {
  const channels = await args.dataLayer.prisma.voiceChannel.findMany({
    where: {
      serverId: args.serverId,
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
 * Рассылает live-событие обновленной структуры каналов сервера.
 */
export async function emitServerChannelsUpdated(args: {
  realtimeRuntime?: SlovoRealtimeRuntime | null;
  serverId: string;
  channels: PublicVoiceChannel[];
}): Promise<void> {
  if (!args.realtimeRuntime) {
    return;
  }

  await args.realtimeRuntime.emitEvent(REALTIME_EVENT_NAMES.channelsUpdated, {
    serverId: args.serverId,
    channels: args.channels,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Переуплотняет sortOrder оставшихся каналов после delete/reorder сценариев.
 */
export async function compactServerChannelOrder(args: {
  dataLayer: DataLayer;
  serverId: string;
}): Promise<void> {
  const channels = await args.dataLayer.prisma.voiceChannel.findMany({
    where: {
      serverId: args.serverId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  await Promise.all(
    channels.map((channel, index) =>
      args.dataLayer.prisma.voiceChannel.update({
        where: {
          id: channel.id,
        },
        data: {
          sortOrder: index,
        },
      }),
    ),
  );
}
