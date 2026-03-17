import { useSound } from "@vueuse/sound";
import { Howler } from "howler";
import joinChannelSound from "../assets/sounds/join-channel.mp3";
import leaveChannelSound from "../assets/sounds/leave-channel.mp3";
import { useUserPreferences } from "./useUserPreferences";

type RawSoundPlayer = (() => void) | null;

let playJoinChannelSoundRaw: RawSoundPlayer = null;
let playLeaveChannelSoundRaw: RawSoundPlayer = null;
let isAudioUnlockPrepared = false;

/**
 * Возвращает единый набор коротких UI-звуков приложения.
 *
 * Инициализация howler откладывается до первого пользовательского действия,
 * чтобы браузер не блокировал AudioContext на этапе загрузки страницы.
 */
export function useAppSounds() {
  const { isSoundEnabled } = useUserPreferences();

  prepareAudioUnlock();

  /**
   * Проигрывает звук входа в канал, если звуки пользователя включены.
   */
  function playJoinChannelSound(): void {
    if (!isSoundEnabled.value) {
      return;
    }

    ensureSoundPlayers();
    void resumeAudioContext();
    playJoinChannelSoundRaw?.();
  }

  /**
   * Проигрывает звук выхода из канала, если звуки пользователя включены.
   */
  function playLeaveChannelSound(): void {
    if (!isSoundEnabled.value) {
      return;
    }

    ensureSoundPlayers();
    void resumeAudioContext();
    playLeaveChannelSoundRaw?.();
  }

  return {
    playJoinChannelSound,
    playLeaveChannelSound,
  };
}

/**
 * Один раз на приложение подготавливает gesture-based unlock для howler.
 */
function prepareAudioUnlock(): void {
  if (typeof window === "undefined" || isAudioUnlockPrepared) {
    return;
  }

  isAudioUnlockPrepared = true;

  const unlockAudio = () => {
    ensureSoundPlayers();
    void resumeAudioContext();
    removeUnlockListeners();
  };

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

/**
 * Ленивая инициализация sound players, чтобы не создавать AudioContext
 * до первого пользовательского взаимодействия или реального проигрывания.
 */
function ensureSoundPlayers(): void {
  if (playJoinChannelSoundRaw && playLeaveChannelSoundRaw) {
    return;
  }

  const { play: playJoin } = useSound(joinChannelSound, {
    interrupt: true,
  });
  const { play: playLeave } = useSound(leaveChannelSound, {
    interrupt: true,
  });

  playJoinChannelSoundRaw = playJoin;
  playLeaveChannelSoundRaw = playLeave;
}

/**
 * Аккуратно возобновляет howler AudioContext после пользовательского действия.
 */
async function resumeAudioContext(): Promise<void> {
  if (!Howler.ctx || Howler.ctx.state === "running") {
    return;
  }

  try {
    await Howler.ctx.resume();
  } catch {
    // Браузер может отказать до пользовательского действия; повторная попытка будет позже.
  }
}
