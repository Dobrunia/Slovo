import { onMounted, onUnmounted, watch } from "vue";
import { resolvePresenceSoundCue } from "../realtime/presence-sound";
import { resetRealtimeRuntime } from "../realtime/runtime";
import { subscribeToServerLiveState } from "../realtime/server-live";
import { resetActiveVoiceSession, syncActiveVoiceSession } from "../realtime/voice-session";
import { useAuthStore } from "../stores/auth";
import { useServerModuleStore } from "../stores/serverModule";
import { useAppSounds } from "./useAppSounds";

interface UseHomePageRealtimeOptions {
  selectedServerId: {
    value: string | null;
  };
  authStore: ReturnType<typeof useAuthStore>;
  serverModuleStore: ReturnType<typeof useServerModuleStore>;
}

/**
 * Поднимает realtime-подписки home-экрана и voice lifecycle для текущей сессии.
 */
export function useHomePageRealtime({
  selectedServerId,
  authStore,
  serverModuleStore,
}: UseHomePageRealtimeOptions): void {
  const { playJoinChannelSound, playLeaveChannelSound } = useAppSounds();
  let stopServerLiveSubscription: (() => void) | null = null;
  let requestedServerLiveSubscriptionTarget: string | null = null;
  let activeServerLiveSubscriptionTarget: string | null = null;

  watch(
    [() => authStore.sessionToken, () => selectedServerId.value],
    ([sessionToken, serverId]) => {
      void switchServerLiveSubscription(sessionToken, serverId);
    },
    {
      immediate: true,
    },
  );

  watch(
    [
      () => authStore.sessionToken,
      () => authStore.currentUser?.id ?? null,
      () => serverModuleStore.currentUserPresence?.serverId ?? null,
      () => serverModuleStore.currentUserPresence?.channelId ?? null,
      () => serverModuleStore.currentVoiceState.muted,
      () => serverModuleStore.currentVoiceState.deafened,
    ],
    ([sessionToken, currentUserId]) => {
      void syncActiveVoiceSession({
        sessionToken,
        currentUserId,
        serverId: serverModuleStore.currentUserPresence?.serverId ?? null,
        presence: serverModuleStore.currentUserPresence,
        voiceState: serverModuleStore.currentVoiceState,
        onVoiceStateUpdated: (payload) => {
          serverModuleStore.applyVoiceStateUpdated(payload);
        },
        onError: (error) => {
          serverModuleStore.presenceErrorMessage =
            error instanceof Error && error.message
              ? error.message
              : "Не удалось синхронизировать голосовую сессию.";
        },
      });
    },
    {
      immediate: true,
    },
  );

  onMounted(() => {
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pagehide", handlePageHide);
  });

  onUnmounted(() => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("pagehide", handlePageHide);
    teardownServerLiveSubscription();
    resetActiveVoiceSession();
    resetRealtimeRuntime();
  });

  /**
   * Переключает server-level realtime подписки только для текущего открытого сервера.
   */
  async function switchServerLiveSubscription(
    sessionToken: string | null,
    serverId: string | null,
  ): Promise<void> {
    const nextTarget = sessionToken && serverId ? `${sessionToken}:${serverId}` : null;

    if (nextTarget && nextTarget === requestedServerLiveSubscriptionTarget) {
      return;
    }

    if (nextTarget && nextTarget === activeServerLiveSubscriptionTarget) {
      return;
    }

    requestedServerLiveSubscriptionTarget = nextTarget;
    teardownServerLiveSubscription();

    if (!sessionToken || !serverId) {
      activeServerLiveSubscriptionTarget = null;
      requestedServerLiveSubscriptionTarget = null;
      return;
    }

    try {
      const stopSubscription = await subscribeToServerLiveState({
        sessionToken,
        serverId,
        onServerUpdated: (payload) => {
          serverModuleStore.applyLiveServerUpdated(payload);
        },
        onChannelsUpdated: (payload) => {
          serverModuleStore.applyLiveChannelsUpdated(payload);
        },
        onPresenceUpdated: (payload) => {
          const soundCue = resolvePresenceSoundCue({
            currentUserId: authStore.currentUser?.id ?? null,
            currentUserChannelId: serverModuleStore.currentUserPresence?.channelId ?? null,
            payload,
          });

          serverModuleStore.applyPresenceUpdated(payload);

          if (soundCue === "join") {
            void playJoinChannelSound();
          }

          if (soundCue === "leave") {
            void playLeaveChannelSound();
          }
        },
      });

      if (requestedServerLiveSubscriptionTarget !== nextTarget) {
        stopSubscription();
        return;
      }

      stopServerLiveSubscription = stopSubscription;
      activeServerLiveSubscriptionTarget = nextTarget;
    } catch (error) {
      if (requestedServerLiveSubscriptionTarget === nextTarget) {
        requestedServerLiveSubscriptionTarget = null;
        activeServerLiveSubscriptionTarget = null;
      }

      serverModuleStore.presenceErrorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Не удалось подключить realtime сервера.";
    }
  }

  /**
   * Удаляет активные подписки live-состояния выбранного сервера.
   */
  function teardownServerLiveSubscription(): void {
    stopServerLiveSubscription?.();
    stopServerLiveSubscription = null;
    activeServerLiveSubscriptionTarget = null;
  }

  /**
   * Локально очищает stale voice-state при разрыве сети до прихода серверного cleanup.
   */
  function handleOffline(): void {
    const currentPresence = serverModuleStore.currentUserPresence;

    if (!currentPresence) {
      return;
    }

    serverModuleStore.clearCurrentUserPresenceLocally(currentPresence.serverId);
    resetActiveVoiceSession();
  }

  /**
   * При refresh/закрытии вкладки полностью сбрасывает voice/runtime lifecycle.
   */
  function handlePageHide(): void {
    const currentPresence = serverModuleStore.currentUserPresence;

    if (currentPresence) {
      serverModuleStore.clearCurrentUserPresenceLocally(currentPresence.serverId);
    }

    teardownServerLiveSubscription();
    resetActiveVoiceSession();
    resetRealtimeRuntime();
  }
}
