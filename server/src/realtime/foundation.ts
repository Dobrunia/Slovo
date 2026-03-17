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
import { createRuntimePresenceRegistry, type RuntimePresenceRegistry } from "./presence.js";
import { createRealtimeChannelJoinAuthorizers } from "./channel-access.js";
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

        return joinVoiceChannelCommand({
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
      },
      [REALTIME_COMMAND_NAMES.leaveVoiceChannel]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return leaveVoiceChannelCommand({
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
      },
      [REALTIME_COMMAND_NAMES.moveVoiceChannel]: async ({
        input: commandInput,
        context,
      }: {
        input: { serverId: string; channelId: string; targetChannelId: string };
        context: RealtimeServerContext;
      }) => {
        const userId = requireRealtimeUserId(context);

        return moveVoiceChannelCommand({
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
