import type { Server as HttpServer } from "node:http";
import type { DataLayer } from "../data/prisma.js";
import type { MediaFoundation } from "../media/foundation.js";
import { createRealtimeServerContext } from "./foundation.js";
import { slovoRealtimeRegistry } from "./contracts.js";
import { createRealtimeServerFoundation } from "./foundation.js";

type CreateSlovoRealtimeServerInput = {
  httpServer: HttpServer;
  dataLayer: DataLayer;
  mediaFoundation: MediaFoundation;
  clientOrigin?: string;
};

/**
 * Поднимает серверный realtime foundation проекта на общем shared registry.
 */
export function createSlovoRealtimeServer(input: CreateSlovoRealtimeServerInput) {
  return createRealtimeServerFoundation({
    httpServer: input.httpServer,
    dataLayer: input.dataLayer,
    mediaFoundation: input.mediaFoundation,
    clientOrigin: input.clientOrigin,
    registry: slovoRealtimeRegistry,
  });
}

/**
 * Публичный тип runtime серверного realtime-слоя проекта.
 */
export type SlovoRealtimeRuntime = ReturnType<typeof createSlovoRealtimeServer>["runtime"];

/**
 * Эмитит серверное realtime-событие вне live-сокет-контекста, например из GraphQL-мутаций.
 */
export async function emitSystemRealtimeEvent(
  runtime: SlovoRealtimeRuntime,
  ...args: Parameters<SlovoRealtimeRuntime["emitEvent"]> extends [infer TName, infer TPayload, infer TContext]
    ? [name: TName, payload: TPayload]
    : never
) {
  return runtime.emitEvent(
    args[0],
    args[1],
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
    } as Parameters<SlovoRealtimeRuntime["emitEvent"]>[2],
  );
}
