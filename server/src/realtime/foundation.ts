import type { Server as HttpServer } from "node:http";
import { createContractRegistry } from "dobrunia-liverail-contracts";
import {
  createServerRuntime,
  createServerRuntimeContext,
} from "dobrunia-liverail-server";
import { createSocketIoServerAdapter } from "dobrunia-liverail-server/socket-io";
import { Server as SocketIOServer } from "socket.io";
import { DEFAULT_CLIENT_ORIGIN } from "../config/constants.js";
import type { DataLayer } from "../data/prisma.js";
import type { MediaFoundation } from "../media/foundation.js";
import { createMediaSignalingBridge } from "../media/signaling-bridge.js";
import { createRuntimePresenceRegistry, type RuntimePresenceRegistry } from "./presence.js";
import { createRuntimeVoiceStateRegistry } from "./voice-state.js";
import { createRuntimeScreenShareRegistry } from "./screen-share.js";
import { createRealtimeChannelJoinAuthorizers } from "./channel-access.js";
import { handleRealtimeDisconnectCleanup } from "./disconnect.js";
import { createRealtimeEventDeliverers, createRealtimeEventRouters } from "./events.js";
import { createRealtimeCorsOriginMatcher } from "./http.js";
import {
  requireRealtimeUserId,
  resolveRealtimeSocketUserId,
  resolveRealtimeUserAgent,
} from "./socket-context.js";
import {
  joinVoiceChannelCommand,
  leaveVoiceChannelCommand,
  moveVoiceChannelCommand,
} from "./voice-commands.js";
import {
  setSelfDeafenCommand,
  setSelfMuteCommand,
} from "./voice-state-commands.js";
import {
  clearActiveScreenShare,
  setScreenShareActiveCommand,
} from "./screen-share-commands.js";
import {
  REALTIME_COMMAND_NAMES,
  REALTIME_EVENT_NAMES,
} from "../../../shared/realtime/names.js";

/**
 * Стандартный transport id для realtime-подключений проекта.
 */
export const REALTIME_TRANSPORT = "socket.io";

/**
 * Сокращенный тип registry, используемого realtime-слоем проекта.
 */
export type RealtimeRegistry = ReturnType<typeof createContractRegistry>;

/**
 * Базовый runtime context LiveRail для server-side realtime-обработчиков.
 */
