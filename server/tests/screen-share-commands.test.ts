import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";
import { createRuntimeScreenShareRegistry } from "../src/realtime/screen-share.js";
import { setScreenShareActiveCommand } from "../src/realtime/screen-share-commands.js";

/**
 * Проверяется, что активный участник канала может включить демонстрацию экрана,
 * а сервер фиксирует это как runtime state и рассылает live-событие в канал.
 * Это важно, потому что screen share должен иметь server-authoritative состояние,
 * а не быть только локальным клиентским флагом.
 * Граничные случаи: первая активация идет без предыдущего состояния,
 * поэтому команда должна корректно создать его с нуля и не требовать доп. подготовки.
 */
test("should activate screen share for the active channel member", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  const screenShareRegistry = createRuntimeScreenShareRegistry();
  const emittedEvents: unknown[] = [];
  const teardownCalls: unknown[] = [];

  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });

  const result = await setScreenShareActiveCommand({
    presenceRegistry,
    screenShareRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    active: true,
    emitScreenShareUpdated(payload) {
      emittedEvents.push(payload);
      return Promise.resolve();
    },
    teardownScreenShare(payload) {
      teardownCalls.push(payload);
      return Promise.resolve();
    },
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(screenShareRegistry.getUserState("user-1"), {
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
  });
  assert.deepEqual(teardownCalls, []);
  assert.equal(emittedEvents.length, 1);
  assert.equal((emittedEvents[0] as { active: boolean }).active, true);
});

/**
 * Проверяется, что выключение демонстрации экрана очищает runtime state,
 * инициирует media teardown и отправляет событие `active=false`.
 * Это важно, потому что без такого cleanup пользователь мог бы визуально
 * оставаться шарящим экран, пока media-поток уже должен был быть снят.
 * Граничные случаи: у пользователя уже есть активная демонстрация,
 * и команда должна корректно перейти в выключенное состояние без дополнительных шагов.
 */
test("should tear down screen share and emit inactive state when disabled", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  const screenShareRegistry = createRuntimeScreenShareRegistry();
  const emittedEvents: unknown[] = [];
  const teardownCalls: unknown[] = [];

  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });
  screenShareRegistry.setState({
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
  });

  const result = await setScreenShareActiveCommand({
    presenceRegistry,
    screenShareRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    active: false,
    emitScreenShareUpdated(payload) {
      emittedEvents.push(payload);
      return Promise.resolve();
    },
    teardownScreenShare(payload) {
      teardownCalls.push(payload);
      return Promise.resolve();
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(screenShareRegistry.getUserState("user-1"), null);
  assert.deepEqual(teardownCalls, [
    {
      userId: "user-1",
      serverId: "server-1",
      channelId: "channel-1",
    },
  ]);
  assert.equal(emittedEvents.length, 1);
  assert.equal((emittedEvents[0] as { active: boolean }).active, false);
});

/**
 * Проверяется, что включение демонстрации экрана запрещено вне активного канала.
 * Это важно, потому что screen share должен быть привязан к реальному presence
 * пользователя, а не запускаться произвольной командой с подставленным channelId.
 * Граничные случаи: у пользователя вообще нет presence, поэтому ошибка должна
 * возникнуть до изменения runtime state и до любых side-effect-ов.
 */
test("should reject screen share changes outside the active channel", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  const screenShareRegistry = createRuntimeScreenShareRegistry();
  const emittedEvents: unknown[] = [];
  const teardownCalls: unknown[] = [];

  await assert.rejects(
    () =>
      setScreenShareActiveCommand({
        presenceRegistry,
        screenShareRegistry,
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
        active: true,
        emitScreenShareUpdated(payload) {
          emittedEvents.push(payload);
          return Promise.resolve();
        },
        teardownScreenShare(payload) {
          teardownCalls.push(payload);
          return Promise.resolve();
        },
      }),
    /демонстрацией экрана доступно только из активного канала/i,
  );

  assert.equal(screenShareRegistry.getUserState("user-1"), null);
  assert.deepEqual(emittedEvents, []);
  assert.deepEqual(teardownCalls, []);
});
