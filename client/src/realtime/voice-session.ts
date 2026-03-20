import { Device } from "mediasoup-client";
import type {
  Transport,
  Producer,
  Consumer,
} from "mediasoup-client/types";
import {
  ensureRealtimeRuntime,
  executeSignalVoiceSessionCommand,
  subscribeToVoiceSession,
  subscribeToVoiceSignaling,
} from "./runtime";
import type {
  ClientActiveVoicePresence,
  ClientCurrentVoiceState,
  ClientVoiceSessionSignaledEventPayload,
  ClientVoiceStateUpdatedEventPayload,
} from "../types/server";

type PendingSignalRequest = {
  expectedSignalType: string;
  resolve: (payload: unknown) => void;
  reject: (error: unknown) => void;
  timeoutId: number;
};

type RemoteConsumerRecord = {
  consumer: Consumer;
  audioElement: HTMLAudioElement;
};

/**
 * Параметры синхронизации текущей активной voice session клиента.
 */
export interface SyncActiveVoiceSessionInput {
  sessionToken: string | null;
  currentUserId: string | null;
  serverId: string | null;
  presence: ClientActiveVoicePresence | null;
  voiceState: ClientCurrentVoiceState;
  onVoiceStateUpdated(payload: ClientVoiceStateUpdatedEventPayload): void;
  onError(error: unknown): void;
}

type VoiceSessionTarget = {
  sessionToken: string;
  currentUserId: string;
  serverId: string;
  channelId: string;
};

let activeVoiceSession: VoiceChannelSession | null = null;
let activeVoiceSessionTargetKey: string | null = null;
let voiceSessionVersion = 0;

/**
 * Синхронизирует единственную активную mediasoup voice session клиента
 * с текущим runtime presence пользователя.
 */
export async function syncActiveVoiceSession(
  input: SyncActiveVoiceSessionInput,
): Promise<void> {
  const nextTarget = toVoiceSessionTarget(input);
  const nextTargetKey = nextTarget ? createVoiceSessionTargetKey(nextTarget) : null;

  if (
    nextTargetKey &&
    activeVoiceSession &&
    activeVoiceSessionTargetKey === nextTargetKey
  ) {
    await activeVoiceSession.applyVoiceState(input.voiceState);
    return;
  }

  const currentVersion = ++voiceSessionVersion;
  await resetActiveVoiceSession();

  if (!nextTarget || !nextTargetKey) {
    return;
  }

  const voiceSession = new VoiceChannelSession({
    ...nextTarget,
    initialVoiceState: input.voiceState,
    onVoiceStateUpdated: input.onVoiceStateUpdated,
  });

  activeVoiceSession = voiceSession;
  activeVoiceSessionTargetKey = nextTargetKey;

  try {
    await voiceSession.start();

    if (currentVersion !== voiceSessionVersion) {
      await voiceSession.destroy();
      return;
    }

    await voiceSession.applyVoiceState(input.voiceState);
  } catch (error) {
    if (currentVersion === voiceSessionVersion) {
      activeVoiceSession = null;
      activeVoiceSessionTargetKey = null;
      input.onError(error);
    }

    await voiceSession.destroy();
  }
}

/**
 * Полностью завершает текущую активную mediasoup voice session клиента.
 */
export async function resetActiveVoiceSession(): Promise<void> {
  if (!activeVoiceSession) {
    activeVoiceSessionTargetKey = null;
    return;
  }

  const currentVoiceSession = activeVoiceSession;
  activeVoiceSession = null;
  activeVoiceSessionTargetKey = null;
  await currentVoiceSession.destroy();
}

/**
 * Извлекает target активной voice session из текущего runtime presence.
 */
function toVoiceSessionTarget(
  input: SyncActiveVoiceSessionInput,
): VoiceSessionTarget | null {
  if (!input.sessionToken || !input.currentUserId || !input.serverId || !input.presence) {
    return null;
  }

  return {
    sessionToken: input.sessionToken,
    currentUserId: input.currentUserId,
    serverId: input.serverId,
    channelId: input.presence.channelId,
  };
}

/**
 * Строит детерминированный ключ активной voice session.
 */
function createVoiceSessionTargetKey(target: VoiceSessionTarget): string {
  return `${target.sessionToken}:${target.currentUserId}:${target.serverId}:${target.channelId}`;
}

