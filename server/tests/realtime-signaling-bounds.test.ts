import test from "node:test";
import assert from "node:assert/strict";
import {
  REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH,
  REALTIME_SIGNAL_TYPE_MAX_LENGTH,
} from "../src/realtime/contracts.js";
import { createMediaSignalingBridge } from "../src/media/signaling-bridge.js";

test("should reject oversized signaling payload before mediasoup handling", async () => {
  /**
   * Проверяется, что oversized signaling payload отсекается до JSON.parse
   * и до любых media foundation вызовов.
   * Это важно, потому что realtime command path не должен принимать практически
   * неограниченные строки и тратить память/CPU на заведомо небезопасный input.
   * Граничный случай: signal type валиден, presence тоже валиден,
   * а единственная проблема — превышение безопасной длины payloadJson.
   */
  let routerCapabilitiesRequested = false;

  const bridge = createMediaSignalingBridge({
    mediaFoundation: {
      getRouterRtpCapabilities: () => {
        routerCapabilitiesRequested = true;
        return {};
      },
    } as never,
    presenceRegistry: {
      getUserPresenceRecord: () => ({
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
        connectionId: "connection-1",
      }),
      getUserPresence: () => ({
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
      }),
    } as never,
    emitSignalEvent: async () => undefined,
  });

  await assert.rejects(
    () =>
      bridge.handleSignal({
        userId: "user-1",
        connectionId: "connection-1",
        command: {
          serverId: "server-1",
          channelId: "channel-1",
          targetUserId: null,
          signalType: "mediasoup.router-capabilities.request",
          payloadJson: "x".repeat(REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH + 1),
        },
      }),
    /Signaling payload превышает допустимый размер\./,
  );

  assert.equal(routerCapabilitiesRequested, false);
});

test("should reject oversized signaling type before mediasoup handling", async () => {
  /**
   * Проверяется, что oversized signal type тоже отсекается до начала media-логики.
   * Это важно, потому что даже короткий payload не должен позволять перегружать
   * realtime path неограниченными именами сигналов.
   * Граничный случай: payload корректный и маленький,
   * а нарушением является только длина signalType.
   */
  let signalEventEmitted = false;

  const bridge = createMediaSignalingBridge({
    mediaFoundation: {
      getRouterRtpCapabilities: () => ({}),
    } as never,
    presenceRegistry: {
      getUserPresenceRecord: () => ({
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
        connectionId: "connection-1",
      }),
      getUserPresence: () => ({
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
      }),
    } as never,
    emitSignalEvent: async () => {
      signalEventEmitted = true;
    },
  });

  await assert.rejects(
    () =>
      bridge.handleSignal({
        userId: "user-1",
        connectionId: "connection-1",
        command: {
          serverId: "server-1",
          channelId: "channel-1",
          targetUserId: null,
          signalType: "x".repeat(REALTIME_SIGNAL_TYPE_MAX_LENGTH + 1),
          payloadJson: "{}",
        },
      }),
    /Signal type превышает допустимый размер\./,
  );

  assert.equal(signalEventEmitted, false);
});
