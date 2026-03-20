import type {
  ClientRealtimeRuntimeError,
  ClientRealtimeRuntimeErrorScope,
} from "../types/server";

type RealtimeErrorListener = (error: ClientRealtimeRuntimeError | null) => void;

const realtimeErrorListeners = new Set<RealtimeErrorListener>();
let currentRealtimeError: ClientRealtimeRuntimeError | null = null;

/**
 * Подписывает клиента на текущее состояние realtime-ошибок.
 */
export function subscribeToRealtimeErrors(
  listener: RealtimeErrorListener,
): () => void {
  realtimeErrorListeners.add(listener);
  listener(currentRealtimeError);

  return () => {
    realtimeErrorListeners.delete(listener);
  };
}

/**
 * Публикует структурированную realtime-ошибку для store/UI.
 */
export function reportRealtimeError(
  error: ClientRealtimeRuntimeError,
): void {
  currentRealtimeError = error;
  notifyRealtimeErrorListeners();
}

/**
 * Очищает текущую realtime-ошибку по scope или полностью.
 */
export function clearRealtimeError(
  scope?: ClientRealtimeRuntimeErrorScope,
): void {
  if (!currentRealtimeError) {
    return;
  }

  if (scope && currentRealtimeError.scope !== scope) {
    return;
  }

  currentRealtimeError = null;
  notifyRealtimeErrorListeners();
}

/**
 * Нормализует неизвестную ошибку transport/runtime в структурированный client-side формат.
 */
export function createRealtimeRuntimeError(input: {
  scope: ClientRealtimeRuntimeErrorScope;
  error: unknown;
  fallbackMessage: string;
  recoverable?: boolean;
}): ClientRealtimeRuntimeError {
  return {
    scope: input.scope,
    message:
      input.error instanceof Error && input.error.message
        ? input.error.message
        : input.fallbackMessage,
    recoverable: input.recoverable ?? true,
    occurredAt: new Date().toISOString(),
  };
}

function notifyRealtimeErrorListeners(): void {
  for (const listener of realtimeErrorListeners) {
    listener(currentRealtimeError);
  }
}