/**
 * Инкапсулирует lifecycle одной активной mediasoup voice session в канале.
 */
class VoiceChannelSession {
  private readonly runtime;
  private readonly pendingSignalRequests = new Map<string, PendingSignalRequest>();
  private readonly remoteConsumers = new Map<string, RemoteConsumerRecord>();
  private readonly sessionToken: string;
  private readonly currentUserId: string;
  private readonly serverId: string;
  private readonly channelId: string;
  private readonly onVoiceStateUpdated: SyncActiveVoiceSessionInput["onVoiceStateUpdated"];
  private stopVoiceSignalingSubscription: null | (() => Promise<void>) = null;
  private stopVoiceSessionSubscription: null | (() => Promise<void>) = null;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private sendProducer: Producer | null = null;
  private microphoneTrack: MediaStreamTrack | null = null;
  private currentVoiceState: ClientCurrentVoiceState;
  private destroyed = false;

  /**
   * Создает новый voice session controller для конкретного server/channel target.
   */
  constructor(input: {
    sessionToken: string;
    currentUserId: string;
    serverId: string;
    channelId: string;
    initialVoiceState: ClientCurrentVoiceState;
    onVoiceStateUpdated: SyncActiveVoiceSessionInput["onVoiceStateUpdated"];
  }) {
    this.runtime = ensureRealtimeRuntime(input.sessionToken);
    this.sessionToken = input.sessionToken;
    this.currentUserId = input.currentUserId;
    this.serverId = input.serverId;
    this.channelId = input.channelId;
    this.currentVoiceState = input.initialVoiceState;
    this.onVoiceStateUpdated = input.onVoiceStateUpdated;
  }

  /**
   * Поднимает signaling-подписки, transports и audio produce/consume flow.
   */
  async start(): Promise<void> {
    this.stopVoiceSignalingSubscription = await subscribeToVoiceSignaling({
      sessionToken: this.sessionToken,
      serverId: this.serverId,
      channelId: this.channelId,
      onVoiceSessionSignaled: (payload) => {
        void this.handleSignalEvent(payload);
      },
    });
    this.stopVoiceSessionSubscription = await subscribeToVoiceSession({
      sessionToken: this.sessionToken,
      serverId: this.serverId,
      channelId: this.channelId,
      onVoiceStateUpdated: (payload) => {
        this.onVoiceStateUpdated(payload);

        if (payload.userId === this.currentUserId) {
          void this.applyVoiceState({
            muted: payload.muted,
            deafened: payload.deafened,
          });
        }
      },
    });

    const routerRtpCapabilities = await this.requestSignal(
      "mediasoup.router-capabilities.request",
      {},
      "mediasoup.router-capabilities.response",
    );

    this.device = new Device();
    await this.device.load({
      routerRtpCapabilities: routerRtpCapabilities as never,
    });
    await this.createSendTransport();
    await this.createReceiveTransport();
    await this.startMicrophonePublishing();

    const producersSnapshot = await this.requestSignal<{
      producers: Array<{
        producerId: string;
        producerUserId: string;
        kind: string;
      }>;
    }>(
      "mediasoup.sync-producers.request",
      {},
      "mediasoup.producers.snapshot.response",
    );

    for (const producer of producersSnapshot.producers ?? []) {
      await this.consumeProducer(producer.producerId);
    }
  }

  /**
   * Применяет локальное audio-поведение для текущего voice state пользователя.
   */
  async applyVoiceState(nextState: ClientCurrentVoiceState): Promise<void> {
    this.currentVoiceState = nextState;

    if (this.microphoneTrack) {
      this.microphoneTrack.enabled = !(nextState.muted || nextState.deafened);
    }

    if (this.sendProducer) {
      if (nextState.muted || nextState.deafened) {
        this.sendProducer.pause();
      } else {
        this.sendProducer.resume();
      }
    }

    for (const remoteConsumer of this.remoteConsumers.values()) {
      remoteConsumer.audioElement.muted = nextState.deafened;

      if (!nextState.deafened) {
        void remoteConsumer.audioElement.play().catch(() => {});
      }
    }
  }

