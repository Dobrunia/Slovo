import { beforeEach, describe, expect, test, vi } from "vitest";
import { nextTick } from "vue";

describe("voice level preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  /**
   * Проверяется, что громкость конкретного участника канала
   * сохраняется по его userId и переживает повторное создание composable.
   * Это важно, потому что пользователь должен один раз настроить комфортную
   * громкость собеседника и затем видеть то же значение после обновления страницы.
   * Граничные случаи: используется не значение по умолчанию, а кастомный уровень,
   * и он должен быть прочитан из localStorage при новом импорте модуля.
   */
  test("should persist playback volume by user id", async () => {
    const firstModule = await import("../src/composables/useVoiceLevelPreferences");
    const firstPreferences = firstModule.useVoiceLevelPreferences();

    firstPreferences.setPlaybackVolume("user-2", 145);
    await nextTick();

    vi.resetModules();

    const secondModule = await import("../src/composables/useVoiceLevelPreferences");
    const secondPreferences = secondModule.useVoiceLevelPreferences();

    expect(secondPreferences.getPlaybackVolume("user-2")).toBe(145);
  });

  /**
   * Проверяется, что уровень исходящего микрофона пользователя
   * нормализуется в допустимый диапазон и тоже сохраняется между сессиями.
   * Это важно, потому что UI не должен хранить некорректные значения громкости,
   * а пользовательская настройка собственного микрофона должна быть стабильной.
   * Граничные случаи: значение специально выходит за верхнюю границу,
   * и composable обязан зажать его до максимально допустимого уровня.
   */
  test("should clamp and persist microphone gain", async () => {
    const firstModule = await import("../src/composables/useVoiceLevelPreferences");
    const firstPreferences = firstModule.useVoiceLevelPreferences();

    firstPreferences.setMicrophoneGain(260);
    await nextTick();

    vi.resetModules();

    const secondModule = await import("../src/composables/useVoiceLevelPreferences");
    const secondPreferences = secondModule.useVoiceLevelPreferences();

    expect(secondPreferences.microphoneGain.value).toBe(200);
  });
});
