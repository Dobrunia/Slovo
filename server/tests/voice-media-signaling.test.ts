import test from "node:test";
import assert from "node:assert/strict";
import {
  createMediaSignalingBridge,
  type VoiceSessionSignaledEventPayload,
} from "../src/media/signaling-bridge.js";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";

/**
 * Проверяется, что после server-side produce в signaling bridge
 * владелец получает подтверждение создания producer, а остальные
 * участники того же канала получают live-уведомление о доступном producer.
 * Это важно, потому что без такого fan-out новый аудиопоток не станет
 * видимым другим участникам канала и consume не сможет стартовать.
 * Граничные случаи: уведомление не должно уходить самому владельцу producer
 * как обычное channel-wide событие, а late-join sync должен возвращать
 * уже созданный producer по явному запросу snapshot.
 */
test("should create an audio producer and expose it to peers in the same channel", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });
  presenceRegistry.setPresence({
    userId: "user-2",
    displayName: "Алиса",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });

  const emittedSignals: VoiceSessionSignaledEventPayload[] = [];
  const mediaFoundation = createMediaFoundationDouble();
  const signalingBridge = createMediaSignalingBridge({
    mediaFoundation,
    presenceRegistry,
    emitSignalEvent(payload) {
      emittedSignals.push(payload);
    },
  });

  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.create.request",
      payloadJson: JSON.stringify({
        requestId: "send-transport-request",
        direction: "send",
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.connect.request",
      payloadJson: JSON.stringify({
        requestId: "send-connect-request",
        transportId: "transport-1",
        dtlsParameters: {
          fingerprints: [],
          role: "auto",
        },
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.produce.request",
      payloadJson: JSON.stringify({
        requestId: "produce-request",
        transportId: "transport-1",
        kind: "audio",
        rtpParameters: {
          codecs: [],
          encodings: [],
        },
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-2",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.sync-producers.request",
      payloadJson: JSON.stringify({
        requestId: "sync-request",
      }),
    },
  });

  const produceResponse = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-1" &&
      event.signalType === "mediasoup.produce.response",
  );
  const producerAvailable = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.producer.available",
  );
  const producersSnapshot = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.producers.snapshot.response",
  );

  assert.ok(produceResponse);
  assert.deepEqual(parsePayloadJson(produceResponse.payloadJson), {
    requestId: "produce-request",
    producerId: "producer-1",
    kind: "audio",
  });

  assert.ok(producerAvailable);
  assert.deepEqual(parsePayloadJson(producerAvailable.payloadJson), {
    producerId: "producer-1",
    producerUserId: "user-1",
    kind: "audio",
  });

  assert.ok(producersSnapshot);
  assert.deepEqual(parsePayloadJson(producersSnapshot.payloadJson), {
    requestId: "sync-request",
    producers: [
      {
        producerId: "producer-1",
        producerUserId: "user-1",
        kind: "audio",
      },
    ],
  });
});

/**
 * Проверяется, что второй участник канала может создать recv transport
 * и получить корректный consume-response по уже опубликованному audio producer.
 * Это важно, потому что именно этот шаг превращает signaling bridge
 * из transport-only заготовки в реальный voice media flow.
 * Граничные случаи: consume должен быть привязан к правильному recv transport,
 * к producer из того же канала и вернуть producerUserId для клиентского связывания.
 */
