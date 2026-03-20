import type {
  ServerEventDeliverer,
  ServerEventRouter,
} from "dobrunia-liverail-server";
import {
  createSocketIoChannelRoute,
  createSocketIoEventDeliverer,
} from "dobrunia-liverail-server/socket-io";
import type { Server as SocketIOServer } from "socket.io";
import {
  REALTIME_CHANNEL_NAMES,
  REALTIME_EVENT_NAMES,
} from "../../../shared/realtime/names.js";

/**
 * Создает маршрутизаторы realtime-событий проекта.
 */
export function createRealtimeEventRouters(): Record<string, ServerEventRouter> {
  return {
    [REALTIME_EVENT_NAMES.profileUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.userProfile, {
        userId: (payload as { userId: string }).userId,
      }),
    [REALTIME_EVENT_NAMES.userServersUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.userProfile, {
        userId: (payload as { userId: string }).userId,
      }),
    [REALTIME_EVENT_NAMES.serverUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.serverStructure, {
        serverId: (payload as { serverId: string }).serverId,
      }),
    [REALTIME_EVENT_NAMES.channelsUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.serverStructure, {
        serverId: (payload as { serverId: string }).serverId,
      }),
    [REALTIME_EVENT_NAMES.presenceUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.serverPresence, {
        serverId: (payload as { serverId: string }).serverId,
      }),
    [REALTIME_EVENT_NAMES.voiceSessionSignaled]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.voiceSignaling, {
        serverId: (payload as { serverId: string; channelId: string }).serverId,
        channelId: (payload as { serverId: string; channelId: string }).channelId,
      }),
    [REALTIME_EVENT_NAMES.voiceStateUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.voiceSession, {
        serverId: (payload as { serverId: string; channelId: string }).serverId,
        channelId: (payload as { serverId: string; channelId: string }).channelId,
      }),
    [REALTIME_EVENT_NAMES.screenShareUpdated]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.voiceSession, {
        serverId: (payload as { serverId: string; channelId: string }).serverId,
        channelId: (payload as { serverId: string; channelId: string }).channelId,
      }),
    [REALTIME_EVENT_NAMES.forcedDisconnect]: ({ payload }) =>
      createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.userProfile, {
        userId: (payload as { userId: string }).userId,
      }),
  };
}

/**
 * Создает единый набор deliverer-ов для Socket.IO transport.
 */
export function createRealtimeEventDeliverers(
  io: SocketIOServer,
): Record<string, ServerEventDeliverer> {
  const sharedEventDeliverer = createSocketIoEventDeliverer(io);

  return {
    [REALTIME_EVENT_NAMES.profileUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.userServersUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.serverUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.channelsUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.presenceUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.voiceSessionSignaled]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.voiceStateUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.screenShareUpdated]: sharedEventDeliverer,
    [REALTIME_EVENT_NAMES.forcedDisconnect]: sharedEventDeliverer,
  };
}
