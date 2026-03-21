import { useSound } from "@vueuse/sound";
import joinChannelSoundSrc from "../assets/sounds/join-channel.mp3";
import leaveChannelSoundSrc from "../assets/sounds/leave-channel.mp3";
import muteUnmuteSoundSrc from "../assets/sounds/mute-unmute.mp3";
import startStreamSoundSrc from "../assets/sounds/start-stream.mp3";
import stopStreamSoundSrc from "../assets/sounds/stop-stream.mp3";

const SOUND_ENABLED_STORAGE_KEY = "slovo.sound-enabled";

/**
 * Проверяет, разрешены ли звуки пользовательской настройкой.
 */
function isSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== "false";
}

/**
 * Безопасно воспроизводит звук, если он не отключен пользовательской настройкой.
 */
function playIfEnabled(play: () => void): void {
  if (!isSoundEnabled()) {
    return;
  }

  try {
    play();
  } catch {
    // Ошибка playback не должна ронять UI-сценарий.
  }
}

/**
 * Предоставляет централизованный API UI-звуков приложения.
 */
export function useAppSounds() {
  const { play: playJoinRaw } = useSound(joinChannelSoundSrc);
  const { play: playLeaveRaw } = useSound(leaveChannelSoundSrc);
  const { play: playMuteUnmuteRaw } = useSound(muteUnmuteSoundSrc);
  const { play: playStartStreamRaw } = useSound(startStreamSoundSrc);
  const { play: playStopStreamRaw } = useSound(stopStreamSoundSrc);

  const playJoin = (): void => {
    playIfEnabled(playJoinRaw);
  };

  const playLeave = (): void => {
    playIfEnabled(playLeaveRaw);
  };

  const playMuteUnmute = (): void => {
    playIfEnabled(playMuteUnmuteRaw);
  };

  const playStartStream = (): void => {
    playIfEnabled(playStartStreamRaw);
  };

  const playStopStream = (): void => {
    playIfEnabled(playStopStreamRaw);
  };

  return {
    playJoin,
    playLeave,
    playMuteUnmute,
    playStartStream,
    playStopStream,
    playJoinChannel: playJoin,
    playLeaveChannel: playLeave,
    playJoinChannelSound: playJoin,
    playLeaveChannelSound: playLeave,
    playMuteUnmuteSound: playMuteUnmute,
    playStartStreamSound: playStartStream,
    playStopStreamSound: playStopStream,
  };
}