test("should create a consumer response for another participant in the same channel", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });
  presenceRegistry.setPresence({
    userId: "user-2",
    displayName: "Алиса",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });

  const emittedSignals: VoiceSessionSignaledEventPayload[] = [];
  const mediaFoundation = createMediaFoundationDouble();
  const signalingBridge = createMediaSignalingBridge({
    mediaFoundation,
    presenceRegistry,
    emitSignalEvent(payload) {
      emittedSignals.push(payload);
    },
  });

  await createPublishedAudioProducer(signalingBridge);

  await signalingBridge.handleSignal({
    userId: "user-2",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.create.request",
      payloadJson: JSON.stringify({
        requestId: "recv-transport-request",
        direction: "recv",
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-2",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.connect.request",
      payloadJson: JSON.stringify({
        requestId: "recv-connect-request",
        transportId: "transport-2",
        dtlsParameters: {
          fingerprints: [],
          role: "auto",
        },
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-2",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.consume.request",
      payloadJson: JSON.stringify({
        requestId: "consume-request",
        transportId: "transport-2",
        producerId: "producer-1",
        rtpCapabilities: {
          codecs: [],
          headerExtensions: [],
        },
      }),
    },
  });

  const consumeResponse = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.consume.response",
  );

  assert.ok(consumeResponse);
  assert.deepEqual(parsePayloadJson(consumeResponse.payloadJson), {
    requestId: "consume-request",
    consumerId: "consumer-1",
    producerId: "producer-1",
    producerUserId: "user-1",
    kind: "audio",
    rtpParameters: {
      codecs: [],
      encodings: [],
    },
    type: "simple",
  });
});

async function createPublishedAudioProducer(
  signalingBridge: ReturnType<typeof createMediaSignalingBridge>,
): Promise<void> {
  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.create.request",
      payloadJson: JSON.stringify({
        requestId: "send-transport-request",
        direction: "send",
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.transport.connect.request",
      payloadJson: JSON.stringify({
        requestId: "send-connect-request",
        transportId: "transport-1",
        dtlsParameters: {
          fingerprints: [],
          role: "auto",
        },
      }),
    },
  });
  await signalingBridge.handleSignal({
    userId: "user-1",
    command: {
      serverId: "server-1",
      channelId: "channel-1",
      targetUserId: null,
      signalType: "mediasoup.produce.request",
      payloadJson: JSON.stringify({
        requestId: "produce-request",
        transportId: "transport-1",
        kind: "audio",
        rtpParameters: {
          codecs: [],
          encodings: [],
        },
      }),
    },
  });
}

function createMediaFoundationDouble() {
  let nextTransportId = 1;
  let nextProducerId = 1;
  let nextConsumerId = 1;

  return {
    worker: {
      close() {},
      async createRouter() {
        throw new Error("Not implemented in test double.");
      },
    },
    router: {
      rtpCapabilities: {
        codecs: [],
      },
      close() {},
      async createWebRtcTransport() {
        throw new Error("Not implemented in test double.");
      },
      canConsume() {
        return true;
      },
    },
    getRouterRtpCapabilities() {
      return {
        codecs: [],
      };
    },
    async createWebRtcTransport() {
      const transportId = `transport-${nextTransportId++}`;

      return {
        transport: {
          id: transportId,
          iceParameters: {
            usernameFragment: "user",
          },
          iceCandidates: [],
          dtlsParameters: {
            role: "auto",
          },
          async connect() {},
          async setMaxIncomingBitrate() {},
          async produce() {
            const producerId = `producer-${nextProducerId++}`;

            return {
              id: producerId,
              kind: "audio",
              async pause() {},
              async resume() {},
              close() {},
            };
          },
          async consume() {
            const consumerId = `consumer-${nextConsumerId++}`;

            return {
              id: consumerId,
              producerId: "producer-1",
              kind: "audio",
              rtpParameters: {
                codecs: [],
                encodings: [],
              },
              type: "simple",
              async pause() {},
              async resume() {},
              close() {},
            };
          },
          close() {},
        },
        params: {
          id: transportId,
          iceParameters: {
            usernameFragment: "user",
          },
          iceCandidates: [],
          dtlsParameters: {
            role: "auto",
          },
          sctpParameters: null,
        },
      };
    },
    async connectWebRtcTransport() {},
    canConsume() {
      return true;
    },
    async createProducer(input: {
      transport: { produce: () => Promise<unknown> };
    }) {
      return input.transport.produce();
    },
    async createConsumer(input: {
      transport: { consume: () => Promise<unknown> };
    }) {
      return input.transport.consume();
    },
    async setProducerPaused() {},
    async setConsumerPaused() {},
    async close() {},
  };
}

function parsePayloadJson(payloadJson: string): unknown {
  return JSON.parse(payloadJson) as unknown;
}
