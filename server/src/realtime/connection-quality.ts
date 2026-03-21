import type { RealtimeConnectionQuality } from "../../../shared/realtime/connection-quality.js";

/**
 * Request-scoped registry последнего известного качества соединения по пользователям.
 */
export type RuntimeConnectionQualityRegistry = Map<string, RealtimeConnectionQuality | null>;

/**
 * Создает registry качества соединения для realtime foundation.
 */
export function createRuntimeConnectionQualityRegistry(): RuntimeConnectionQualityRegistry {
  return new Map<string, RealtimeConnectionQuality | null>();
}

/**
 * Возвращает последнее известное качество соединения пользователя.
 */
export function readRuntimeConnectionQuality(
  registry: RuntimeConnectionQualityRegistry,
  userId: string,
): RealtimeConnectionQuality | null {
  return registry.get(userId) ?? null;
}

/**
 * Сохраняет новое качество соединения пользователя в runtime registry.
 */
export function writeRuntimeConnectionQuality(
  registry: RuntimeConnectionQualityRegistry,
  userId: string,
  connectionQuality: RealtimeConnectionQuality | null,
): RealtimeConnectionQuality | null {
  registry.set(userId, connectionQuality);
  return connectionQuality;
}

/**
 * Очищает состояние качества соединения пользователя после leave/disconnect.
 */
export function clearRuntimeConnectionQuality(
  registry: RuntimeConnectionQualityRegistry,
  userId: string,
): void {
  registry.delete(userId);
}

/**
 * Валидирует и извлекает качество соединения из JSON payload realtime-команды.
 */
export function readConnectionQualityPayload(payloadJson: string): RealtimeConnectionQuality {
  const parsedPayload = parsePayloadJson(payloadJson) as {
    quality?: unknown;
  };

  if (
    parsedPayload.quality !== "low" &&
    parsedPayload.quality !== "med" &&
    parsedPayload.quality !== "good"
  ) {
    throw new Error("Некорректный payload качества соединения.");
  }

  return parsedPayload.quality;
}

/**
 * Извлекает булев speaking-state из JSON payload realtime-команды.
 */
export function readSpeakingStatePayload(payloadJson: string): boolean {
  const parsedPayload = parsePayloadJson(payloadJson) as {
    speaking?: unknown;
  };

  if (typeof parsedPayload.speaking !== "boolean") {
    throw new Error("Некорректный payload состояния речи.");
  }

  return parsedPayload.speaking;
}

/**
 * Безопасно парсит JSON payload realtime-сигнала.
 */
function parsePayloadJson(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson);
  } catch {
    throw new Error("Некорректный JSON payload realtime-сигнала.");
  }
}
