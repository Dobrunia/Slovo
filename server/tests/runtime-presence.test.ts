import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";

/**
 * Проверяется, что runtime-модель допускает только одно активное присутствие
 * на пользователя и при новом входе корректно переносит его в новый канал.
 * Это важно, потому что voice-модель продукта предполагает одно текущее присутствие,
 * а не дублирование одного и того же пользователя в нескольких каналах сразу.
 * Граничные случаи: пользователь сначала входит в один канал, затем переходит
 * в другой канал того же сервера, и старый канал должен очиститься автоматически.
 */
test("should keep only one active channel presence per user", () => {
  const registry = createRuntimePresenceRegistry();

  const firstJoin = registry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
    occurredAt: "2026-03-17T12:00:00.000Z",
  });

  const secondJoin = registry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-2",
    occurredAt: "2026-03-17T12:01:00.000Z",
  });

  assert.equal(firstJoin.previous, null);
  assert.deepEqual(secondJoin.previous, {
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
    joinedAt: "2026-03-17T12:00:00.000Z",
  });
  assert.deepEqual(registry.getUserPresence("user-1"), {
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-2",
    joinedAt: "2026-03-17T12:01:00.000Z",
  });
  assert.deepEqual(registry.getServerPresence("server-1"), [
    {
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: null,
      serverId: "server-1",
      channelId: "channel-2",
      joinedAt: "2026-03-17T12:01:00.000Z",
    },
  ]);
});

/**
 * Проверяется, что runtime-модель умеет убирать пользователя из присутствия
 * и при переходе между серверами возвращает snapshot-и обеих сторон.
 * Это важно, потому что later live-слой должен отдельно обновлять прошлый сервер,
 * из которого пользователь ушел, и новый сервер, в который он вошел.
 * Граничные случаи: перенос идет между разными серверами, а после явного выхода
 * у пользователя больше не должно оставаться активного presence вообще.
 */
test("should expose both previous and next server snapshots for cross-server moves and leave", () => {
  const registry = createRuntimePresenceRegistry();

  registry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: "https://cdn.example.com/avatar.png",
    serverId: "server-1",
    channelId: "channel-1",
    occurredAt: "2026-03-17T12:00:00.000Z",
  });
  registry.setPresence({
    userId: "user-2",
    displayName: "Алиса",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-2",
    occurredAt: "2026-03-17T12:00:30.000Z",
  });

  const move = registry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: "https://cdn.example.com/avatar.png",
    serverId: "server-2",
    channelId: "channel-9",
    occurredAt: "2026-03-17T12:02:00.000Z",
  });

  assert.deepEqual(move.currentServerPresence, [
    {
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: "https://cdn.example.com/avatar.png",
      serverId: "server-2",
      channelId: "channel-9",
      joinedAt: "2026-03-17T12:02:00.000Z",
    },
  ]);
  assert.deepEqual(move.previousServerPresence, [
    {
      userId: "user-2",
      displayName: "Алиса",
      avatarUrl: null,
      serverId: "server-1",
      channelId: "channel-2",
      joinedAt: "2026-03-17T12:00:30.000Z",
    },
  ]);

  const leave = registry.clearPresence("user-1");

  assert.deepEqual(leave, {
    previous: {
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: "https://cdn.example.com/avatar.png",
      serverId: "server-2",
      channelId: "channel-9",
      joinedAt: "2026-03-17T12:02:00.000Z",
    },
    previousServerPresence: [],
  });
  assert.equal(registry.getUserPresence("user-1"), null);
});
