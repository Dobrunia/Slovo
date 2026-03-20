import { computed, ref } from "vue";

const USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY = "slovo.sound-enabled";
const USER_PREFERENCES_INPUT_DEVICE_ID_STORAGE_KEY = "slovo.input-device-id";
const isSoundEnabledState = ref(true);
const selectedInputDeviceIdState = ref<string | null>(null);
const audioInputDevicesState = ref<UserAudioInputDevice[]>([]);
const isRefreshingAudioInputDevicesState = ref(false);
let isUserPreferencesInitialized = false;

/**
 * Доступное устройство ввода звука для клиентских настроек.
 */
export interface UserAudioInputDevice {
  id: string;
  label: string;
}

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
    writeBooleanPreference(USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY, nextValue);
  }

  /**
   * Сохраняет выбранное устройство ввода звука для следующих voice-сессий.
   */
  function setSelectedInputDeviceId(nextValue: string | null): void {
    selectedInputDeviceIdState.value = normalizeOptionalString(nextValue);
    writeOptionalStringPreference(
      USER_PREFERENCES_INPUT_DEVICE_ID_STORAGE_KEY,
      selectedInputDeviceIdState.value,
    );
  }

  /**
   * Перечитывает список доступных микрофонов из browser media devices API.
   */
  async function refreshAudioInputDevices(): Promise<void> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      audioInputDevicesState.value = [];
      setSelectedInputDeviceId(null);
      return;
    }

    isRefreshingAudioInputDevicesState.value = true;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          id: device.deviceId,
          label:
            normalizeOptionalString(device.label) ??
            `Микрофон ${String(index + 1)}`,
        }));

      audioInputDevicesState.value = audioInputDevices;

      const hasCurrentSelection = audioInputDevices.some(
        (device) => device.id === selectedInputDeviceIdState.value,
      );

      if (!hasCurrentSelection) {
        setSelectedInputDeviceId(audioInputDevices[0]?.id ?? null);
      }
    } finally {
      isRefreshingAudioInputDevicesState.value = false;
    }
  }

  return {
    isSoundEnabled: computed({
      get: () => isSoundEnabledState.value,
      set: setSoundEnabled,
    }),
    selectedInputDeviceId: computed({
      get: () => selectedInputDeviceIdState.value,
      set: setSelectedInputDeviceId,
    }),
    audioInputDevices: computed(() => audioInputDevicesState.value),
    isRefreshingAudioInputDevices: computed(() => isRefreshingAudioInputDevicesState.value),
    setSoundEnabled,
    setSelectedInputDeviceId,
    refreshAudioInputDevices,
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
  const storedInputDeviceId = window.localStorage.getItem(
    USER_PREFERENCES_INPUT_DEVICE_ID_STORAGE_KEY,
  );

  if (storedSoundEnabledValue === null) {
    selectedInputDeviceIdState.value = normalizeOptionalString(storedInputDeviceId);
  } else {
    try {
      const parsedValue = JSON.parse(storedSoundEnabledValue);

      if (typeof parsedValue === "boolean") {
        isSoundEnabledState.value = parsedValue;
      }
    } catch {
      window.localStorage.removeItem(USER_PREFERENCES_SOUND_ENABLED_STORAGE_KEY);
    }
  }

  selectedInputDeviceIdState.value = normalizeOptionalString(storedInputDeviceId);
}

/**
 * Пишет boolean-настройку в localStorage, если браузерное окружение доступно.
 */
function writeBooleanPreference(storageKey: string, value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

/**
 * Пишет необязательную строковую настройку в localStorage или удаляет ее.
 */
function writeOptionalStringPreference(
  storageKey: string,
  value: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (value === null) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, value);
}

/**
 * Нормализует необязательный текст в непустую строку или `null`.
 */
function normalizeOptionalString(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
