import type { RuntimePresenceRegistry } from "../realtime/presence.js";
import type {
  MediaConsumerLike,
  MediaFoundation,
  MediaProducerLike,
  MediaWebRtcTransportLike,
} from "./foundation.js";

/**
 * Входные данные signaling-команды, приходящей через LiveRail.
 */
export interface VoiceSignalCommandInput {
  serverId: string;
  channelId: string;
  targetUserId: string | null;
  signalType: string;
  payloadJson: string;
}

/**
 * Payload серверного signaling-события, которое доставляется через LiveRail.
 */
export interface VoiceSessionSignaledEventPayload {
  serverId: string;
  channelId: string;
  sourceUserId: string;
  targetUserId: string | null;
  signalType: string;
  payloadJson: string;
  occurredAt: string;
}

/**
 * Ack-ответ signaling-команды.
 */
export interface VoiceSignalCommandAck {
  accepted: true;
  acknowledgedAt: string;
}

type TransportDirection = "send" | "recv";

type TransportRecord = {
  serverId: string;
  channelId: string;
  ownerUserId: string;
  direction: TransportDirection;
  transport: MediaWebRtcTransportLike;
};

type ProducerRecord = {
  serverId: string;
  channelId: string;
  ownerUserId: string;
  producer: MediaProducerLike;
};

type ConsumerRecord = {
  serverId: string;
  channelId: string;
  ownerUserId: string;
  producerId: string;
  consumer: MediaConsumerLike;
};

/**
 * Параметры создания signaling bridge между LiveRail и MediaSoup.
 */
export interface CreateMediaSignalingBridgeInput {
  mediaFoundation: MediaFoundation;
  presenceRegistry: RuntimePresenceRegistry;
  emitSignalEvent(payload: VoiceSessionSignaledEventPayload): Promise<unknown> | unknown;
}

/**
 * Публичный контракт signaling bridge проекта.
 */
export interface MediaSignalingBridge {
  handleSignal(input: {
    userId: string;
    command: VoiceSignalCommandInput;
  }): Promise<VoiceSignalCommandAck>;
  teardownUserSession(input: {
    userId: string;
    serverId: string;
    channelId: string;
  }): Promise<void>;
  applyVoiceState(input: {
    userId: string;
    serverId: string;
    channelId: string;
    muted: boolean;
    deafened: boolean;
  }): Promise<void>;
}

/**
 * Связывает LiveRail signaling-команды с MediaSoup foundation.
 */
