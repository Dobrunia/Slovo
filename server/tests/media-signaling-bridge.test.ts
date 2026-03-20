import assert from "node:assert/strict";
import test from "node:test";
import { createMediaSignalingBridge } from "../src/media/signaling-bridge.js";
import type { RuntimePresenceRegistry } from "../src/realtime/presence.js";

test("should respond with router capabilities and WebRTC transport params through the signaling bridge", async () => {
  /*
   * Проверяем основной signaling flow между LiveRail и MediaSoup:
   * сначала клиент должен получить router capabilities, затем создать
   * transport и получить его сериализуемые параметры. Это базовый мост
   * между live-командой и media foundation без запуска реального media flow.
   */
  const emittedSignals: Array<Record<string, unknown>> = [];
  const createdTransportIds: string[] = [];

  const bridge = createMediaSignalingBridge({
    mediaFoundation: {
      worker: {} as never,
      router: {} as never,
      getRouterRtpCapabilities() {
        return {
          codecs: ["opus", "vp8"],
        };
      },
      async createWebRtcTransport() {
        createdTransportIds.push("transport-1");
        return {
          transport: {
            id: "transport-1",
            iceParameters: {},
            iceCandidates: [],
            dtlsParameters: {},
            async connect() {},
            close() {},
          },
          params: {
            id: "transport-1",
            iceParameters: {},
            iceCandidates: [],
            dtlsParameters: {},
            sctpParameters: null,
          },
        };
      },
      async connectWebRtcTransport() {},
      async close() {},
    },
    presenceRegistry: {
      getUserPresence(userId: string) {
        if (userId !== "user-1") {
          return null;
        }

        return {
          userId: "user-1",
          serverId: "server-1",
          channelId: "channel-1",
          displayName: "Dobrynya",
          avatarUrl: null,
          joinedAt: "2026-03-19T10:00:00.000Z",
          connectionId: "connection-1",
        };
      },
      getUserPresenceRecord(userId: string) {
        return this.getUserPresence(userId);
      },
      clearPresence() {
        return null;
      },
    } as RuntimePresenceRegistry,
    emitSignalEvent(payload) {
      emittedSignals.push(payload);
    },
  });

  await bridge.handleSignal({
    userId: "user-1",
    connectionId: "connection-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.router-capabilities.request",
      payloadJson: "{}",
    },
  });
  await bridge.handleSignal({
    userId: "user-1",
    connectionId: "connection-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.create.request",
      payloadJson: JSON.stringify({
        direction: "send",
      }),
    },
  });

  assert.equal(createdTransportIds.length, 1);
  assert.equal(emittedSignals.length, 2);
  assert.equal(
    emittedSignals[0]?.signalType,
    "mediasoup.router-capabilities.response",
  );
  assert.equal(emittedSignals[0]?.targetUserId, "user-1");
  assert.equal(emittedSignals[1]?.signalType, "mediasoup.transport.create.response");
  assert.equal(emittedSignals[1]?.targetUserId, "user-1");
});

test("should connect only the owner's transport and acknowledge the signaling command", async () => {
  /*
   * Проверяем, что connect transport идет только по transport-у текущего пользователя
   * и в рамках его активного канала. Это важно, чтобы signaling нельзя было применить
   * к чужому transport id или к transport-у из другого channel context.
   */
  const connectCalls: unknown[] = [];
  const emittedSignals: Array<Record<string, unknown>> = [];

  const bridge = createMediaSignalingBridge({
    mediaFoundation: {
      worker: {} as never,
      router: {} as never,
      getRouterRtpCapabilities() {
        return {};
      },
      async createWebRtcTransport() {
        return {
          transport: {
            id: "transport-2",
            iceParameters: {},
            iceCandidates: [],
            dtlsParameters: {},
            async connect(options: { dtlsParameters: unknown }) {
              connectCalls.push(options.dtlsParameters);
            },
            close() {},
          },
          params: {
            id: "transport-2",
            iceParameters: {},
            iceCandidates: [],
            dtlsParameters: {},
            sctpParameters: null,
          },
        };
      },
      async connectWebRtcTransport(transport, dtlsParameters) {
        await transport.connect({
          dtlsParameters,
        });
      },
      async close() {},
    },
    presenceRegistry: {
      getUserPresence() {
        return {
          userId: "user-1",
          serverId: "server-1",
          channelId: "channel-1",
          displayName: "Dobrynya",
          avatarUrl: null,
          joinedAt: "2026-03-19T10:00:00.000Z",
          connectionId: "connection-1",
        };
      },
      getUserPresenceRecord() {
        return this.getUserPresence();
      },
      clearPresence() {
        return null;
      },
    } as RuntimePresenceRegistry,
    emitSignalEvent(payload) {
      emittedSignals.push(payload);
    },
  });

  await bridge.handleSignal({
    userId: "user-1",
    connectionId: "connection-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.create.request",
      payloadJson: "{}",
    },
  });
  const ack = await bridge.handleSignal({
    userId: "user-1",
    connectionId: "connection-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.connect.request",
      payloadJson: JSON.stringify({
        transportId: "transport-2",
        dtlsParameters: {
          fingerprints: [],
        },
      }),
    },
  });

  assert.equal(ack.accepted, true);
  assert.equal(connectCalls.length, 1);
  assert.equal(emittedSignals[1]?.signalType, "mediasoup.transport.connect.response");
});

test("should reject signaling from a user who is not in the active voice channel", async () => {
  /*
   * Проверяем граничный случай безопасности: signaling нельзя принимать от пользователя,
   * который не находится в канале. Иначе можно отправлять media-сигналы в обход runtime
   * presence и получить рассинхронизацию между live-state и media transport состоянием.
   */
  const bridge = createMediaSignalingBridge({
    mediaFoundation: {
      worker: {} as never,
      router: {} as never,
      getRouterRtpCapabilities() {
        return {};
      },
      async createWebRtcTransport() {
        throw new Error("unreachable");
      },
      async connectWebRtcTransport() {
        throw new Error("unreachable");
      },
      async close() {},
    },
    presenceRegistry: {
      getUserPresence() {
        return null;
      },
      getUserPresenceRecord() {
        return null;
      },
      clearPresence() {
        return null;
      },
    } as RuntimePresenceRegistry,
    emitSignalEvent() {
      throw new Error("unreachable");
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
          signalType: "mediasoup.router-capabilities.request",
          payloadJson: "{}",
        },
      }),
    /Signaling доступен только из активного канала пользователя/u,
  );
});
