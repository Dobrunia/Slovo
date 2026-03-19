import type { RuntimePresenceRegistry } from "../realtime/presence.js";
import type { MediaFoundation, MediaWebRtcTransportLike } from "./foundation.js";

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

type TransportRecord = {
  serverId: string;
  channelId: string;
  ownerUserId: string;
  transport: MediaWebRtcTransportLike;
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
}

/**
 * Связывает LiveRail signaling-команды с MediaSoup foundation.
 */
export function createMediaSignalingBridge(
  input: CreateMediaSignalingBridgeInput,
): MediaSignalingBridge {
  const transportRegistry = new Map<string, TransportRecord>();

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
          await input.emitSignalEvent({
            serverId: command.serverId,
            channelId: command.channelId,
            sourceUserId: "system",
            targetUserId: userId,
            signalType: "mediasoup.router-capabilities.response",
            payloadJson: JSON.stringify(input.mediaFoundation.getRouterRtpCapabilities()),
            occurredAt: new Date().toISOString(),
          });
          break;
        }
        case "mediasoup.transport.create.request": {
          const createdTransport = await input.mediaFoundation.createWebRtcTransport();
          transportRegistry.set(createdTransport.transport.id, {
            serverId: command.serverId,
            channelId: command.channelId,
            ownerUserId: userId,
            transport: createdTransport.transport,
          });

          await input.emitSignalEvent({
            serverId: command.serverId,
            channelId: command.channelId,
            sourceUserId: "system",
            targetUserId: userId,
            signalType: "mediasoup.transport.create.response",
            payloadJson: JSON.stringify(createdTransport.params),
            occurredAt: new Date().toISOString(),
          });
          break;
        }
        case "mediasoup.transport.connect.request": {
          const payload = parseSignalPayload<{
            transportId: string;
            dtlsParameters: unknown;
          }>(command.payloadJson);
          const transportRecord = transportRegistry.get(payload.transportId);

          if (
            !transportRecord ||
            transportRecord.ownerUserId !== userId ||
            transportRecord.serverId !== command.serverId ||
            transportRecord.channelId !== command.channelId
          ) {
            throw new Error("WebRTC transport не найден для этого пользователя и канала.");
          }

          await input.mediaFoundation.connectWebRtcTransport(
            transportRecord.transport,
            payload.dtlsParameters,
          );
          await input.emitSignalEvent({
            serverId: command.serverId,
            channelId: command.channelId,
            sourceUserId: "system",
            targetUserId: userId,
            signalType: "mediasoup.transport.connect.response",
            payloadJson: JSON.stringify({
              transportId: payload.transportId,
              connected: true,
            }),
            occurredAt: new Date().toISOString(),
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
  };
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