export function createMediaSignalingBridge(
  input: CreateMediaSignalingBridgeInput,
): MediaSignalingBridge {
  const transportRegistry = new Map<string, TransportRecord>();
  const producerRegistry = new Map<string, ProducerRecord>();
  const consumerRegistry = new Map<string, ConsumerRecord>();

  return {
    async handleSignal({ userId, command }) {
      assertUserInChannel({
        userId,
        serverId: command.serverId,
        channelId: command.channelId,
        presenceRegistry: input.presenceRegistry,
      });

      if (command.targetUserId) {
        assertTargetUserInChannel({
          userId: command.targetUserId,
          serverId: command.serverId,
          channelId: command.channelId,
          presenceRegistry: input.presenceRegistry,
        });
      }

      switch (command.signalType) {
        case "mediasoup.router-capabilities.request": {
          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.router-capabilities.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: input.mediaFoundation.getRouterRtpCapabilities(),
          });
          break;
        }

        case "mediasoup.transport.create.request": {
          const payload = parseSignalPayload<{
            requestId?: string;
            direction?: TransportDirection;
          }>(command.payloadJson);
          const createdTransport = await input.mediaFoundation.createWebRtcTransport();
          const direction = payload.direction ?? "send";

          transportRegistry.set(createdTransport.transport.id, {
            serverId: command.serverId,
            channelId: command.channelId,
            ownerUserId: userId,
            direction,
            transport: createdTransport.transport,
          });

          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.transport.create.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: {
              ...createdTransport.params,
              direction,
            },
          });
          break;
        }

        case "mediasoup.transport.connect.request": {
          const payload = parseSignalPayload<{
            requestId?: string;
            transportId: string;
            dtlsParameters: unknown;
          }>(command.payloadJson);
          const transportRecord = requireOwnedTransport({
            transportRegistry,
            transportId: payload.transportId,
            ownerUserId: userId,
            serverId: command.serverId,
            channelId: command.channelId,
          });

          await input.mediaFoundation.connectWebRtcTransport(
            transportRecord.transport,
            payload.dtlsParameters,
          );
          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.transport.connect.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: {
              transportId: payload.transportId,
              connected: true,
            },
          });
          break;
        }

        case "mediasoup.produce.request": {
          const payload = parseSignalPayload<{
            requestId?: string;
            transportId: string;
            kind: string;
            rtpParameters: unknown;
            appData?: Record<string, unknown>;
          }>(command.payloadJson);
          const transportRecord = requireOwnedTransport({
            transportRegistry,
            transportId: payload.transportId,
            ownerUserId: userId,
            serverId: command.serverId,
            channelId: command.channelId,
            direction: "send",
          });
          const producer = await input.mediaFoundation.createProducer({
            transport: transportRecord.transport,
            kind: payload.kind,
            rtpParameters: payload.rtpParameters,
            appData: payload.appData,
          });

          producerRegistry.set(producer.id, {
            serverId: command.serverId,
            channelId: command.channelId,
            ownerUserId: userId,
            producer,
          });

          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.produce.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: {
              producerId: producer.id,
              kind: producer.kind,
            },
          });

          await emitProducerAvailable({
            emitSignalEvent: input.emitSignalEvent,
            presenceRegistry: input.presenceRegistry,
            serverId: command.serverId,
            channelId: command.channelId,
            ownerUserId: userId,
            producerId: producer.id,
            kind: producer.kind,
          });
          break;
        }

        case "mediasoup.sync-producers.request": {
          const payload = parseSignalPayload<{
            requestId?: string;
          }>(command.payloadJson);
          const producers = listAvailableProducers({
            producerRegistry,
            serverId: command.serverId,
            channelId: command.channelId,
            excludeUserId: userId,
          });

          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.producers.snapshot.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: {
              producers,
            },
          });
          break;
        }

        case "mediasoup.consume.request": {
          const payload = parseSignalPayload<{
            requestId?: string;
            transportId: string;
            producerId: string;
            rtpCapabilities: unknown;
          }>(command.payloadJson);
          const transportRecord = requireOwnedTransport({
            transportRegistry,
            transportId: payload.transportId,
            ownerUserId: userId,
            serverId: command.serverId,
            channelId: command.channelId,
            direction: "recv",
          });
          const producerRecord = requireProducerRecord({
            producerRegistry,
            producerId: payload.producerId,
            serverId: command.serverId,
            channelId: command.channelId,
          });

          if (!input.mediaFoundation.canConsume({
            producerId: payload.producerId,
            rtpCapabilities: payload.rtpCapabilities,
          })) {
            throw new Error("Нельзя создать consumer для этого producer и RTP capabilities.");
          }

          const consumer = await input.mediaFoundation.createConsumer({
            transport: transportRecord.transport,
            producerId: payload.producerId,
            rtpCapabilities: payload.rtpCapabilities,
          });

          consumerRegistry.set(consumer.id, {
            serverId: command.serverId,
            channelId: command.channelId,
            ownerUserId: userId,
            producerId: payload.producerId,
            consumer,
          });

          await emitTargetedSignal({
            emitSignalEvent: input.emitSignalEvent,
            serverId: command.serverId,
            channelId: command.channelId,
            targetUserId: userId,
            signalType: "mediasoup.consume.response",
            requestPayloadJson: command.payloadJson,
            responsePayload: {
              consumerId: consumer.id,
              producerId: payload.producerId,
              producerUserId: producerRecord.ownerUserId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
              type: consumer.type ?? null,
            },
          });
          break;
        }

        default: {
          await input.emitSignalEvent({
            serverId: command.serverId,
            channelId: command.channelId,
            sourceUserId: userId,
            targetUserId: command.targetUserId,
            signalType: command.signalType,
            payloadJson: command.payloadJson,
            occurredAt: new Date().toISOString(),
          });
        }
      }

      return {
        accepted: true,
        acknowledgedAt: new Date().toISOString(),
      };
    },

    async teardownUserSession({ userId, serverId, channelId }) {
      const ownedProducerIds = Array.from(producerRegistry.entries())
        .filter(([, producerRecord]) =>
          producerRecord.ownerUserId === userId &&
          producerRecord.serverId === serverId &&
          producerRecord.channelId === channelId,
        )
        .map(([producerId]) => producerId);

      for (const producerId of ownedProducerIds) {
        const producerRecord = producerRegistry.get(producerId);

        if (!producerRecord) {
          continue;
        }

        producerRecord.producer.close();
        producerRegistry.delete(producerId);

        const relatedConsumerIds = Array.from(consumerRegistry.entries())
          .filter(([, consumerRecord]) => consumerRecord.producerId === producerId)
          .map(([consumerId]) => consumerId);

        for (const consumerId of relatedConsumerIds) {
          const consumerRecord = consumerRegistry.get(consumerId);

          if (!consumerRecord) {
            continue;
          }

          consumerRecord.consumer.close();
          consumerRegistry.delete(consumerId);
        }

        await emitProducerClosed({
          emitSignalEvent: input.emitSignalEvent,
          presenceRegistry: input.presenceRegistry,
          serverId,
          channelId,
          ownerUserId: userId,
          producerId,
        });
      }

      for (const [consumerId, consumerRecord] of Array.from(consumerRegistry.entries())) {
        if (
          consumerRecord.ownerUserId === userId &&
          consumerRecord.serverId === serverId &&
          consumerRecord.channelId === channelId
        ) {
          consumerRecord.consumer.close();
          consumerRegistry.delete(consumerId);
        }
      }

      for (const [transportId, transportRecord] of Array.from(transportRegistry.entries())) {
        if (
          transportRecord.ownerUserId === userId &&
          transportRecord.serverId === serverId &&
          transportRecord.channelId === channelId
        ) {
          transportRecord.transport.close();
          transportRegistry.delete(transportId);
        }
      }
    },

    async applyVoiceState({ userId, serverId, channelId, muted, deafened }) {
      const producerRecords = Array.from(producerRegistry.values()).filter((producerRecord) =>
        producerRecord.ownerUserId === userId &&
        producerRecord.serverId === serverId &&
        producerRecord.channelId === channelId,
      );
      const consumerRecords = Array.from(consumerRegistry.values()).filter((consumerRecord) =>
        consumerRecord.ownerUserId === userId &&
        consumerRecord.serverId === serverId &&
        consumerRecord.channelId === channelId,
      );

      for (const producerRecord of producerRecords) {
        await input.mediaFoundation.setProducerPaused(
          producerRecord.producer,
          muted || deafened,
        );
      }

      for (const consumerRecord of consumerRecords) {
        await input.mediaFoundation.setConsumerPaused(
          consumerRecord.consumer,
          deafened,
        );
      }
    },
  };
}

