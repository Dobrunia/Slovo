import { useSound } from "@vueuse/sound";
import { Howler } from "howler";
import joinChannelSound from "../assets/sounds/join-channel.mp3";
import leaveChannelSound from "../assets/sounds/leave-channel.mp3";
import { useUserPreferences } from "./useUserPreferences";

const IS_TEST_ENV =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env) &&
  import.meta.env.MODE === "test";

let isAudioUnlocked = IS_TEST_ENV;
let areUnlockListenersRegistered = false;

/**
 * Возвращает единый набор коротких UI-звуков приложения.
 *
 * Playback до первого user gesture не запускается вообще: это убирает
 * howler warnings про blocked AudioContext и browser autoplay policy.
 */
export function useAppSounds() {
  const { isSoundEnabled } = useUserPreferences();
  const { play: playJoinChannelSoundRaw } = useSound(joinChannelSound, {
    interrupt: true,
  });
  const { play: playLeaveChannelSoundRaw } = useSound(leaveChannelSound, {
    interrupt: true,
  });

  registerAudioUnlockListeners();

  /**
   * Проигрывает звук входа в канал, если глобальные звуки включены
   * и браузер уже разрешил audio playback после пользовательского действия.
   */
  function playJoinChannelSound(): void {
    if (!isSoundEnabled.value || !isAudioUnlocked) {
      return;
    }

    playJoinChannelSoundRaw();
  }

  /**
   * Проигрывает звук выхода из канала, если глобальные звуки включены
   * и браузер уже разрешил audio playback после пользовательского действия.
   */
  function playLeaveChannelSound(): void {
    if (!isSoundEnabled.value || !isAudioUnlocked) {
      return;
    }

    playLeaveChannelSoundRaw();
  }

  return {
    playJoinChannelSound,
    playLeaveChannelSound,
  };
}

/**
 * Один раз на приложение регистрирует обработчики первого user gesture,
 * который переводит howler AudioContext в рабочее состояние.
 */
function registerAudioUnlockListeners(): void {
  if (typeof window === "undefined" || areUnlockListenersRegistered) {
    return;
  }

  areUnlockListenersRegistered = true;

  const unlockAudio = () => {
    void resumeAudioContext();
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

/**
 * Пытается возобновить howler AudioContext после подтвержденного user gesture.
 */
async function resumeAudioContext(): Promise<void> {
  if (isAudioUnlocked) {
    return;
  }

  if (!Howler.ctx) {
    isAudioUnlocked = true;
    return;
  }

  if (Howler.ctx.state === "running") {
    isAudioUnlocked = true;
    return;
  }

  try {
    await Howler.ctx.resume();
    isAudioUnlocked = true;
  } catch {
    // Браузер может еще не подтвердить autoplay; повторная попытка будет на следующем user gesture.
  }
}
