import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  describeRealtimeContracts,
  REALTIME_CHANNEL_NAMES,
  REALTIME_COMMAND_NAMES,
  REALTIME_EVENT_NAMES,
} from "../../shared/realtime/names.js";
import { createSlovoRealtimeServer } from "../src/realtime/runtime.js";

test("should describe all required realtime contract names for the project", () => {
  /**
   * Проверяется, что shared contracts действительно покрывают обязательные каналы, события и команды из текущей задачи.
   * Это важно, потому что дальнейшая realtime-логика клиента и сервера должна опираться на один и тот же согласованный словарь имен.
   * Граничный случай здесь — незаметная потеря одного из required contracts при рефакторинге, особенно для signaling или forced disconnect.
   */
  assert.deepEqual(describeRealtimeContracts(), {
    channels: Object.values(REALTIME_CHANNEL_NAMES),
    events: Object.values(REALTIME_EVENT_NAMES),
    commands: Object.values(REALTIME_COMMAND_NAMES),
  });
});

test("should build the server realtime foundation with the shared registry", async () => {
  /**
   * Проверяется, что общий registry реально совместим с серверным LiveRail foundation и Socket.IO transport.
   * Это важно, потому что задача не ограничивается декларацией contracts: runtime должен подниматься на том же наборе имен и схем без дополнительной ручной синхронизации.
   * Граничный случай — создание foundation на ephemeral HTTP-порту, чтобы тест оставался быстрым и не зависел от фиксированных локальных портов.
   */
  const httpServer = createServer();
  const realtime = createSlovoRealtimeServer({
    httpServer,
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });

  assert.ok(realtime.io);
  assert.ok(realtime.runtime);
  assert.ok(realtime.adapter);

  await new Promise<void>((resolve, reject) => {
    realtime.io.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});
