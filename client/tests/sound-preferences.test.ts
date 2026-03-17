import { beforeEach, describe, expect, test, vi } from "vitest";
import { ref } from "vue";

const playJoinChannelSoundRaw = vi.fn();
const playLeaveChannelSoundRaw = vi.fn();

vi.mock("@vueuse/sound", () => ({
  useSound: vi.fn((src: string) => ({
    play: src.includes("join-channel") ? playJoinChannelSoundRaw : playLeaveChannelSoundRaw,
  })),
}));

describe("sound preferences", () => {
  beforeEach(() => {
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