function requireOwnedTransport(input: {
  transportRegistry: Map<string, TransportRecord>;
  transportId: string;
  ownerUserId: string;
  serverId: string;
  channelId: string;
  direction?: TransportDirection;
}): TransportRecord {
  const transportRecord = input.transportRegistry.get(input.transportId);

  if (
    !transportRecord ||
    transportRecord.ownerUserId !== input.ownerUserId ||
    transportRecord.serverId !== input.serverId ||
    transportRecord.channelId !== input.channelId ||
    (input.direction && transportRecord.direction !== input.direction)
  ) {
    throw new Error("WebRTC transport не найден для этого пользователя и канала.");
  }

  return transportRecord;
}

function requireProducerRecord(input: {
  producerRegistry: Map<string, ProducerRecord>;
  producerId: string;
  serverId: string;
  channelId: string;
}): ProducerRecord {
  const producerRecord = input.producerRegistry.get(input.producerId);

  if (
    !producerRecord ||
    producerRecord.serverId !== input.serverId ||
    producerRecord.channelId !== input.channelId
  ) {
    throw new Error("Producer недоступен в этом канале.");
  }

  return producerRecord;
}

async function emitProducerAvailable(input: {
  emitSignalEvent: CreateMediaSignalingBridgeInput["emitSignalEvent"];
  presenceRegistry: RuntimePresenceRegistry;
  serverId: string;
  channelId: string;
  ownerUserId: string;
  producerId: string;
  kind: string;
}): Promise<void> {
  const peers = input.presenceRegistry
    .getServerPresence(input.serverId)
    .filter((member) =>
      member.channelId === input.channelId && member.userId !== input.ownerUserId,
    );

  await Promise.all(
    peers.map((peer) =>
      input.emitSignalEvent({
        serverId: input.serverId,
        channelId: input.channelId,
        sourceUserId: "system",
        targetUserId: peer.userId,
        signalType: "mediasoup.producer.available",
        payloadJson: JSON.stringify({
          producerId: input.producerId,
          producerUserId: input.ownerUserId,
          kind: input.kind,
        }),
        occurredAt: new Date().toISOString(),
      }),
    ),
  );
}

