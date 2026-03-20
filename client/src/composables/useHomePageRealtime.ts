import { onMounted, onUnmounted, watch } from "vue";
import {
  applyRealtimeConnectionSnapshot,
  createRealtimeConnectionRecoveryState,
} from "../realtime/connectionRecovery";
import { resolvePresenceSoundCue } from "../realtime/presence-sound";
import {
  resetRealtimeRuntime,
  subscribeToRealtimeConnectionState,
  subscribeToCurrentUserProfile,
} from "../realtime/runtime";
import { subscribeToServerLiveState } from "../realtime/server-live";
import { resetActiveVoiceSession, syncActiveVoiceSession } from "../realtime/voice-session";
import { useAuthStore } from "../stores/auth";
import { useServerModuleStore } from "../stores/serverModule";
import { useServersStore } from "../stores/servers";
import { useAppSounds } from "./useAppSounds";
import { useUserPreferences } from "./useUserPreferences";

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
  const { selectedInputDeviceId } = useUserPreferences();
  const serversStore = useServersStore();
  let stopServerLiveSubscription: (() => void) | null = null;
  let stopCurrentUserProfileSubscription: (() => void) | null = null;
  let stopRealtimeConnectionStateSubscription: (() => void) | null = null;
  let requestedServerLiveSubscriptionTarget: string | null = null;
  let activeServerLiveSubscriptionTarget: string | null = null;
  let connectionRecoveryState = createRealtimeConnectionRecoveryState();

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
    [() => authStore.sessionToken, () => authStore.currentUser?.id ?? null],
    ([sessionToken, currentUserId]) => {
      void switchCurrentUserProfileSubscription(sessionToken, currentUserId);
    },
    {
      immediate: true,
    },
  );

  watch(
    () => authStore.sessionToken,
    (sessionToken) => {
      switchRealtimeConnectionStateSubscription(sessionToken);
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
      () => Boolean(serverModuleStore.currentUserScreenShareState),
      () => selectedInputDeviceId.value,
    ],
    ([
      sessionToken,
      currentUserId,
      _serverId,
      _channelId,
      _muted,
      _deafened,
      screenShareActive,
      inputDeviceId,
    ]) => {
      void syncActiveVoiceSession({
        sessionToken,
        currentUserId,
        serverId: serverModuleStore.currentUserPresence?.serverId ?? null,
        presence: serverModuleStore.currentUserPresence,
        inputDeviceId,
        screenShareActive,
        voiceState: serverModuleStore.currentVoiceState,
        onVoiceStateUpdated: (payload) => {
          serverModuleStore.applyVoiceStateUpdated(payload);
        },
        onScreenShareUpdated: (payload) => {
          serverModuleStore.applyScreenShareUpdated(payload);
        },
        onScreenShareStreamsChanged: (streams) => {
          serverModuleStore.replaceScreenShareStreams(streams);
        },
        onScreenShareCaptureFailed: async (error) => {
          serverModuleStore.presenceErrorMessage =
            error instanceof Error && error.message
              ? error.message
              : "Не удалось запустить демонстрацию экрана.";
          await serverModuleStore.handleScreenShareCaptureFailure();
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
    teardownCurrentUserProfileSubscription();
    teardownRealtimeConnectionStateSubscription();
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
   * Подписывает текущего пользователя на user-level realtime события профиля и membership.
   */
  async function switchCurrentUserProfileSubscription(
    sessionToken: string | null,
    currentUserId: string | null,
  ): Promise<void> {
    teardownCurrentUserProfileSubscription();

    if (!sessionToken || !currentUserId) {
      return;
    }

    try {
      stopCurrentUserProfileSubscription = await subscribeToCurrentUserProfile({
        sessionToken,
        userId: currentUserId,
        onUserServersUpdated: (payload) => {
          if (payload.action !== "deleted") {
            return;
          }

          serversStore.removeServerItem(payload.serverId);
          serverModuleStore.handleServerAccessRevoked(payload.serverId);
        },
        onForcedDisconnect: (payload) => {
          serverModuleStore.handleForcedDisconnect(payload);
          resetActiveVoiceSession();
        },
      });
    } catch (error) {
      serverModuleStore.presenceErrorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Не удалось подключить пользовательский realtime.";
    }
  }

  /**
   * Удаляет активную user-level подписку профиля текущего пользователя.
   */
  function teardownCurrentUserProfileSubscription(): void {
    stopCurrentUserProfileSubscription?.();
    stopCurrentUserProfileSubscription = null;
  }

  /**
   * Подписывает текущую auth-сессию на lifecycle realtime transport-а.
   */
  function switchRealtimeConnectionStateSubscription(sessionToken: string | null): void {
    teardownRealtimeConnectionStateSubscription();
    connectionRecoveryState = createRealtimeConnectionRecoveryState();

    if (!sessionToken) {
      return;
    }

    stopRealtimeConnectionStateSubscription = subscribeToRealtimeConnectionState({
      sessionToken,
      onConnectionState: (snapshot) => {
        connectionRecoveryState = applyRealtimeConnectionSnapshot({
          state: connectionRecoveryState,
          snapshot,
          onDisconnected: () => {
            handleRealtimeConnectionLost();
          },
          onReconnected: () => {
            void handleRealtimeReconnected();
          },
        });
      },
    });
  }

  /**
   * Удаляет lifecycle-подписку текущего realtime runtime.
   */
  function teardownRealtimeConnectionStateSubscription(): void {
    stopRealtimeConnectionStateSubscription?.();
    stopRealtimeConnectionStateSubscription = null;
    connectionRecoveryState = createRealtimeConnectionRecoveryState();
  }

  /**
   * Мгновенно очищает локальный voice/media state при потере transport-соединения.
   */
  function handleRealtimeConnectionLost(): void {
    serverModuleStore.handleRealtimeConnectionInterrupted(
      "Соединение потеряно. Войдите в канал заново.",
    );
    resetActiveVoiceSession();
  }

  /**
   * После восстановления transport-соединения переснимает критические snapshot-ы MVP.
   */
  async function handleRealtimeReconnected(): Promise<void> {
    const recoveryTasks: Array<Promise<unknown>> = [serversStore.loadServers()];

    if (selectedServerId.value) {
      recoveryTasks.push(serverModuleStore.reloadSelectedServer());
    }

    await Promise.allSettled(recoveryTasks);
  }

  /**
   * Локально очищает stale voice-state при разрыве сети до прихода серверного cleanup.
   */
  function handleOffline(): void {
    serverModuleStore.handleRealtimeConnectionInterrupted(
      "Соединение потеряно. Войдите в канал заново.",
    );
    resetActiveVoiceSession();
  }

  /**
   * При refresh/закрытии вкладки полностью сбрасывает voice/runtime lifecycle.
   */
  function handlePageHide(): void {
    serverModuleStore.handleRealtimeConnectionInterrupted();
    teardownServerLiveSubscription();
    teardownCurrentUserProfileSubscription();
    teardownRealtimeConnectionStateSubscription();
    resetActiveVoiceSession();
    resetRealtimeRuntime();
  }
}
