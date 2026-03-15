import { slovoRealtimeRegistry } from "./contracts";
import { createRealtimeClientFoundation } from "./foundation";

type CreateSlovoRealtimeClientInput = {
  url?: string;
  autoConnect?: boolean;
};

/**
 * Поднимает клиентский realtime foundation проекта на общем shared registry.
 */
export function createSlovoRealtimeClient(input: CreateSlovoRealtimeClientInput = {}) {
  return createRealtimeClientFoundation({
    registry: slovoRealtimeRegistry,
    url: input.url,
    autoConnect: input.autoConnect,
  });
}
