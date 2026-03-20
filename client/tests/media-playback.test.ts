import { afterEach, describe, expect, test } from "vitest";
import {
  clearRealtimeError,
  subscribeToRealtimeErrors,
} from "../src/realtime/errors";
import {
  ensureRemoteAudioPlayback,
  releaseRemoteAudioPlayback,
} from "../src/realtime/mediaPlayback";
import type { ClientRealtimeRuntimeError } from "../src/types/server";

describe("media playback", () => {
  afterEach(() => {
    clearRealtimeError();
  });

  test("should report blocked playback and retry it after the next user gesture", async () => {
    /*
     * Проверяется, что blocked autoplay remote audio больше не глотается молча,
     * а переводится в явный retry flow через следующее действие пользователя.
     * Это важно, потому что иначе клиент выглядит подключенным к каналу,
     * но реально не воспроизводит звук без какого-либо сигнала в UI/state.
     * Граничный случай: первый `play()` падает из-за autoplay policy,
     * а второй успешно проходит после `pointerdown` и должен очистить error channel.
     */
    const audioElement = document.createElement("audio");
    const playMock = Object.assign(
      async () => undefined,
      {
        mockName: "play",
      },
    );
    let playCalls = 0;

    Object.defineProperty(audioElement, "srcObject", {
      configurable: true,
      writable: true,
      value: {},
    });
    Object.defineProperty(audioElement, "play", {
      configurable: true,
      writable: true,
      value: async () => {
        playCalls += 1;

        if (playCalls === 1) {
          throw new Error("Autoplay blocked.");
        }

        return playMock();
      },
    });

    const observedErrors: Array<ClientRealtimeRuntimeError | null> = [];
    const stopRealtimeErrors = subscribeToRealtimeErrors((error) => {
      observedErrors.push(error);
    });

    await ensureRemoteAudioPlayback(audioElement);

    expect(observedErrors.at(-1)).toMatchObject({
      scope: "media-playback",
      message: "Autoplay blocked.",
      recoverable: true,
    });

    window.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(playCalls).toBe(2);
    expect(observedErrors.at(-1)).toBeNull();

    releaseRemoteAudioPlayback(audioElement);
    stopRealtimeErrors();
  });
});
