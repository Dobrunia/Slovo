import { beforeEach, describe, expect, test, vi } from "vitest";

const playJoinChannelSoundRaw = vi.fn();
const playLeaveChannelSoundRaw = vi.fn();

vi.mock("@vueuse/sound", () => ({
  useSound: vi.fn((src: string) => ({
    play: src.includes("join-channel") ? playJoinChannelSoundRaw : playLeaveChannelSoundRaw,
  })),
}));

describe("sound preferences", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    playJoinChannelSoundRaw.mockReset();
    playLeaveChannelSoundRaw.mockReset();
    vi.resetModules();
  });

  /**
   * Проверяется, что настройка звука сохраняется в localStorage и затем
   * повторно считывается из него при следующей инициализации composable.
   * Это важно, потому что пользователь ожидает, что отключение звуков
   * переживет перезагрузку страницы, а не сбросится к дефолту.
   * Граничные случаи: начальное состояние без сохраненного значения и повторная инициализация после записи `false`.
   */
  test("should persist the global sound flag in localStorage", async () => {
    const { useUserPreferences } = await import("../src/composables/useUserPreferences");

    const firstInstance = useUserPreferences();
    expect(firstInstance.isSoundEnabled.value).toBe(true);

    firstInstance.setSoundEnabled(false);
    expect(window.localStorage.getItem("slovo.sound-enabled")).toBe("false");

    vi.resetModules();
    const reloadedModule = await import("../src/composables/useUserPreferences");
    const secondInstance = reloadedModule.useUserPreferences();

    expect(secondInstance.isSoundEnabled.value).toBe(false);
  });

  /**
   * Проверяется, что выбранное устройство ввода сохраняется в localStorage
   * и затем восстанавливается при следующей инициализации composable.
   * Это важно, потому что пользователь не должен каждый раз после reload
   * заново выбирать свой микрофон перед подключением к каналу.
   * Граничные случаи: сначала настройки еще нет, затем сохраняется конкретный device id,
   * а после повторной инициализации он должен быть доступен без дополнительного roundtrip.
   */
  test("should persist the selected input device id in localStorage", async () => {
    const { useUserPreferences } = await import("../src/composables/useUserPreferences");

    const firstInstance = useUserPreferences();
    expect(firstInstance.selectedInputDeviceId.value).toBeNull();

    firstInstance.setSelectedInputDeviceId("microphone-2");
    expect(window.localStorage.getItem("slovo.input-device-id")).toBe("microphone-2");

    vi.resetModules();
    const reloadedModule = await import("../src/composables/useUserPreferences");
    const secondInstance = reloadedModule.useUserPreferences();

    expect(secondInstance.selectedInputDeviceId.value).toBe("microphone-2");
  });

  /**
   * Проверяется, что composable перечитывает список доступных микрофонов
   * через browser media devices API и сбрасывает выбор на первый доступный,
   * если сохраненное устройство больше не существует.
   * Это важно, потому что реальный hardware может отключиться между сессиями,
   * и клиент не должен пытаться бесконечно использовать невалидный device id.
   * Граничные случаи: сохранен устаревший id, список устройств не пустой,
   * а после refresh выбранным должен стать первый актуальный микрофон.
   */
  test("should refresh audio input devices and fall back from a stale saved selection", async () => {
    window.localStorage.setItem("slovo.input-device-id", "missing-device");
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            kind: "audioinput",
            deviceId: "microphone-1",
            label: "USB Mic",
          },
          {
            kind: "audioinput",
            deviceId: "microphone-2",
            label: "",
          },
          {
            kind: "audiooutput",
            deviceId: "speaker-1",
            label: "Speakers",
          },
        ]),
      },
    });

    const { useUserPreferences } = await import("../src/composables/useUserPreferences");
    const preferences = useUserPreferences();

    await preferences.refreshAudioInputDevices();

    expect(preferences.audioInputDevices.value).toEqual([
      {
        id: "microphone-1",
        label: "USB Mic",
      },
      {
        id: "microphone-2",
        label: "Микрофон 2",
      },
    ]);
    expect(preferences.selectedInputDeviceId.value).toBe("microphone-1");
    expect(window.localStorage.getItem("slovo.input-device-id")).toBe("microphone-1");
  });

  /**
   * Проверяется, что `useAppSounds` централизованно блокирует проигрывание,
   * когда пользователь отключил все звуки в настройках.
   * Это важно, потому что проверка не должна дублироваться в каждом месте,
   * где вызывается `play`, и один global toggle обязан работать для всех cue.
   * Граничные случаи: звук играет при включенном флаге и не играет после его отключения.
   */
  test("should play channel sounds only when global sound is enabled", async () => {
    const { useUserPreferences } = await import("../src/composables/useUserPreferences");
    const { useAppSounds } = await import("../src/composables/useAppSounds");

    const preferences = useUserPreferences();
    const sounds = useAppSounds();

    sounds.playJoinChannelSound();
    sounds.playLeaveChannelSound();

    expect(playJoinChannelSoundRaw).toHaveBeenCalledTimes(1);
    expect(playLeaveChannelSoundRaw).toHaveBeenCalledTimes(1);

    preferences.setSoundEnabled(false);

    sounds.playJoinChannelSound();
    sounds.playLeaveChannelSound();

    expect(playJoinChannelSoundRaw).toHaveBeenCalledTimes(1);
    expect(playLeaveChannelSoundRaw).toHaveBeenCalledTimes(1);
  });
});
