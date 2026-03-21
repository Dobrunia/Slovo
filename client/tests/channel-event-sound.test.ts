import { describe, expect, test } from "vitest";
import {
  collectScreenShareEventSounds,
  collectVoiceStateEventSounds,
} from "../src/realtime/channel-event-sound";

describe("channel event sounds", () => {
  /**
   * Проверяется, что смена эффективного состояния микрофона у участника
   * текущего канала приводит к воспроизведению mute/unmute cue.
   * Это важно, потому что звук должен слышать каждый участник того же канала,
   * а не только сам пользователь, который нажал кнопку mute.
   * Граничные случаи: в проверке участвует именно текущий канал пользователя,
   * а изменение считается и для mute, и для deafen как блокировки микрофона.
   */
  test("should emit a mute cue when a member in the current channel changes effective mic state", () => {
    const sounds = collectVoiceStateEventSounds({
      currentUserPresence: {
        serverId: "server-1",
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-21T10:00:00.000Z",
      },
      presenceMembers: [
        {
          userId: "user-1",
          displayName: "Добрыня",
          avatarUrl: null,
          channelId: "channel-1",
          joinedAt: "2026-03-21T10:00:00.000Z",
        },
        {
          userId: "user-2",
          displayName: "Участник",
          avatarUrl: null,
          channelId: "channel-1",
          joinedAt: "2026-03-21T10:00:01.000Z",
        },
      ],
      previousVoiceStates: {
        "user-2": {
          muted: false,
          deafened: false,
          speaking: false,
          connectionQuality: null,
        },
      },
      nextVoiceStates: {
        "user-2": {
          muted: true,
          deafened: false,
          speaking: false,
          connectionQuality: null,
        },
      },
    });

    expect(sounds).toEqual(["mute-unmute"]);
  });

  /**
   * Проверяется, что mute/deafen события участника из другого канала
   * не должны издавать звук у текущего слушателя.
   * Это важно, потому что audio cues обязаны быть локализованы
   * только внутри того voice-канала, где сейчас находится пользователь.
   * Граничные случаи: voice state меняется валидно, но presence пользователя
   * указывает на другой канал того же сервера.
   */
  test("should ignore mute cues from another channel", () => {
    const sounds = collectVoiceStateEventSounds({
      currentUserPresence: {
        serverId: "server-1",
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-21T10:00:00.000Z",
      },
      presenceMembers: [
        {
          userId: "user-2",
          displayName: "Участник",
          avatarUrl: null,
          channelId: "channel-2",
          joinedAt: "2026-03-21T10:00:01.000Z",
        },
      ],
      previousVoiceStates: {
        "user-2": {
          muted: false,
          deafened: false,
          speaking: false,
          connectionQuality: null,
        },
      },
      nextVoiceStates: {
        "user-2": {
          muted: true,
          deafened: false,
          speaking: false,
          connectionQuality: null,
        },
      },
    });

    expect(sounds).toEqual([]);
  });

  /**
   * Проверяется, что старт и остановка стрима в текущем канале
   * корректно превращаются в start/stop cue sounds.
   * Это важно, потому что участники должны мгновенно слышать,
   * что кто-то начал или завершил трансляцию внутри их канала.
   * Граничные случаи: учитывается только текущая пара serverId/channelId,
   * а изменения в других каналах не должны попадать в результат.
   */
  test("should emit start and stop stream cues for screen share changes in the current channel", () => {
    const startSounds = collectScreenShareEventSounds({
      currentUserPresence: {
        serverId: "server-1",
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-21T10:00:00.000Z",
      },
      previousScreenShareStates: [],
      nextScreenShareStates: [
        {
          userId: "user-2",
          serverId: "server-1",
          channelId: "channel-1",
        },
      ],
    });

    const stopSounds = collectScreenShareEventSounds({
      currentUserPresence: {
        serverId: "server-1",
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-21T10:00:00.000Z",
      },
      previousScreenShareStates: [
        {
          userId: "user-2",
          serverId: "server-1",
          channelId: "channel-1",
        },
      ],
      nextScreenShareStates: [],
    });

    expect(startSounds).toEqual(["start-stream"]);
    expect(stopSounds).toEqual(["stop-stream"]);
  });
});
