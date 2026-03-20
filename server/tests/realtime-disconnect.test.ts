import assert from "node:assert/strict";
import test from "node:test";
import { handleRealtimeDisconnectCleanup } from "../src/realtime/disconnect.js";

test("should clear runtime presence and emit a left event when realtime connection is lost", async () => {
  /*
   * Проверяем главный corner case: пользователь уже сидит в канале,
   * затем соединение рвется или страница обновляется. В этом сценарии
   * сервер обязан убрать presence пользователя и разослать left-событие,
   * иначе после refresh/disconnect останется stale-состояние в канале.
   */
  const presenceMember = {
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    displayName: "Dobrynya",
    avatarUrl: null,
    joinedAt: "2026-03-18T10:00:00.000Z",
    connectionId: "connection-1",
  };
  const emittedPayloads: Array<{
    serverId: string;
    member: Omit<typeof presenceMember, "connectionId">;
    previousChannelId: string | null;
    action: "left";
    occurredAt: string;
  }> = [];
  let clearedUserId: string | null = null;

  const result = await handleRealtimeDisconnectCleanup({
    userId: "user-1",
    connectionId: "connection-1",
    presenceRegistry: {
      getUserPresenceRecord(userId) {
        return userId === "user-1" ? presenceMember : null;
      },
      clearPresenceForConnection(input) {
        clearedUserId = input.userId;
        return { removed: true };
      },
    },
    emitPresenceUpdated(payload) {
      emittedPayloads.push(payload);
    },
  });

  assert.equal(result, true);
  assert.equal(clearedUserId, "user-1");
  assert.equal(emittedPayloads.length, 1);
  assert.equal(emittedPayloads[0]?.serverId, "server-1");
  assert.equal(emittedPayloads[0]?.previousChannelId, "channel-1");
  assert.equal(emittedPayloads[0]?.action, "left");
  assert.deepEqual(emittedPayloads[0]?.member, {
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    displayName: "Dobrynya",
    avatarUrl: null,
    joinedAt: "2026-03-18T10:00:00.000Z",
  });
  assert.ok(Boolean(emittedPayloads[0]?.occurredAt));
});

test("should skip disconnect cleanup when the user has no active channel presence", async () => {
  /*
   * Проверяем безопасный no-op сценарий: соединение оборвалось, но пользователь
   * уже не находится ни в одном канале. Важно не слать лишний left-event и не
   * трогать registry без необходимости, иначе можно получить ложные удаления.
   */
  let clearPresenceCalls = 0;
  let emitCalls = 0;

  const result = await handleRealtimeDisconnectCleanup({
    userId: "user-2",
    connectionId: "connection-2",
    presenceRegistry: {
      getUserPresenceRecord() {
        return null;
      },
      clearPresenceForConnection() {
        clearPresenceCalls += 1;
        return null;
      },
    },
    emitPresenceUpdated() {
      emitCalls += 1;
    },
  });

  assert.equal(result, false);
  assert.equal(clearPresenceCalls, 0);
  assert.equal(emitCalls, 0);
});

test("should skip disconnect cleanup when another connection already owns the active presence", async () => {
  /*
   * Проверяем ownership corner case: старый сокет отключился уже после того,
   * как пользователь переподключился с новой вкладки или устройства. Важно,
   * чтобы disconnect старого соединения не снес presence нового владельца.
   */
  let clearPresenceCalls = 0;
  let emitCalls = 0;

  const result = await handleRealtimeDisconnectCleanup({
    userId: "user-1",
    connectionId: "stale-connection",
    presenceRegistry: {
      getUserPresenceRecord() {
        return {
          userId: "user-1",
          serverId: "server-1",
          channelId: "channel-1",
          displayName: "Dobrynya",
          avatarUrl: null,
          joinedAt: "2026-03-18T10:00:00.000Z",
          connectionId: "fresh-connection",
        };
      },
      clearPresenceForConnection() {
        clearPresenceCalls += 1;
        return null;
      },
    },
    emitPresenceUpdated() {
      emitCalls += 1;
    },
  });

  assert.equal(result, false);
  assert.equal(clearPresenceCalls, 0);
  assert.equal(emitCalls, 0);
});
