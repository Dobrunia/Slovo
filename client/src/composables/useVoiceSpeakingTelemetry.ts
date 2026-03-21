import { onBeforeUnmount, watch } from "vue";
import * as realtimeRuntime from "../realtime/runtime";
import { REALTIME_VOICE_SIGNAL_TYPES } from "../../../shared/realtime/connection-quality";
import { useAuthStore } from "../stores/auth";
import { useServerModuleStore } from "../stores/serverModule";

const SPEAKING_THRESHOLD = 0.035;
const ANALYSER_FFT_SIZE = 2048;

type VoiceSignalCommandExecutor = (input: {
  sessionToken: string;
  serverId: string;
  channelId: string;
  targetUserId: null;
  signalType: string;
  payloadJson: string;
}) => Promise<unknown>;

/**
 * Подключает client-side telemetry для realtime-индикации речи текущего пользователя.
 */
export function useVoiceSpeakingTelemetry(): void {
  const authStore = useAuthStore();
  const serverModuleStore = useServerModuleStore();

  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let mediaSourceNode: MediaStreamAudioSourceNode | null = null;
  let mediaStream: MediaStream | null = null;
  let analyserFrameId: number | null = null;
  let activePresenceKey: string | null = null;
  let lastSentSpeakingState = false;

  const maybeExecuteSignalVoiceSessionCommand = (
    realtimeRuntime as {
      executeSignalVoiceSessionCommand?: VoiceSignalCommandExecutor;
    }
  ).executeSignalVoiceSessionCommand;

  watch(
    () => [
      authStore.sessionToken,
      serverModuleStore.currentUserPresence?.serverId ?? null,
      serverModuleStore.currentUserPresence?.channelId ?? null,
      Boolean(serverModuleStore.currentVoiceState.muted),
      Boolean(serverModuleStore.currentVoiceState.deafened),
    ] as const,
    async ([sessionToken, serverId, channelId, muted, deafened]) => {
      if (!sessionToken || !serverId || !channelId || muted || deafened) {
        await stopSpeakingTelemetry({
          notify: true,
          serverId,
          channelId,
          sessionToken,
        });
        return;
      }

      const nextPresenceKey = `${serverId}:${channelId}`;

      if (activePresenceKey === nextPresenceKey) {
        return;
      }

      await stopSpeakingTelemetry({
        notify: true,
        serverId,
        channelId,
        sessionToken,
      });
      await startSpeakingTelemetry({
        sessionToken,
        serverId,
        channelId,
      });
    },
    {
      immediate: true,
    },
  );

  onBeforeUnmount(() => {
    void stopSpeakingTelemetry({
      notify: false,
      serverId: serverModuleStore.currentUserPresence?.serverId ?? null,
      channelId: serverModuleStore.currentUserPresence?.channelId ?? null,
      sessionToken: authStore.sessionToken,
    });
  });

  /**
   * Запускает локальный анализатор микрофона для отправки speaking-state в realtime.
   */
  async function startSpeakingTelemetry(input: {
    sessionToken: string;
    serverId: string;
    channelId: string;
  }): Promise<void> {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !maybeExecuteSignalVoiceSessionCommand
    ) {
      return;
    }

    activePresenceKey = `${input.serverId}:${input.channelId}`;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioContext = new AudioContext();
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = ANALYSER_FFT_SIZE;
      mediaSourceNode = audioContext.createMediaStreamSource(mediaStream);
      mediaSourceNode.connect(analyserNode);
      analyseSpeakingFrame(input);
    } catch {
      await stopSpeakingTelemetry({
        notify: false,
        serverId: input.serverId,
        channelId: input.channelId,
        sessionToken: input.sessionToken,
      });
    }
  }

  /**
   * Останавливает локальный анализатор речи и при необходимости отправляет speaking=false.
   */
  async function stopSpeakingTelemetry(input: {
    notify: boolean;
    sessionToken: string | null;
    serverId: string | null;
    channelId: string | null;
  }): Promise<void> {
    if (
      input.notify &&
      lastSentSpeakingState &&
      input.sessionToken &&
      input.serverId &&
      input.channelId
    ) {
      await emitSpeakingState({
        sessionToken: input.sessionToken,
        serverId: input.serverId,
        channelId: input.channelId,
        speaking: false,
      });
    }

    if (analyserFrameId !== null) {
      window.cancelAnimationFrame(analyserFrameId);
      analyserFrameId = null;
    }

    mediaSourceNode?.disconnect();
    analyserNode?.disconnect();
    mediaStream?.getTracks().forEach((track) => track.stop());

    if (audioContext) {
      void audioContext.close();
    }

    mediaSourceNode = null;
    analyserNode = null;
    mediaStream = null;
    audioContext = null;
    activePresenceKey = null;
    lastSentSpeakingState = false;
  }

  /**
   * Вычисляет текущее состояние речи по амплитуде микрофона и отправляет изменения.
   */
  function analyseSpeakingFrame(input: {
    sessionToken: string;
    serverId: string;
    channelId: string;
  }): void {
    if (!analyserNode) {
      return;
    }

    const samples = new Uint8Array(analyserNode.fftSize);

    const tick = () => {
      if (!analyserNode) {
        return;
      }

      analyserNode.getByteTimeDomainData(samples);

      let squaredAmplitudeSum = 0;

      for (const sample of samples) {
        const normalizedSample = (sample - 128) / 128;
        squaredAmplitudeSum += normalizedSample * normalizedSample;
      }

      const speaking = Math.sqrt(squaredAmplitudeSum / samples.length) > SPEAKING_THRESHOLD;

      if (speaking !== lastSentSpeakingState) {
        lastSentSpeakingState = speaking;
        void emitSpeakingState({
          sessionToken: input.sessionToken,
          serverId: input.serverId,
          channelId: input.channelId,
          speaking,
        }).catch(() => {
          // Негарантированная telemetry не должна ронять lifecycle экрана.
        });
      }

      analyserFrameId = window.requestAnimationFrame(tick);
    };

    tick();
  }

  /**
   * Отправляет realtime-сигнал о начале или окончании речи текущего пользователя.
   */
  async function emitSpeakingState(input: {
    sessionToken: string;
    serverId: string;
    channelId: string;
    speaking: boolean;
  }): Promise<void> {
    if (!maybeExecuteSignalVoiceSessionCommand) {
      return;
    }

    await maybeExecuteSignalVoiceSessionCommand({
      sessionToken: input.sessionToken,
      serverId: input.serverId,
      channelId: input.channelId,
      targetUserId: null,
      signalType: REALTIME_VOICE_SIGNAL_TYPES.speaking,
      payloadJson: JSON.stringify({
        speaking: input.speaking,
      }),
    });
  }
}
