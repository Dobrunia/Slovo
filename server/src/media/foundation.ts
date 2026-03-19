import * as mediasoup from "mediasoup";
import {
  DEFAULT_MEDIASOUP_ANNOUNCED_ADDRESS,
  DEFAULT_MEDIASOUP_INITIAL_OUTGOING_BITRATE,
  DEFAULT_MEDIASOUP_LISTEN_IP,
  DEFAULT_MEDIASOUP_MAX_INCOMING_BITRATE,
  DEFAULT_MEDIASOUP_RTC_MAX_PORT,
  DEFAULT_MEDIASOUP_RTC_MIN_PORT,
} from "../config/constants.js";

/**
 * Минимальная форма WebRTC transport-а, с которой работает foundation.
 */
export interface MediaWebRtcTransportLike {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
  sctpParameters?: unknown;
  connect(options: { dtlsParameters: unknown }): Promise<void>;
  setMaxIncomingBitrate?(bitrate: number): Promise<void>;
  close(): void;
}

/**
 * Минимальная форма router-а MediaSoup, необходимая серверу проекта.
 */
export interface MediaRouterLike {
  rtpCapabilities: unknown;
  createWebRtcTransport(options: Record<string, unknown>): Promise<MediaWebRtcTransportLike>;
  close(): void;
}

/**
 * Минимальная форма worker-а MediaSoup, необходимая серверу проекта.
 */
export interface MediaWorkerLike {
  createRouter(options: { mediaCodecs: unknown[] }): Promise<MediaRouterLike>;
  close(): void;
}

/**
 * Минимальный адаптер над пакетом mediasoup для тестируемой foundation-логики.
 */
export interface MediaSoupLike {
  createWorker(options: Record<string, unknown>): Promise<MediaWorkerLike>;
}

/**
 * Сериализуемые параметры WebRTC transport-а, которые позже уходят в signaling.
 */
export interface MediaWebRtcTransportParams {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
  sctpParameters: unknown | null;
}

/**
 * Результат создания WebRTC transport-а через foundation.
 */
export interface CreatedMediaWebRtcTransport {
  transport: MediaWebRtcTransportLike;
  params: MediaWebRtcTransportParams;
}

/**
 * Публичный контракт MediaSoup foundation проекта.
 */
export interface MediaFoundation {
  worker: MediaWorkerLike;
  router: MediaRouterLike;
  getRouterRtpCapabilities(): unknown;
  createWebRtcTransport(): Promise<CreatedMediaWebRtcTransport>;
  connectWebRtcTransport(transport: MediaWebRtcTransportLike, dtlsParameters: unknown): Promise<void>;
  close(): Promise<void>;
}

/**
 * Параметры создания MediaSoup foundation проекта.
 */
export interface CreateMediaFoundationInput {
  mediasoupApi?: MediaSoupLike;
  rtcMinPort?: number;
  rtcMaxPort?: number;
  announcedAddress?: string | null;
  initialAvailableOutgoingBitrate?: number;
  maxIncomingBitrate?: number;
}

const DEFAULT_MEDIA_CODECS = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48_000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90_000,
    parameters: {},
  },
] as const;

/**
 * Поднимает MediaSoup foundation: worker, router и базовый transport flow.
 */
export async function createMediaFoundation(
  input: CreateMediaFoundationInput = {},
): Promise<MediaFoundation> {
  const mediasoupApi = input.mediasoupApi ?? (mediasoup as unknown as MediaSoupLike);
  const worker = await mediasoupApi.createWorker({
    rtcMinPort: input.rtcMinPort ?? DEFAULT_MEDIASOUP_RTC_MIN_PORT,
    rtcMaxPort: input.rtcMaxPort ?? DEFAULT_MEDIASOUP_RTC_MAX_PORT,
  });
  const router = await worker.createRouter({
    mediaCodecs: [...DEFAULT_MEDIA_CODECS],
  });

  return {
    worker,
    router,
    getRouterRtpCapabilities() {
      return router.rtpCapabilities;
    },
    async createWebRtcTransport() {
      const transport = await router.createWebRtcTransport({
        listenInfos: [
          {
            protocol: "udp",
            ip: DEFAULT_MEDIASOUP_LISTEN_IP,
            announcedAddress: input.announcedAddress ?? DEFAULT_MEDIASOUP_ANNOUNCED_ADDRESS,
          },
          {
            protocol: "tcp",
            ip: DEFAULT_MEDIASOUP_LISTEN_IP,
            announcedAddress: input.announcedAddress ?? DEFAULT_MEDIASOUP_ANNOUNCED_ADDRESS,
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate:
          input.initialAvailableOutgoingBitrate ??
          DEFAULT_MEDIASOUP_INITIAL_OUTGOING_BITRATE,
      });

      if (transport.setMaxIncomingBitrate) {
        await transport.setMaxIncomingBitrate(
          input.maxIncomingBitrate ?? DEFAULT_MEDIASOUP_MAX_INCOMING_BITRATE,
        );
      }

      return {
        transport,
        params: serializeWebRtcTransport(transport),
      };
    },
    async connectWebRtcTransport(transport, dtlsParameters) {
      await transport.connect({
        dtlsParameters,
      });
    },
    async close() {
      router.close();
      worker.close();
    },
  };
}

/**
 * Нормализует runtime transport в сериализуемые signaling-параметры.
 */
export function serializeWebRtcTransport(
  transport: MediaWebRtcTransportLike,
): MediaWebRtcTransportParams {
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    sctpParameters: transport.sctpParameters ?? null,
  };
}
