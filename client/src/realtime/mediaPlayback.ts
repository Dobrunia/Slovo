import {
  clearRealtimeError,
  createRealtimeRuntimeError,
  reportRealtimeError,
} from "./errors";

const AUDIO_PLAYBACK_UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

const blockedAudioElements = new Set<HTMLAudioElement>();
let unlockListenersAttached = false;

/**
 * Пытается запустить remote audio playback и переводит blocked autoplay
 * в явный retry flow через следующее пользовательское действие.
 */
export async function ensureRemoteAudioPlayback(
  audioElement: HTMLAudioElement,
): Promise<void> {
  if (audioElement.muted) {
    return;
  }

  try {
    await audioElement.play();
    releaseRemoteAudioPlayback(audioElement);
  } catch (error) {
    blockedAudioElements.add(audioElement);
    ensureAudioPlaybackUnlockListeners();
    reportRealtimeError(
      createRealtimeRuntimeError({
        scope: "media-playback",
        error,
        fallbackMessage:
          "Браузер заблокировал воспроизведение звука. Нажмите на страницу, чтобы включить звук.",
      }),
    );
  }
}

/**
 * Убирает audio element из blocked playback registry и снимает unlock-listeners при необходимости.
 */
export function releaseRemoteAudioPlayback(
  audioElement: HTMLAudioElement,
): void {
  blockedAudioElements.delete(audioElement);

  if (blockedAudioElements.size === 0) {
    clearRealtimeError("media-playback");
    removeAudioPlaybackUnlockListeners();
  }
}

async function retryBlockedAudioPlayback(): Promise<void> {
  for (const audioElement of Array.from(blockedAudioElements)) {
    if (audioElement.muted || audioElement.srcObject === null) {
      continue;
    }

    try {
      await audioElement.play();
      blockedAudioElements.delete(audioElement);
    } catch {
      continue;
    }
  }

  if (blockedAudioElements.size === 0) {
    clearRealtimeError("media-playback");
    removeAudioPlaybackUnlockListeners();
  }
}

function ensureAudioPlaybackUnlockListeners(): void {
  if (unlockListenersAttached) {
    return;
  }

  unlockListenersAttached = true;

  for (const eventName of AUDIO_PLAYBACK_UNLOCK_EVENTS) {
    window.addEventListener(eventName, handleAudioPlaybackUnlock);
  }
}

function removeAudioPlaybackUnlockListeners(): void {
  if (!unlockListenersAttached) {
    return;
  }

  unlockListenersAttached = false;

  for (const eventName of AUDIO_PLAYBACK_UNLOCK_EVENTS) {
    window.removeEventListener(eventName, handleAudioPlaybackUnlock);
  }
}

function handleAudioPlaybackUnlock(): void {
  void retryBlockedAudioPlayback();
}
