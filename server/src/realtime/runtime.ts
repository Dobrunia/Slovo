import type { Server as HttpServer } from "node:http";
import { slovoRealtimeRegistry } from "./contracts.js";
import { createRealtimeServerFoundation } from "./foundation.js";

type CreateSlovoRealtimeServerInput = {
  httpServer: HttpServer;
  clientOrigin?: string;
};

/**
 * Поднимает серверный realtime foundation проекта на общем shared registry.
 */
export function createSlovoRealtimeServer(input: CreateSlovoRealtimeServerInput) {
  return createRealtimeServerFoundation({
    httpServer: input.httpServer,
    clientOrigin: input.clientOrigin,
    registry: slovoRealtimeRegistry,
  });
}

/**
 * Публичный тип runtime серверного realtime-слоя проекта.
 */
export type SlovoRealtimeRuntime = ReturnType<typeof createSlovoRealtimeServer>["runtime"];
