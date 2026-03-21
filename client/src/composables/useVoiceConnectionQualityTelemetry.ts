import { onBeforeUnmount, watch } from "vue";
import * as realtimeRuntime from "../realtime/runtime";
import {
  REALTIME_VOICE_SIGNAL_TYPES,
  resolveRealtimeConnectionQuality,
} from "../../../shared/realtime/connection-quality";
import { useAuthStore } from "../stores/auth";
import { useServerModuleStore } from "../stores/serverModule";

const CONNECTION_QUALITY_SAMPLE_INTERVAL_MS = 6000;

type VoiceSignalCommandExecutor = (input: {
  sessionToken: string;
  serverId: string;
  channelId: string;
  targetUserId: null;
  signalType: string;
  payloadJson: string;
}) => Promise<unknown>;

type NavigatorConnectionLike = {
  effectiveType?: string;
};

/**
 * Подключает периодическую telemetry-отправку качества соединения текущего пользователя.
 */
export function useVoiceConnectionQualityTelemetry(): void {
  const authStore = useAuthStore();
  const serverModuleStore = useServerModuleStore();

  const maybeExecuteSignalVoiceSessionCommand = (
    realtimeRuntime as {
      executeSignalVoiceSessionCommand?: VoiceSignalCommandExecutor;
    }
  ).executeSignalVoiceSessionCommand;

  let qualityIntervalId: number | null = null;
  let activePresenceKey: string | null = null;
  let lastSentQuality: "low" | "med" | "good" | null = null;

  watch(
    () => [
      authStore.sessionToken,
      serverModuleStore.currentUserPresence?.serverId ?? null,
      serverModuleStore.currentUserPresence?.channelId ?? null,
    ] as const,
    async ([sessionToken, serverId, channelId]) => {
      if (!sessionToken || !serverId || !channelId || !maybeExecuteSignalVoiceSessionCommand) {
        stopConnectionQualityTelemetry();
        return;
      }

      const nextPresenceKey = `${serverId}:${channelId}`;

      if (activePresenceKey === nextPresenceKey) {
        return;
      }

      stopConnectionQualityTelemetry();
      activePresenceKey = nextPresenceKey;

      const sampleAndSendQuality = async () => {
        if (!maybeExecuteSignalVoiceSessionCommand) {
          return;
        }

        try {
          const startedAt = performance.now();

          await maybeExecuteSignalVoiceSessionCommand({
            sessionToken,
            serverId,
            channelId,
            targetUserId: null,
            signalType: REALTIME_VOICE_SIGNAL_TYPES.connectionQualityProbe,
            payloadJson: JSON.stringify({
              probe: true,
            }),
          });

          const measuredRttMs = performance.now() - startedAt;
          const effectiveType =
            (
              navigator as Navigator & {
                connection?: NavigatorConnectionLike;
              }
            ).connection?.effectiveType ?? null;
          const nextQuality = resolveRealtimeConnectionQuality({
            rttMs: measuredRttMs,
            effectiveType,
          });

          if (nextQuality === lastSentQuality) {
            return;
          }

          lastSentQuality = nextQuality;
          await maybeExecuteSignalVoiceSessionCommand({
            sessionToken,
            serverId,
            channelId,
            targetUserId: null,
            signalType: REALTIME_VOICE_SIGNAL_TYPES.connectionQuality,
            payloadJson: JSON.stringify({
              quality: nextQuality,
            }),
          });
        } catch {
          // Негарантированная telemetry не должна ломать экран канала.
        }
      };

      await sampleAndSendQuality();
      qualityIntervalId = window.setInterval(() => {
        void sampleAndSendQuality();
      }, CONNECTION_QUALITY_SAMPLE_INTERVAL_MS);
    },
    {
      immediate: true,
    },
  );

  onBeforeUnmount(() => {
    stopConnectionQualityTelemetry();
  });

  /**
   * Останавливает таймер telemetry и сбрасывает локальное состояние sampling-сессии.
   */
  function stopConnectionQualityTelemetry(): void {
    if (qualityIntervalId !== null) {
      window.clearInterval(qualityIntervalId);
      qualityIntervalId = null;
    }

    activePresenceKey = null;
    lastSentQuality = null;
  }
}
