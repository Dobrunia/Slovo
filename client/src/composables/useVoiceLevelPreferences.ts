import { ref, watch } from "vue";

const VOICE_PLAYBACK_VOLUMES_STORAGE_KEY = "slovo.voice-playback-volumes";
const VOICE_MICROPHONE_GAIN_STORAGE_KEY = "slovo.voice-microphone-gain";
const DEFAULT_VOICE_LEVEL = 100;
const MIN_VOICE_LEVEL = 0;
const MAX_VOICE_LEVEL = 200;

const playbackVolumes = ref<Record<string, number>>(readPlaybackVolumes());
const microphoneGain = ref<number>(readMicrophoneGain());
let isPersistenceBound = false;

/**
 * Возвращает persisted пользовательские настройки уровней громкости голосовых участников.
 */
export function useVoiceLevelPreferences() {
  bindPersistence();

  /**
   * Возвращает сохраненную громкость воспроизведения для конкретного участника канала.
   */
  function getPlaybackVolume(userId: string): number {
    return clampVoiceLevel(playbackVolumes.value[userId] ?? DEFAULT_VOICE_LEVEL);
  }

  /**
   * Сохраняет новую громкость воспроизведения для конкретного участника канала.
   */
  function setPlaybackVolume(userId: string, value: number): void {
    playbackVolumes.value = {
      ...playbackVolumes.value,
      [userId]: clampVoiceLevel(value),
    };

    dispatchVoiceLevelEvent("slovo:voice-playback-volume-changed", {
      userId,
      volume: getPlaybackVolume(userId),
    });
  }

  /**
   * Сохраняет новую громкость исходящего микрофона текущего пользователя.
   */
  function setMicrophoneGain(value: number): void {
    microphoneGain.value = clampVoiceLevel(value);

    dispatchVoiceLevelEvent("slovo:voice-microphone-gain-changed", {
      volume: microphoneGain.value,
    });
  }

  return {
    playbackVolumes,
    microphoneGain,
    getPlaybackVolume,
    setPlaybackVolume,
    setMicrophoneGain,
  };
}

/**
 * Привязывает persisted-сохранение к reactive настройкам единожды за runtime клиента.
 */
function bindPersistence(): void {
  if (isPersistenceBound) {
    return;
  }

  isPersistenceBound = true;

  watch(
    playbackVolumes,
    (value) => {
      getStorage()?.setItem(VOICE_PLAYBACK_VOLUMES_STORAGE_KEY, JSON.stringify(value));
    },
    {
      deep: true,
    },
  );

  watch(microphoneGain, (value) => {
    getStorage()?.setItem(VOICE_MICROPHONE_GAIN_STORAGE_KEY, String(value));
  });
}

/**
 * Читает сохраненные уровни громкости участников из localStorage.
 */
function readPlaybackVolumes(): Record<string, number> {
  const rawValue = getStorage()?.getItem(VOICE_PLAYBACK_VOLUMES_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const nextValue: Record<string, number> = {};

    for (const [userId, volume] of Object.entries(parsedValue)) {
      if (typeof volume === "number") {
        nextValue[userId] = clampVoiceLevel(volume);
      }
    }

    return nextValue;
  } catch {
    return {};
  }
}

/**
 * Читает сохраненный уровень микрофона текущего пользователя из localStorage.
 */
function readMicrophoneGain(): number {
  const rawValue = getStorage()?.getItem(VOICE_MICROPHONE_GAIN_STORAGE_KEY);

  if (!rawValue) {
    return DEFAULT_VOICE_LEVEL;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_VOICE_LEVEL;
  }

  return clampVoiceLevel(parsedValue);
}

/**
 * Ограничивает уровень громкости допустимым диапазоном.
 */
function clampVoiceLevel(value: number): number {
  return Math.max(MIN_VOICE_LEVEL, Math.min(MAX_VOICE_LEVEL, Math.round(value)));
}

/**
 * Возвращает browser localStorage, если он доступен в текущем окружении.
 */
function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

/**
 * Рассылает app-side событие об изменении voice level для будущих media listeners.
 */
function dispatchVoiceLevelEvent(
  eventName: string,
  detail: Record<string, number | string>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
    }),
  );
}
