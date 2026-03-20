import test from "node:test";
import assert from "node:assert/strict";
import {
  createMediaSignalingBridge,
  type VoiceSessionSignaledEventPayload,
} from "../src/media/signaling-bridge.js";
import type { MediaWebRtcTransportLike } from "../src/media/foundation.js";
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
    mediaType: "audio",
  });

  assert.ok(producerAvailable);
  assert.deepEqual(parsePayloadJson(producerAvailable.payloadJson), {
    producerId: "producer-1",
    producerUserId: "user-1",
    kind: "audio",
    mediaType: "audio",
  });

  assert.ok(producersSnapshot);
  assert.deepEqual(parsePayloadJson(producersSnapshot.payloadJson), {
    requestId: "sync-request",
    producers: [
      {
        producerId: "producer-1",
        producerUserId: "user-1",
        kind: "audio",
        mediaType: "audio",
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
    mediaType: "audio",
    rtpParameters: {
      codecs: [],
      encodings: [],
    },
    type: "simple",
  });
});

/**
 * Проверяется, что screen-share producer маркируется отдельно от audio producer
 * и проходит через signaling bridge с корректным `mediaType`.
 * Это важно, потому что клиент должен отличать демонстрацию экрана от обычного голоса,
 * иначе consume и UI не смогут правильно разложить медиа-потоки.
 * Граничные случаи: screen share публикуется как video-трек с appData.media=screen,
 * и snapshot/available/consume response обязаны сохранить эту семантику до клиента.
 */
test("should expose screen-share producer metadata and consume response to channel peers", async () => {
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

  await createPublishedScreenProducer(signalingBridge);
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
      signalType: "mediasoup.sync-producers.request",
      payloadJson: JSON.stringify({
        requestId: "sync-request",
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
  const consumeResponse = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.consume.response",
  );

  assert.ok(produceResponse);
  assert.deepEqual(parsePayloadJson(produceResponse.payloadJson), {
    requestId: "produce-request",
    producerId: "producer-1",
    kind: "video",
    mediaType: "screen",
  });

  assert.ok(producerAvailable);
  assert.deepEqual(parsePayloadJson(producerAvailable.payloadJson), {
    producerId: "producer-1",
    producerUserId: "user-1",
    kind: "video",
    mediaType: "screen",
  });

  assert.ok(producersSnapshot);
  assert.deepEqual(parsePayloadJson(producersSnapshot.payloadJson), {
    requestId: "sync-request",
    producers: [
      {
        producerId: "producer-1",
        producerUserId: "user-1",
        kind: "video",
        mediaType: "screen",
      },
    ],
  });

  assert.ok(consumeResponse);
  assert.deepEqual(parsePayloadJson(consumeResponse.payloadJson), {
    requestId: "consume-request",
    consumerId: "consumer-1",
    producerId: "producer-1",
    producerUserId: "user-1",
    kind: "video",
    mediaType: "screen",
    rtpParameters: {
      codecs: [],
      encodings: [],
    },
    type: "simple",
  });
});

/**
 * Проверяется, что остановка screen share завершает только screen-поток,
 * не затрагивая voice producer пользователя.
 * Это важно, потому что остановка демонстрации экрана не должна молча
 * выбивать пользователя из голосового медиа-контура.
 * Граничные случаи: у пользователя одновременно активны audio и screen producer-ы,
 * и после teardown snapshot для peer-а должен по-прежнему содержать только audio producer.
 */
test("should tear down only the screen-share producer without dropping audio", async () => {
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
  await createPublishedScreenProducer(signalingBridge, "transport-2");
  await signalingBridge.teardownUserScreenShare({
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
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

  const closedSignal = emittedSignals.find(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.producer.closed",
  );
  const producersSnapshot = emittedSignals.findLast(
    (event) =>
      event.targetUserId === "user-2" &&
      event.signalType === "mediasoup.producers.snapshot.response",
  );

  assert.ok(closedSignal);
  assert.deepEqual(parsePayloadJson(closedSignal.payloadJson), {
    producerId: "producer-2",
    producerUserId: "user-1",
  });

  assert.ok(producersSnapshot);
  assert.deepEqual(parsePayloadJson(producersSnapshot.payloadJson), {
    requestId: "sync-request",
    producers: [
      {
        producerId: "producer-1",
        producerUserId: "user-1",
        kind: "audio",
        mediaType: "audio",
      },
    ],
  });
});

async function createPublishedAudioProducer(
  signalingBridge: ReturnType<typeof createMediaSignalingBridge>,
  transportId = "transport-1",
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
        transportId,
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
        transportId,
        kind: "audio",
        rtpParameters: {
          codecs: [],
          encodings: [],
        },
      }),
    },
  });
}

async function createPublishedScreenProducer(
  signalingBridge: ReturnType<typeof createMediaSignalingBridge>,
  transportId = "transport-1",
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
        transportId,
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
        transportId,
        kind: "video",
        rtpParameters: {
          codecs: [],
          encodings: [],
        },
        appData: {
          media: "screen",
        },
      }),
    },
  });
}

function createMediaFoundationDouble() {
  let nextTransportId = 1;
  let nextProducerId = 1;
  let nextConsumerId = 1;
  const producerKinds = new Map<string, string>();

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
      transport: MediaWebRtcTransportLike;
      kind: string;
    }) {
      void input.transport;
      const producerId = `producer-${nextProducerId++}`;
      producerKinds.set(producerId, input.kind);

      return {
        id: producerId,
        kind: input.kind,
        async pause() {},
        async resume() {},
        close() {},
      };
    },
    async createConsumer(input: {
      transport: MediaWebRtcTransportLike;
      producerId: string;
    }) {
      void input.transport;
      const consumerId = `consumer-${nextConsumerId++}`;
      const kind = producerKinds.get(input.producerId) ?? "audio";

      return {
        id: consumerId,
        producerId: input.producerId,
        kind,
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
    async setProducerPaused() {},
    async setConsumerPaused() {},
    async close() {},
  };
}

function parsePayloadJson(payloadJson: string): unknown {
  return JSON.parse(payloadJson) as unknown;
}
