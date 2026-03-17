import { describe, expect, test } from "vitest";
import { resolvePresenceSoundCue } from "../src/realtime/presence-sound";

describe("presence sound helper", () => {
  /**
   * Проверяется, что пользователь слышит звук входа, когда сам подключается к каналу
   * или когда другой участник заходит в тот же канал, где уже находится текущий пользователь.
   * Это важно, потому что именно join-событие должно подтверждать попадание в voice-контекст
   * и для самого пользователя, и для остальных участников этого же канала.
   * Граничные случаи: собственный join без предыдущего канала и join другого пользователя в тот же channelId.
   */
  test("should return join cue for self join and for another member entering the current channel", () => {
    expect(
      resolvePresenceSoundCue({
        currentUserId: "user-1",
        currentUserChannelId: null,
        payload: {
          serverId: "server-1",
          member: {
            userId: "user-1",
            displayName: "Добрыня",
            avatarUrl: null,
            channelId: "channel-1",
            joinedAt: "2026-03-18T00:00:00.000Z",
          },
          previousChannelId: null,
          action: "joined",
          occurredAt: "2026-03-18T00:00:00.000Z",
        },
      }),
    ).toBe("join");

    expect(
      resolvePresenceSoundCue({
        currentUserId: "user-1",
        currentUserChannelId: "channel-1",
        payload: {
          serverId: "server-1",
          member: {
            userId: "user-2",
            displayName: "Алиса",
            avatarUrl: null,
            channelId: "channel-1",
            joinedAt: "2026-03-18T00:00:00.000Z",
          },
          previousChannelId: null,
          action: "joined",
          occurredAt: "2026-03-18T00:00:00.000Z",
        },
      }),
    ).toBe("join");
  });

  /**
   * Проверяется, что пользователь слышит звук выхода, когда другой участник
   * покидает его текущий канал обычным leave или уходит из него через move.
   * Это важно, потому что логика "кто ушел из моего канала" не ограничивается
   * только прямым leave-событием и должна правильно работать и при переходе между каналами.
   * Граничные случаи: прямой left и moved с previousChannelId, совпадающим с каналом текущего пользователя.
   */
  test("should return leave cue when another member leaves the current channel", () => {
    expect(
      resolvePresenceSoundCue({
        currentUserId: "user-1",
        currentUserChannelId: "channel-1",
        payload: {
          serverId: "server-1",
          member: {
            userId: "user-2",
            displayName: "Алиса",
            avatarUrl: null,
            channelId: "channel-1",
            joinedAt: "2026-03-18T00:00:00.000Z",
          },
          previousChannelId: "channel-1",
          action: "left",
          occurredAt: "2026-03-18T00:01:00.000Z",
        },
      }),
    ).toBe("leave");

    expect(
      resolvePresenceSoundCue({
        currentUserId: "user-1",
        currentUserChannelId: "channel-1",
        payload: {
          serverId: "server-1",
          member: {
            userId: "user-2",
            displayName: "Алиса",
            avatarUrl: null,
            channelId: "channel-2",
            joinedAt: "2026-03-18T00:00:00.000Z",
          },
          previousChannelId: "channel-1",
          action: "moved",
          occurredAt: "2026-03-18T00:01:00.000Z",
        },
      }),
    ).toBe("leave");
  });

  /**
   * Проверяется, что пользователь не слышит чужие события из другого канала,
   * если сам сейчас не находится в связанном voice-контексте.
   * Это важно, потому что по требованию звуки должны слышать только участники
   * того же самого канала, а не все пользователи сервера.
   * Граничные случаи: текущий пользователь вообще вне канала и join другого участника в посторонний канал.
   */
  test("should stay silent for unrelated channels when the current user is not a participant there", () => {
    expect(
      resolvePresenceSoundCue({
        currentUserId: "user-1",
        currentUserChannelId: null,
        payload: {
          serverId: "server-1",
          member: {
            userId: "user-2",
            displayName: "Алиса",
            avatarUrl: null,
            channelId: "channel-1",
            joinedAt: "2026-03-18T00:00:00.000Z",
          },
          previousChannelId: null,
          action: "joined",
          occurredAt: "2026-03-18T00:00:00.000Z",
        },
      }),
    ).toBeNull();
  });
});
