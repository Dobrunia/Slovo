import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ClientRealtimeRuntimeError } from "../src/types/server";

const transportFactoryMock = vi.hoisted(() => vi.fn(() => ({ transport: "socket-io" })));
const createClientRuntimeMock = vi.hoisted(() => vi.fn());
const runtimeMock = vi.hoisted(() => ({
  destroy: vi.fn(),
  inspectConnection: vi.fn(() => ({
    state: "connecting",
    connected: false,
    transportBound: true,
  })),
  onConnectionState: vi.fn(() => vi.fn()),
  onEvent: vi.fn(() => vi.fn()),
  subscribeChannel: vi.fn(),
  unsubscribeChannel: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock("dobrunia-liverail-client", () => ({
  createClientRuntime: createClientRuntimeMock,
}));

vi.mock("dobrunia-liverail-client/socket-io", () => ({
  createSocketIoClientTransport: transportFactoryMock,
}));

describe("realtime runtime", () => {
  beforeEach(() => {
    createClientRuntimeMock.mockReset();
    createClientRuntimeMock.mockImplementation(() => runtimeMock as never);
    transportFactoryMock.mockClear();
    runtimeMock.destroy.mockReset();
    runtimeMock.inspectConnection.mockReset();
    runtimeMock.inspectConnection.mockReturnValue({
      state: "connecting",
      connected: false,
      transportBound: true,
    });
    runtimeMock.onConnectionState.mockReset();
    runtimeMock.onConnectionState.mockReturnValue(vi.fn());
    runtimeMock.onEvent.mockReset();
    runtimeMock.onEvent.mockImplementation(() => vi.fn());
    runtimeMock.subscribeChannel.mockReset();
    runtimeMock.subscribeChannel.mockResolvedValue(undefined);
    runtimeMock.unsubscribeChannel.mockReset();
    runtimeMock.unsubscribeChannel.mockResolvedValue(undefined);
    runtimeMock.executeCommand.mockReset();
    runtimeMock.executeCommand.mockResolvedValue({
      accepted: true,
      acknowledgedAt: "2026-03-20T12:00:00.000Z",
    });
  });

  afterEach(async () => {
    const runtimeModule = await import("../src/realtime/runtime");
    runtimeModule.clearRealtimeRuntimeError();
    runtimeModule.resetRealtimeRuntime();
  });

  test("should avoid registering event listeners when channel subscription fails", async () => {
    /*
     * Проверяется, что client-side subscribe helper не навешивает event listeners
     * до успешного subscribeChannel и не оставляет listener leak после ошибки подписки.
     * Это важно, потому что временные realtime-сбои иначе копят дублирующие обработчики
     * и создают ложные симптомы нестабильности live-экрана.
     * Граничный случай: subscribeChannel падает сразу, поэтому onEvent не должен вызываться вообще.
     */
    runtimeMock.subscribeChannel.mockRejectedValueOnce(new Error("subscribe failed"));

    const runtimeModule = await import("../src/realtime/runtime");

    await expect(
      runtimeModule.subscribeToServerStructure({
        sessionToken: "session-token",
        serverId: "server-1",
        onServerUpdated: vi.fn(),
        onChannelsUpdated: vi.fn(),
      }),
    ).rejects.toThrow("subscribe failed");

    expect(runtimeMock.onEvent).not.toHaveBeenCalled();
  });

  test("should publish structured command errors into the shared realtime error channel", async () => {
    /*
     * Проверяется, что realtime command failure больше не остается только исключением
     * в вызывающем коде и одновременно попадает в единый app-side error channel.
     * Это важно, потому что UI/store должны видеть transport/signaling проблемы,
     * а не создавать ложное ощущение надежности при наличии ошибки только в консоли.
     * Граничный случай: runtime уже создан, команда падает синхронно на executeCommand,
     * а subscriber error channel должен получить нормализованный payload с scope=command.
     */
    runtimeMock.executeCommand.mockRejectedValueOnce(new Error("Command failed."));

    const runtimeModule = await import("../src/realtime/runtime");
    const observedErrors: Array<ClientRealtimeRuntimeError | null> = [];
    const stopRealtimeErrors = runtimeModule.subscribeToRealtimeErrors((error) => {
      observedErrors.push(error);
    });

    await expect(
      runtimeModule.executeJoinVoiceChannelCommand({
        sessionToken: "session-token",
        serverId: "server-1",
        channelId: "channel-1",
      }),
    ).rejects.toThrow("Command failed.");

    expect(observedErrors.at(-1)).toMatchObject({
      scope: "command",
      message: "Command failed.",
      recoverable: true,
    });

    stopRealtimeErrors();
  });

  test("should publish structured transport errors from the runtime integration", async () => {
    /*
     * Проверяется, что low-level transport/runtime error больше не уходит только в console,
     * а нормализуется в shared realtime error channel.
     * Это важно, потому что reconnect и cleanup логика должны иметь один источник истины
     * по runtime-сбоям вместо неструктурированных сообщений в devtools.
     * Граничный случай: createClientRuntime получает onError callback один раз при инициализации,
     * и именно он должен эмитить transport-ошибку в app-side подписчиков.
     */
    let capturedOnError: ((error: unknown) => void) | null = null;

    createClientRuntimeMock.mockImplementation((config: { onError?: (error: unknown) => void }) => {
      capturedOnError = config.onError ?? null;
      return runtimeMock as never;
    });

    const runtimeModule = await import("../src/realtime/runtime");
    const observedErrors: Array<ClientRealtimeRuntimeError | null> = [];
    const stopRealtimeErrors = runtimeModule.subscribeToRealtimeErrors((error) => {
      observedErrors.push(error);
    });

    runtimeModule.ensureRealtimeRuntime("session-token");
    if (!capturedOnError) {
      throw new Error("Runtime onError handler was not captured.");
    }

    const runtimeOnError = capturedOnError as (error: unknown) => void;
    runtimeOnError(new Error("Transport failed."));

    expect(observedErrors.at(-1)).toMatchObject({
      scope: "transport",
      message: "Transport failed.",
      recoverable: true,
    });

    stopRealtimeErrors();
  });
});