async function emitProducerClosed(input: {
  emitSignalEvent: CreateMediaSignalingBridgeInput["emitSignalEvent"];
  presenceRegistry: RuntimePresenceRegistry;
  serverId: string;
  channelId: string;
  ownerUserId: string;
  producerId: string;
}): Promise<void> {
  const peers = input.presenceRegistry
    .getServerPresence(input.serverId)
    .filter((member) =>
      member.channelId === input.channelId && member.userId !== input.ownerUserId,
    );

  await Promise.all(
    peers.map((peer) =>
      input.emitSignalEvent({
        serverId: input.serverId,
        channelId: input.channelId,
        sourceUserId: "system",
        targetUserId: peer.userId,
        signalType: "mediasoup.producer.closed",
        payloadJson: JSON.stringify({
          producerId: input.producerId,
          producerUserId: input.ownerUserId,
        }),
        occurredAt: new Date().toISOString(),
      }),
    ),
  );
}

function listAvailableProducers(input: {
  producerRegistry: Map<string, ProducerRecord>;
  serverId: string;
  channelId: string;
  excludeUserId: string;
}) {
  return Array.from(input.producerRegistry.values())
    .filter((producerRecord) =>
      producerRecord.serverId === input.serverId &&
      producerRecord.channelId === input.channelId &&
      producerRecord.ownerUserId !== input.excludeUserId,
    )
    .map((producerRecord) => ({
      producerId: producerRecord.producer.id,
      producerUserId: producerRecord.ownerUserId,
      kind: producerRecord.producer.kind,
    }));
}

async function emitTargetedSignal(input: {
  emitSignalEvent: CreateMediaSignalingBridgeInput["emitSignalEvent"];
  serverId: string;
  channelId: string;
  targetUserId: string;
  signalType: string;
  requestPayloadJson: string;
  responsePayload: unknown;
}): Promise<void> {
  const requestPayload = parseSignalPayload<Record<string, unknown>>(input.requestPayloadJson);
  const hasRequestId = typeof requestPayload.requestId === "string";
  const nextPayload =
    !Array.isArray(input.responsePayload) &&
    input.responsePayload !== null &&
    typeof input.responsePayload === "object"
      ? {
          ...(hasRequestId ? { requestId: requestPayload.requestId } : {}),
          ...(input.responsePayload as Record<string, unknown>),
        }
      : input.responsePayload;

  await input.emitSignalEvent({
    serverId: input.serverId,
    channelId: input.channelId,
    sourceUserId: "system",
    targetUserId: input.targetUserId,
    signalType: input.signalType,
    payloadJson: JSON.stringify(nextPayload),
    occurredAt: new Date().toISOString(),
  });
}

/**
 * Проверяет, что пользователь действительно находится в текущем voice-канале.
 */
function assertUserInChannel(input: {
  userId: string;
  serverId: string;
  channelId: string;
  presenceRegistry: RuntimePresenceRegistry;
}): void {
  const currentPresence = input.presenceRegistry.getUserPresence(input.userId);

  if (
    !currentPresence ||
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId
  ) {
    throw new Error("Signaling доступен только из активного канала пользователя.");
  }
}

/**
 * Проверяет, что target-пользователь тоже находится в том же канале.
 */
function assertTargetUserInChannel(input: {
  userId: string;
  serverId: string;
  channelId: string;
  presenceRegistry: RuntimePresenceRegistry;
}): void {
  const currentPresence = input.presenceRegistry.getUserPresence(input.userId);

  if (
    !currentPresence ||
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId
  ) {
    throw new Error("Целевой пользователь недоступен в этом канале.");
  }
}

/**
 * Безопасно парсит JSON payload signaling-команды.
 */
function parseSignalPayload<TPayload>(payloadJson: string): TPayload {
  try {
    return JSON.parse(payloadJson) as TPayload;
  } catch {
    throw new Error("Некорректный signaling payload.");
  }
}
