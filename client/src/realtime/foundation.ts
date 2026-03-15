import { createContractRegistry } from "dobrunia-liverail-contracts";
import { createClientRuntime } from "dobrunia-liverail-client";
import { createSocketIoClientTransport } from "dobrunia-liverail-client/socket-io";
import { io } from "socket.io-client";
import { DEFAULT_CLIENT_REALTIME_URL } from "../constants";

/**
 * Сокращенный тип registry, используемого realtime-слоем клиента.
 */
export type RealtimeRegistry = ReturnType<typeof createContractRegistry>;

type CreateRealtimeClientFoundationInput<TRegistry extends RealtimeRegistry> = {
  registry: TRegistry;
  url?: string;
  autoConnect?: boolean;
};

/**
 * Создает клиентский LiveRail runtime и подключает к нему Socket.IO transport.
 */
export function createRealtimeClientFoundation<TRegistry extends RealtimeRegistry>(
  input: CreateRealtimeClientFoundationInput<TRegistry>,
) {
  const url =
    input.url ??
    (import.meta.env.VITE_REALTIME_URL?.trim() || DEFAULT_CLIENT_REALTIME_URL);
  const socket = io(url, {
    autoConnect: input.autoConnect ?? false,
  });
  const transport = createSocketIoClientTransport({
    socket,
  });
  const runtime = createClientRuntime({
    registry: input.registry,
    transport,
  });

  return {
    socket,
    transport,
    runtime,
  };
}
