import { useSound } from "@vueuse/sound";
import joinChannelSound from "../assets/sounds/join-channel.mp3";
import leaveChannelSound from "../assets/sounds/leave-channel.mp3";
import { useUserPreferences } from "./useUserPreferences";

/**
 * Возвращает единый набор коротких UI-звуков приложения.
 *
 * Звуки инициализируются в setup-time, чтобы `@vueuse/sound` не вызывал
 * lifecycle hooks вне активного компонента. Для коротких cue-звуков используется
 * `html5`-режим howler, чтобы не упираться в ранний AudioContext startup.
 */
export function useAppSounds() {
  const { isSoundEnabled } = useUserPreferences();
  const { play: playJoinChannelSoundRaw } = useSound(joinChannelSound, {
    interrupt: true,
    html5: true,
  });
  const { play: playLeaveChannelSoundRaw } = useSound(leaveChannelSound, {
    interrupt: true,
    html5: true,
  });

  /**
   * Проигрывает звук входа в канал, если глобальные звуки включены.
   */
  function playJoinChannelSound(): void {
    if (!isSoundEnabled.value) {
      return;
    }

    playJoinChannelSoundRaw();
  }

  /**
   * Проигрывает звук выхода из канала, если глобальные звуки включены.
   */
  function playLeaveChannelSound(): void {
    if (!isSoundEnabled.value) {
      return;
    }

    playLeaveChannelSoundRaw();
  }

  return {
    playJoinChannelSound,
    playLeaveChannelSound,
  };
}
