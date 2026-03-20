import type { ClientConnectionLifecycleSnapshot } from "dobrunia-liverail-client";

/**
 * Служебное состояние client-side recovery-логики realtime transport-а.
 */
export interface RealtimeConnectionRecoveryState {
  hasConnected: boolean;
  recoveryPending: boolean;
}

/**
 * Входные параметры обработки очередного snapshot-а realtime-соединения.
 */
export interface ApplyRealtimeConnectionSnapshotInput {
  state: RealtimeConnectionRecoveryState;
  snapshot: ClientConnectionLifecycleSnapshot;
  onDisconnected(): void;
  onReconnected(): void;
}

/**
 * Создает начальное состояние recovery-логики realtime-соединения.
 */
export function createRealtimeConnectionRecoveryState(): RealtimeConnectionRecoveryState {
  return {
    hasConnected: false,
    recoveryPending: false,
  };
}

/**
 * Обрабатывает очередной snapshot transport lifecycle и детерминированно решает,
 * нужно ли запускать cleanup при потере соединения и recovery после восстановления.
 */
export function applyRealtimeConnectionSnapshot(
  input: ApplyRealtimeConnectionSnapshotInput,
): RealtimeConnectionRecoveryState {
  if (!input.snapshot.transportBound) {
    return input.state;
  }

  if (input.snapshot.connected) {
    if (input.state.recoveryPending) {
      input.onReconnected();
    }

    return {
      hasConnected: true,
      recoveryPending: false,
    };
  }

  if (input.state.hasConnected && !input.state.recoveryPending) {
    input.onDisconnected();

    return {
      hasConnected: false,
      recoveryPending: true,
    };
  }

  return input.state;
}
