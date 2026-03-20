import { describe, expect, test, vi } from "vitest";
import {
  applyRealtimeConnectionSnapshot,
  createRealtimeConnectionRecoveryState,
} from "../src/realtime/connectionRecovery";

describe("realtime connection recovery", () => {
  test("should ignore the initial disconnected snapshot before the first successful connection", () => {
    /*
     * Проверяется стартовый lifecycle runtime-а: transport еще не подключился,
     * но это не должно считаться реальным обрывом соединения и не должно запускать cleanup.
     * Это важно, потому что иначе клиент при обычной загрузке страницы
     * будет сам себе очищать presence и ломать voice-flow до первого connect.
     * Граничные случаи: transport уже привязан, но connected=false и previous connect еще не было.
     */
    const onDisconnected = vi.fn();
    const onReconnected = vi.fn();

    const nextState = applyRealtimeConnectionSnapshot({
      state: createRealtimeConnectionRecoveryState(),
      snapshot: {
        state: "connecting",
        connected: false,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    expect(nextState).toEqual({
      hasConnected: false,
      recoveryPending: false,
    });
    expect(onDisconnected).not.toHaveBeenCalled();
    expect(onReconnected).not.toHaveBeenCalled();
  });

  test("should emit disconnect cleanup only once after a real connection loss", () => {
    /*
     * Проверяется основной reconnect edge case: клиент уже был подключен,
     * после чего соединение теряется и runtime присылает несколько подряд disconnected snapshot-ов.
     * Это важно, потому что cleanup voice presence и teardown media должны запускаться ровно один раз,
     * иначе легко получить повторные локальные сбросы, гонки и лишние ошибки в UI.
     * Граничные случаи: первое disconnected-событие после connect и повторный disconnected без recovery между ними.
     */
    const onDisconnected = vi.fn();
    const onReconnected = vi.fn();

    const connectedState = applyRealtimeConnectionSnapshot({
      state: createRealtimeConnectionRecoveryState(),
      snapshot: {
        state: "connected",
        connected: true,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    const disconnectedState = applyRealtimeConnectionSnapshot({
      state: connectedState,
      snapshot: {
        state: "disconnected",
        previousState: "connected",
        connected: false,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    const repeatedDisconnectedState = applyRealtimeConnectionSnapshot({
      state: disconnectedState,
      snapshot: {
        state: "reconnecting",
        previousState: "disconnected",
        connected: false,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    expect(onReconnected).not.toHaveBeenCalled();
    expect(repeatedDisconnectedState).toEqual({
      hasConnected: false,
      recoveryPending: true,
    });
  });

  test("should emit recovery only after a previously connected runtime reconnects", () => {
    /*
     * Проверяется обратная половина recovery-цикла: после реального обрыва
     * первый успешный reconnect должен триггерить единственный recovery callback.
     * Это важно, потому что именно в этот момент клиент должен переснять snapshot-ы сервера
     * и синхронизировать экран после потери live-событий.
     * Граничные случаи: reconnect происходит только после уже зафиксированного disconnect,
     * а повторный connected snapshot не должен дублировать recovery.
     */
    const onDisconnected = vi.fn();
    const onReconnected = vi.fn();

    const disconnectedState = applyRealtimeConnectionSnapshot({
      state: {
        hasConnected: true,
        recoveryPending: false,
      },
      snapshot: {
        state: "disconnected",
        previousState: "connected",
        connected: false,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    const recoveredState = applyRealtimeConnectionSnapshot({
      state: disconnectedState,
      snapshot: {
        state: "connected",
        previousState: "reconnecting",
        connected: true,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    const repeatedConnectedState = applyRealtimeConnectionSnapshot({
      state: recoveredState,
      snapshot: {
        state: "connected",
        previousState: "connected",
        connected: true,
        transportBound: true,
      },
      onDisconnected,
      onReconnected,
    });

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(repeatedConnectedState).toEqual({
      hasConnected: true,
      recoveryPending: false,
    });
  });
});