export type RealtimeServerContext<
  TSession = { sessionId: string | null },
  TUser = { userId: string | null },
  TMetadata = {
    connectedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
> = ReturnType<typeof createServerRuntimeContext<TSession, TUser, TMetadata, string>>;

type CreateRealtimeServerFoundationInput<TRegistry extends RealtimeRegistry> = {
  httpServer: HttpServer;
  dataLayer: DataLayer;
  mediaFoundation: MediaFoundation;
  registry: TRegistry;
  clientOrigin?: string;
  presenceRegistry?: RuntimePresenceRegistry;
};

/**
 * Собирает transport-agnostic LiveRail runtime и привязывает его к Socket.IO-серверу.
 */
export function createRealtimeServerFoundation<TRegistry extends RealtimeRegistry>(
  input: CreateRealtimeServerFoundationInput<TRegistry>,
) {
  const presenceRegistry = input.presenceRegistry ?? createRuntimePresenceRegistry();
  const voiceStateRegistry = createRuntimeVoiceStateRegistry();
  const screenShareRegistry = createRuntimeScreenShareRegistry();
  const resolvedClientOrigin =
    input.clientOrigin ??
    (process.env.CLIENT_ORIGIN?.trim() || DEFAULT_CLIENT_ORIGIN);
  const io = new SocketIOServer(input.httpServer, {
    cors: {
      origin: createRealtimeCorsOriginMatcher(resolvedClientOrigin),
      credentials: true,
    },
  });
  const eventRouters = createRealtimeEventRouters();
  const eventDeliverers = createRealtimeEventDeliverers(io);
  let runtime: ReturnType<typeof createServerRuntime<RealtimeServerContext, TRegistry>>;
  const mediaSignalingBridge = createMediaSignalingBridge({
    mediaFoundation: input.mediaFoundation,
    presenceRegistry,
    emitSignalEvent: (payload) =>
      runtime.emitEvent(
        REALTIME_EVENT_NAMES.voiceSessionSignaled as never,
        payload as never,
        {
          context: createRealtimeServerContext({
            connectionId: "system",
            session: {
              sessionId: null,
            },
            user: {
              userId: null,
            },
            metadata: {
              connectedAt: new Date().toISOString(),
              ipAddress: null,
              userAgent: "system",
            },
          }),
        } as never,
      ),
  });
  runtime = createServerRuntime<RealtimeServerContext, TRegistry>({
    registry: input.registry,
    channelJoinAuthorizers: createRealtimeChannelJoinAuthorizers(input.dataLayer) as never,
    commandHandlers: {
      [REALTIME_COMMAND_NAMES.joinVoiceChannel]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);
        const previousPresence = presenceRegistry.getUserPresence(userId);

        const result = await joinVoiceChannelCommand({
          dataLayer: input.dataLayer,
          presenceRegistry,
          emitPresenceUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.presenceUpdated as never,
              payload as never,
              { context } as never,
            ),
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
        });

        const currentPresence = presenceRegistry.getUserPresence(userId);

        if (
          previousPresence &&
          (previousPresence.serverId !== currentPresence?.serverId ||
            previousPresence.channelId !== currentPresence?.channelId)
        ) {
          await clearActiveScreenShare({
            screenShareRegistry,
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
            teardownScreenShare: (payload) =>
              mediaSignalingBridge.teardownUserScreenShare(payload),
            emitScreenShareUpdated: (payload) =>
              runtime.emitEvent(
                REALTIME_EVENT_NAMES.screenShareUpdated as never,
                payload as never,
                { context } as never,
              ),
          });
          await mediaSignalingBridge.teardownUserSession({
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
          });
        }

        if (currentPresence) {
          voiceStateRegistry.syncPresence({
            userId,
            serverId: currentPresence.serverId,
            channelId: currentPresence.channelId,
          });
        }

        return result;
      },
      [REALTIME_COMMAND_NAMES.leaveVoiceChannel]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);
        const previousPresence = presenceRegistry.getUserPresence(userId);

        const result = await leaveVoiceChannelCommand({
          dataLayer: input.dataLayer,
          presenceRegistry,
          emitPresenceUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.presenceUpdated as never,
              payload as never,
              { context } as never,
            ),
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
        });

        if (previousPresence) {
          await clearActiveScreenShare({
            screenShareRegistry,
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
            teardownScreenShare: (payload) =>
              mediaSignalingBridge.teardownUserScreenShare(payload),
            emitScreenShareUpdated: (payload) =>
              runtime.emitEvent(
                REALTIME_EVENT_NAMES.screenShareUpdated as never,
                payload as never,
                { context } as never,
              ),
          });
          await mediaSignalingBridge.teardownUserSession({
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
          });
        }
        voiceStateRegistry.clearState(userId);

        return result;
      },
      [REALTIME_COMMAND_NAMES.moveVoiceChannel]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string; targetChannelId: string };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);
        const previousPresence = presenceRegistry.getUserPresence(userId);

        const result = await moveVoiceChannelCommand({
          dataLayer: input.dataLayer,
          presenceRegistry,
          emitPresenceUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.presenceUpdated as never,
              payload as never,
              { context } as never,
            ),
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
          targetChannelId: commandInput.targetChannelId,
        });

        if (previousPresence) {
          await clearActiveScreenShare({
            screenShareRegistry,
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
            teardownScreenShare: (payload) =>
              mediaSignalingBridge.teardownUserScreenShare(payload),
            emitScreenShareUpdated: (payload) =>
              runtime.emitEvent(
                REALTIME_EVENT_NAMES.screenShareUpdated as never,
                payload as never,
                { context } as never,
              ),
          });
          await mediaSignalingBridge.teardownUserSession({
            userId,
            serverId: previousPresence.serverId,
            channelId: previousPresence.channelId,
          });
        }

        const currentPresence = presenceRegistry.getUserPresence(userId);

        if (currentPresence) {
          voiceStateRegistry.syncPresence({
            userId,
            serverId: currentPresence.serverId,
            channelId: currentPresence.channelId,
          });
        }

        return result;
      },
      [REALTIME_COMMAND_NAMES.setSelfMute]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string; muted: boolean };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return setSelfMuteCommand({
          presenceRegistry,
          voiceStateRegistry,
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
          muted: commandInput.muted,
          applyVoiceState: (state) => mediaSignalingBridge.applyVoiceState(state),
          emitVoiceStateUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.voiceStateUpdated as never,
              payload as never,
              { context } as never,
            ),
        });
      },
      [REALTIME_COMMAND_NAMES.setSelfDeafen]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string; deafened: boolean };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return setSelfDeafenCommand({
          presenceRegistry,
          voiceStateRegistry,
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
          deafened: commandInput.deafened,
          applyVoiceState: (state) => mediaSignalingBridge.applyVoiceState(state),
          emitVoiceStateUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.voiceStateUpdated as never,
              payload as never,
              { context } as never,
          ),
        });
      },
      [REALTIME_COMMAND_NAMES.setScreenShareActive]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string; active: boolean };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return setScreenShareActiveCommand({
          presenceRegistry,
          screenShareRegistry,
          userId,
          serverId: commandInput.serverId,
          channelId: commandInput.channelId,
          active: commandInput.active,
          teardownScreenShare: (payload) =>
            mediaSignalingBridge.teardownUserScreenShare(payload),
          emitScreenShareUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.screenShareUpdated as never,
              payload as never,
              { context } as never,
            ),
        });
      },
      [REALTIME_COMMAND_NAMES.signalVoiceSession]: async ({
        input: commandInput,
        context,
      }: {
        input: {
          serverId: string;
          channelId: string;
          targetUserId: string | null;
          signalType: string;
          payloadJson: string;
        };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return mediaSignalingBridge.handleSignal({
          userId,
          command: commandInput,
        });
      },
    } as never,
    eventRouters: eventRouters as never,
    eventDeliverers: eventDeliverers as never,
  });
  const adapter = createSocketIoServerAdapter({
    io,
    runtime,
    injectContext: async (socket: {
      id?: string;
      handshake?: {
        address?: string;
        headers?: Record<string, string | string[] | undefined>;
        auth?: Record<string, unknown>;
        query?: Record<string, unknown>;
      };
    }) => {
      const userId = await resolveRealtimeSocketUserId({
        dataLayer: input.dataLayer,
        handshake: socket.handshake,
      });

      return (
      createRealtimeServerContext({
        connectionId: socket.id ?? "unknown-connection",
        session: {
          sessionId: null,
        },
        user: {
          userId,
        },
        metadata: {
          connectedAt: new Date().toISOString(),
          ipAddress: socket.handshake?.address ?? null,
          userAgent: resolveRealtimeUserAgent(socket.handshake?.headers),
        },
      })
      );
    },
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", async () => {
      const userId = await resolveRealtimeSocketUserId({
        dataLayer: input.dataLayer,
        handshake: socket.handshake,
      });
      const previousPresence = userId ? presenceRegistry.getUserPresence(userId) : null;

      if (!userId) {
        return;
      }

      const context = createRealtimeServerContext({
        connectionId: socket.id ?? "unknown-connection",
        session: {
          sessionId: null,
        },
        user: {
          userId,
        },
        metadata: {
          connectedAt: new Date().toISOString(),
          ipAddress: socket.handshake.address ?? null,
          userAgent: resolveRealtimeUserAgent(socket.handshake.headers),
        },
      });

      if (previousPresence) {
        await clearActiveScreenShare({
          screenShareRegistry,
          userId,
          serverId: previousPresence.serverId,
          channelId: previousPresence.channelId,
          teardownScreenShare: (payload) =>
            mediaSignalingBridge.teardownUserScreenShare(payload),
          emitScreenShareUpdated: (payload) =>
            runtime.emitEvent(
              REALTIME_EVENT_NAMES.screenShareUpdated as never,
              payload as never,
              { context } as never,
            ),
        });
        await mediaSignalingBridge.teardownUserSession({
          userId,
          serverId: previousPresence.serverId,
          channelId: previousPresence.channelId,
        });
      }
      voiceStateRegistry.clearState(userId);

      await handleRealtimeDisconnectCleanup({
        userId,
        presenceRegistry,
        emitPresenceUpdated: (payload) =>
          runtime.emitEvent(
            REALTIME_EVENT_NAMES.presenceUpdated as never,
            payload as never,
            { context } as never,
          ),
      });
    });
  });

  return {
    io,
    runtime,
    adapter,
    presenceRegistry,
  };
}

type CreateRealtimeServerContextInput<
  TSession,
  TUser,
  TMetadata,
> = {
  connectionId: string;
  session: TSession;
  user: TUser;
  metadata: TMetadata;
  transport?: string;
};

/**
 * Создает типизированный context для LiveRail-обработчиков соединения, команд и событий.
 */
export function createRealtimeServerContext<TSession, TUser, TMetadata>(
  input: CreateRealtimeServerContextInput<TSession, TUser, TMetadata>,
) {
  return createServerRuntimeContext({
    connectionId: input.connectionId,
    transport: input.transport ?? REALTIME_TRANSPORT,
    session: input.session,
    user: input.user,
    metadata: input.metadata,
  });
}
