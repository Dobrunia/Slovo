import { onUnmounted, watch } from "vue";
import type { ComputedRef } from "vue";
import type { Router } from "vue-router";
import type { useAuthStore } from "../stores/auth";
import type { useServerModuleStore } from "../stores/serverModule";
import type { ClientPresenceUpdatedEventPayload } from "../types/server";
import { buildAppServerChannelRoute } from "../router/serverRoutes";
import { subscribeToServerLiveState } from "../realtime/server-live";
import { useAppSounds } from "./useAppSounds";

type PresenceSoundCue = "join" | "leave" | null;

/**
 * Входные параметры realtime-orchestration для защищенного home-экрана.
 */
export interface UseHomePageRealtimeInput {
  selectedServerId: ComputedRef<string | null>;
  selectedChannelId: ComputedRef<string | null>;
  authStore: ReturnType<typeof useAuthStore>;
  serverModuleStore: ReturnType<typeof useServerModuleStore>;
  router: Router;
}

/**
 * Подключает realtime-подписки home-экрана, route-sync и звуковые сигналы presence.
 */
export function useHomePageRealtime(input: UseHomePageRealtimeInput): void {
  const { playJoinChannelSound, playLeaveChannelSound } = useAppSounds();
  let stopServerLiveSubscription: null | (() => Promise<void>) = null;
  let serverLiveSubscriptionVersion = 0;

  watch(
    [() => input.authStore.sessionToken, input.selectedServerId],
    async ([sessionToken, serverId], _previousValue, onCleanup) => {
      const subscriptionVersion = ++serverLiveSubscriptionVersion;
      let isDisposed = false;

      onCleanup(() => {
        isDisposed = true;
      });

      if (stopServerLiveSubscription) {
        const stop = stopServerLiveSubscription;
        stopServerLiveSubscription = null;
        await stop();
      }

      input.serverModuleStore.clearPresenceError();

      if (!sessionToken || !serverId) {
        return;
      }

      try {
        const stop = await subscribeToServerLiveState({
          sessionToken,
          serverId,
          onServerUpdated: (payload) => {
            input.serverModuleStore.applyLiveServerUpdated(payload);
          },
          onChannelsUpdated: (payload) => {
            input.serverModuleStore.applyLiveChannelsUpdated(payload);
          },
          onPresenceUpdated: (payload) => {
            const soundCue = resolvePresenceSoundCue({
              currentUserId: input.authStore.currentUser?.id ?? null,
              currentChannelId: input.serverModuleStore.currentUserPresence?.channelId ?? null,
              payload,
            });

            input.serverModuleStore.applyPresenceUpdated(payload);

            if (soundCue === "join") {
              playJoinChannelSound();
            }

            if (soundCue === "leave") {
              playLeaveChannelSound();
            }
          },
        });

        if (isDisposed || subscriptionVersion !== serverLiveSubscriptionVersion) {
          await stop();
          return;
        }

        stopServerLiveSubscription = stop;
      } catch (error) {
        if (isDisposed || subscriptionVersion !== serverLiveSubscriptionVersion) {
          return;
        }

        input.serverModuleStore.presenceErrorMessage = toRealtimeErrorMessage(error);
      }
    },
    {
      immediate: true,
    },
  );

  watch(
    [
      input.selectedServerId,
      () => input.serverModuleStore.currentUserPresence?.channelId ?? null,
      () => input.serverModuleStore.isChangingPresence,
    ],
    ([serverId, activeChannelId, isChangingPresence]) => {
      if (!serverId || !activeChannelId || isChangingPresence) {
        return;
      }

      const targetRoute = buildAppServerChannelRoute(serverId, activeChannelId);

      if (input.router.currentRoute.value.path === targetRoute) {
        return;
      }

      void input.router.replace(targetRoute);
    },
    {
      immediate: true,
    },
  );

  onUnmounted(() => {
    if (!stopServerLiveSubscription) {
      return;
    }

    const stop = stopServerLiveSubscription;
    stopServerLiveSubscription = null;
    void stop();
  });
}

/**
 * Определяет, какой cue sound нужно воспроизвести для входа/выхода из текущего канала.
 */
function resolvePresenceSoundCue(input: {
  currentUserId: string | null;
  currentChannelId: string | null;
  payload: ClientPresenceUpdatedEventPayload;
}): PresenceSoundCue {
  const { currentUserId, currentChannelId, payload } = input;

  if (!currentUserId) {
    return null;
  }

  if (payload.member.userId === currentUserId) {
    if (payload.action === "joined") {
      return "join";
    }

    if (payload.action === "left") {
      return "leave";
    }

    return "join";
  }

  if (!currentChannelId) {
    return null;
  }

  if (payload.action === "joined" && payload.member.channelId === currentChannelId) {
    return "join";
  }

  if (payload.action === "left" && payload.previousChannelId === currentChannelId) {
    return "leave";
  }

  if (payload.action !== "moved") {
    return null;
  }

  if (
    payload.previousChannelId === currentChannelId &&
    payload.member.channelId !== currentChannelId
  ) {
    return "leave";
  }

  if (
    payload.member.channelId === currentChannelId &&
    payload.previousChannelId !== currentChannelId
  ) {
    return "join";
  }

  return null;
}

/**
 * Приводит ошибку realtime-подписки к читаемому сообщению.
 */
function toRealtimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось подключить live-обновления сервера.";
}
