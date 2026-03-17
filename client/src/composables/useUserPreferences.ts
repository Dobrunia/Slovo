import { computed, ref } from "vue";

const USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY = "slovo.sound-enabled";
const isSoundEnabledState = ref(true);
let isUserPreferencesInitialized = false;

/**
 * Возвращает persisted-настройки пользователя, доступные на клиенте без серверного roundtrip.
 */
export function useUserPreferences() {
  ensureUserPreferencesInitialized();

  /**
   * Сохраняет новое состояние глобального звука приложения.
   */
  function setSoundEnabled(nextValue: boolean): void {
    isSoundEnabledState.value = nextValue;

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(nextValue),
    );
  }

  return {
    isSoundEnabled: computed({
      get: () => isSoundEnabledState.value,
      set: setSoundEnabled,
    }),
    setSoundEnabled,
  };
}

/**
 * Один раз инициализирует client-side настройки пользователя из localStorage.
 */
function ensureUserPreferencesInitialized(): void {
  if (isUserPreferencesInitialized || typeof window === "undefined") {
    return;
  }

  isUserPreferencesInitialized = true;
  const storedSoundEnabledValue = window.localStorage.getItem(
    USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY,
  );

  if (storedSoundEnabledValue === null) {
    return;
  }

  try {
    const parsedValue = JSON.parse(storedSoundEnabledValue);

    if (typeof parsedValue === "boolean") {
      isSoundEnabledState.value = parsedValue;
    }
  } catch {
    window.localStorage.removeItem(USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY);
  }
}
