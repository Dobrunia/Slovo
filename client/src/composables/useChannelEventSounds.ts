import { watch } from "vue";
import { useAppSounds } from "./useAppSounds";
import {
  collectScreenShareEventSounds,
  collectVoiceStateEventSounds,
} from "../realtime/channel-event-sound";
import { useServerModuleStore } from "../stores/serverModule";
import type {
  ClientRuntimeMemberVoiceState,
  ClientRuntimeScreenShareState,
} from "../types/server";

/**
 * Создает независимую копию runtime voice state map для diff-сравнения между событиями.
 */
function cloneVoiceStateMap(
  source: Record<string, ClientRuntimeMemberVoiceState>,
): Record<string, ClientRuntimeMemberVoiceState> {
  return Object.fromEntries(
    Object.entries(source).map(([userId, voiceState]) => [userId, { ...voiceState }]),
  );
}

/**
 * Создает независимую копию screen share runtime state для diff-сравнения между событиями.
 */
function cloneScreenShareStates(
  source: ClientRuntimeScreenShareState[],
): ClientRuntimeScreenShareState[] {
  return source.map((state) => ({ ...state }));
}

/**
 * Подключает channel-wide звуки для mute/unmute и start/stop stream событий.
 */
export function useChannelEventSounds(serverModuleStore: ReturnType<typeof useServerModuleStore>): void {
  const appSounds = useAppSounds();

  let previousVoiceStates = cloneVoiceStateMap(serverModuleStore.memberVoiceStates);
  let previousScreenShareStates = cloneScreenShareStates(serverModuleStore.screenShareStates);

  watch(
    () => serverModuleStore.currentUserPresence,
    () => {
      previousVoiceStates = cloneVoiceStateMap(serverModuleStore.memberVoiceStates);
      previousScreenShareStates = cloneScreenShareStates(serverModuleStore.screenShareStates);
    },
    {
      immediate: true,
    },
  );

  watch(
    () => serverModuleStore.memberVoiceStates,
    (nextVoiceStates) => {
      const sounds = collectVoiceStateEventSounds({
        currentUserPresence: serverModuleStore.currentUserPresence,
        presenceMembers: serverModuleStore.presenceMembers,
        previousVoiceStates,
        nextVoiceStates,
      });

      previousVoiceStates = cloneVoiceStateMap(nextVoiceStates);

      for (const sound of sounds) {
        if (sound === "mute-unmute") {
          appSounds.playMuteUnmuteSound();
        }
      }
    },
    {
      deep: true,
    },
  );

  watch(
    () => serverModuleStore.screenShareStates,
    (nextScreenShareStates) => {
      const sounds = collectScreenShareEventSounds({
        currentUserPresence: serverModuleStore.currentUserPresence,
        previousScreenShareStates,
        nextScreenShareStates,
      });

      previousScreenShareStates = cloneScreenShareStates(nextScreenShareStates);

      for (const sound of sounds) {
        if (sound === "start-stream") {
          appSounds.playStartStreamSound();
          continue;
        }

        appSounds.playStopStreamSound();
      }
    },
    {
      deep: true,
    },
  );
}
