import type { Server as HttpServer } from "node:http";
import { createContractRegistry } from "dobrunia-liverail-contracts";
import {
  createServerRuntime,
  createServerRuntimeContext,
} from "dobrunia-liverail-server";
import { createSocketIoServerAdapter } from "dobrunia-liverail-server/socket-io";
import { Server as SocketIOServer } from "socket.io";
import { DEFAULT_CLIENT_ORIGIN } from "../config/constants.js";

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
  registry: TRegistry;
  clientOrigin?: string;
};

/**
 * Собирает transport-agnostic LiveRail runtime и привязывает его к Socket.IO-серверу.
 */
export function createRealtimeServerFoundation<TRegistry extends RealtimeRegistry>(
  input: CreateRealtimeServerFoundationInput<TRegistry>,
) {
  const io = new SocketIOServer(input.httpServer, {
    cors: {
      origin:
        input.clientOrigin ??
        (process.env.CLIENT_ORIGIN?.trim() || DEFAULT_CLIENT_ORIGIN),
      credentials: true,
    },
  });
  const runtime = createServerRuntime({
    registry: input.registry,
  });
  const adapter = createSocketIoServerAdapter({
    io,
    runtime,
    injectContext: (socket: {
      id?: string;
      handshake?: {
        address?: string;
        headers?: Record<string, string | string[] | undefined>;
      };
    }) =>
      createRealtimeServerContext({
        connectionId: socket.id ?? "unknown-connection",
        session: {
          sessionId: null,
        },
        user: {
          userId: null,
        },
        metadata: {
          connectedAt: new Date().toISOString(),
          ipAddress: socket.handshake?.address ?? null,
          userAgent: resolveUserAgent(socket.handshake?.headers),
        },
      }),
  });

  return {
    io,
    runtime,
    adapter,
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

/**
 * Извлекает user-agent из заголовков сокета и нормализует его к строке или `null`.
 */
function resolveUserAgent(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const userAgent = headers?.["user-agent"];

  if (typeof userAgent === "string" && userAgent.trim()) {
    return userAgent;
  }

  return null;
}