  /**
   * Полностью завершает активную voice session и очищает локальные media-ресурсы.
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    const pendingRequests = Array.from(this.pendingSignalRequests.values());
    this.pendingSignalRequests.clear();

    for (const pendingRequest of pendingRequests) {
      clearTimeout(pendingRequest.timeoutId);
      pendingRequest.reject(new Error("Voice session была завершена до ответа signaling."));
    }

    if (this.stopVoiceSessionSubscription) {
      const stop = this.stopVoiceSessionSubscription;
      this.stopVoiceSessionSubscription = null;
      await stop();
    }

    if (this.stopVoiceSignalingSubscription) {
      const stop = this.stopVoiceSignalingSubscription;
      this.stopVoiceSignalingSubscription = null;
      await stop();
    }

    for (const [producerId] of this.remoteConsumers) {
      this.closeRemoteProducer(producerId);
    }

    this.sendProducer?.close();
    this.sendProducer = null;
    this.sendTransport?.close();
    this.sendTransport = null;
    this.recvTransport?.close();
    this.recvTransport = null;

    if (this.microphoneTrack) {
      this.microphoneTrack.stop();
      this.microphoneTrack = null;
    }
  }

  /**
   * Создает клиентский send transport и привязывает его к signaling-bridge.
   */
  private async createSendTransport(): Promise<void> {
    if (!this.device) {
      throw new Error("Media device еще не инициализирован.");
    }

    const sendTransportParams = await this.requestSignal<{
      id: string;
      iceParameters: unknown;
      iceCandidates: unknown[];
      dtlsParameters: unknown;
      sctpParameters: unknown | null;
    }>(
      "mediasoup.transport.create.request",
      {
        direction: "send",
      },
      "mediasoup.transport.create.response",
    );

    const sendTransport = this.device.createSendTransport(sendTransportParams as never);

    sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      void this.requestSignal(
        "mediasoup.transport.connect.request",
        {
          transportId: sendTransportParams.id,
          dtlsParameters,
        },
        "mediasoup.transport.connect.response",
      )
        .then(() => callback())
        .catch((error) => errback(toError(error)));
    });

    sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
      void this.requestSignal<{
        producerId: string;
      }>(
        "mediasoup.produce.request",
        {
          transportId: sendTransportParams.id,
          kind,
          rtpParameters,
          appData,
        },
        "mediasoup.produce.response",
      )
        .then((response) => callback({ id: response.producerId }))
        .catch((error) => errback(toError(error)));
    });

    this.sendTransport = sendTransport;
  }

  /**
   * Создает клиентский recv transport и привязывает его к signaling-bridge.
   */
  private async createReceiveTransport(): Promise<void> {
    if (!this.device) {
      throw new Error("Media device еще не инициализирован.");
    }

    const recvTransportParams = await this.requestSignal<{
      id: string;
      iceParameters: unknown;
      iceCandidates: unknown[];
      dtlsParameters: unknown;
      sctpParameters: unknown | null;
    }>(
      "mediasoup.transport.create.request",
      {
        direction: "recv",
      },
      "mediasoup.transport.create.response",
    );

    const recvTransport = this.device.createRecvTransport(recvTransportParams as never);

    recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      void this.requestSignal(
        "mediasoup.transport.connect.request",
        {
          transportId: recvTransportParams.id,
          dtlsParameters,
        },
        "mediasoup.transport.connect.response",
      )
        .then(() => callback())
        .catch((error) => errback(toError(error)));
    });

    this.recvTransport = recvTransport;
  }

  /**
   * Захватывает микрофон пользователя и публикует audio producer.
   */
  private async startMicrophonePublishing(): Promise<void> {
    if (!this.sendTransport) {
      throw new Error("Send transport не создан.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Браузер не поддерживает захват микрофона.");
    }

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const microphoneTrack = mediaStream.getAudioTracks()[0];

    if (!microphoneTrack) {
      throw new Error("Не удалось получить аудиотрек микрофона.");
    }

    this.microphoneTrack = microphoneTrack;
    this.sendProducer = await this.sendTransport.produce({
      track: microphoneTrack,
      stopTracks: false,
      appData: {
        media: "audio",
      },
    });
  }

  /**
   * Обрабатывает входящие signaling-события текущего канала.
   */
  private async handleSignalEvent(
    payload: ClientVoiceSessionSignaledEventPayload,
  ): Promise<void> {
    if (this.destroyed) {
      return;
    }

    if (payload.targetUserId && payload.targetUserId !== this.currentUserId) {
      return;
    }

    const signalPayload = parsePayloadJson<Record<string, unknown>>(payload.payloadJson);
    const requestId =
      typeof signalPayload.requestId === "string" ? signalPayload.requestId : null;

    if (requestId && this.pendingSignalRequests.has(requestId)) {
      const pendingSignalRequest = this.pendingSignalRequests.get(requestId)!;

      if (pendingSignalRequest.expectedSignalType === payload.signalType) {
        clearTimeout(pendingSignalRequest.timeoutId);
        this.pendingSignalRequests.delete(requestId);
        pendingSignalRequest.resolve(signalPayload);
        return;
      }
    }

    if (payload.signalType === "mediasoup.producer.available") {
      const producerId =
        typeof signalPayload.producerId === "string" ? signalPayload.producerId : null;
      const producerUserId =
        typeof signalPayload.producerUserId === "string"
          ? signalPayload.producerUserId
          : null;

      if (producerId && producerUserId && producerUserId !== this.currentUserId) {
        await this.consumeProducer(producerId);
      }

      return;
    }

    if (payload.signalType === "mediasoup.producer.closed") {
      const producerId =
        typeof signalPayload.producerId === "string" ? signalPayload.producerId : null;

      if (producerId) {
        this.closeRemoteProducer(producerId);
      }
    }
  }

  /**
   * Создает recv consumer для удаленного producer и поднимает audio playback.
   */
  private async consumeProducer(producerId: string): Promise<void> {
    if (!this.recvTransport || !this.device || this.remoteConsumers.has(producerId)) {
      return;
    }

    const consumeResponse = await this.requestSignal<{
      consumerId: string;
      producerId: string;
      producerUserId: string;
      kind: string;
      rtpParameters: unknown;
      type: string | null;
    }>(
      "mediasoup.consume.request",
      {
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      },
      "mediasoup.consume.response",
    );

    const consumer = await this.recvTransport.consume({
      id: consumeResponse.consumerId,
      producerId: consumeResponse.producerId,
      kind: consumeResponse.kind as "audio",
      rtpParameters: consumeResponse.rtpParameters as never,
      appData: {
        producerUserId: consumeResponse.producerUserId,
      },
    });

    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    audioElement.setAttribute("playsinline", "true");
    audioElement.muted = this.currentVoiceState.deafened;
    audioElement.srcObject = new MediaStream([consumer.track]);
    void audioElement.play().catch(() => {});

    this.remoteConsumers.set(producerId, {
      consumer,
      audioElement,
    });
  }

  /**
   * Закрывает локальный recv consumer и playback для удаленного producer.
   */
  private closeRemoteProducer(producerId: string): void {
    const remoteConsumer = this.remoteConsumers.get(producerId);

    if (!remoteConsumer) {
      return;
    }

    remoteConsumer.consumer.close();
    remoteConsumer.audioElement.pause();
    remoteConsumer.audioElement.srcObject = null;
    this.remoteConsumers.delete(producerId);
  }

  /**
   * Отправляет signaling-команду и ждет ответного `voice-session.signaled` по requestId.
   */
  private async requestSignal<TResponse>(
    signalType: string,
    payload: Record<string, unknown>,
    expectedResponseType: string,
  ): Promise<TResponse> {
    const requestId = crypto.randomUUID();

    const responsePromise = new Promise<TResponse>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.pendingSignalRequests.delete(requestId);
        reject(new Error(`Signaling response timed out for ${signalType}.`));
      }, 10_000);

      this.pendingSignalRequests.set(requestId, {
        expectedSignalType: expectedResponseType,
        resolve: (responsePayload) => resolve(responsePayload as TResponse),
        reject,
        timeoutId,
      });
    });

    try {
      await executeSignalVoiceSessionCommand({
        sessionToken: this.sessionToken,
        serverId: this.serverId,
        channelId: this.channelId,
        targetUserId: null,
        signalType,
        payloadJson: JSON.stringify({
          requestId,
          ...payload,
        }),
      });
    } catch (error) {
      const pendingSignalRequest = this.pendingSignalRequests.get(requestId);

      if (pendingSignalRequest) {
        clearTimeout(pendingSignalRequest.timeoutId);
        this.pendingSignalRequests.delete(requestId);
      }

      throw error;
    }

    return responsePromise;
  }
}

function parsePayloadJson<TPayload>(payloadJson: string): TPayload {
  return JSON.parse(payloadJson) as TPayload;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Voice session operation failed.");
}
