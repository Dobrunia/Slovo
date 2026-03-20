import test from "node:test";
import assert from "node:assert/strict";
import { createShutdownCoordinator } from "../src/shutdown/coordinator.js";

test("should run graceful shutdown only once for repeated signals", async () => {
  /**
   * Проверяется, что graceful shutdown coordinator идемпотентен
   * и повторный сигнал завершения не запускает второй параллельный teardown.
   * Это важно, потому что stop/restart процесса не должен гонять повторное закрытие
   * сокетов, HTTP-сервера и data layer в недетерминированном порядке.
   * Граничный случай: второй вызов `shutdown()` приходит до завершения первого
   * и обязан вернуть тот же promise без повторного запуска шагов.
   */
  const executionOrder: string[] = [];

  const coordinator = createShutdownCoordinator({
    closeRealtime: async () => {
      executionOrder.push("realtime");
      await Promise.resolve();
    },
    closeHttpServer: async () => {
      executionOrder.push("http");
      await Promise.resolve();
    },
    closeMediaFoundation: async () => {
      executionOrder.push("media");
      await Promise.resolve();
    },
    disposeDataLayer: async () => {
      executionOrder.push("data");
      await Promise.resolve();
    },
  });

  const firstShutdown = coordinator.shutdown("SIGINT");
  const secondShutdown = coordinator.shutdown("SIGTERM");

  assert.equal(coordinator.isShuttingDown(), true);
  assert.equal(firstShutdown, secondShutdown);

  await firstShutdown;

  assert.deepEqual(executionOrder, ["realtime", "http", "media", "data"]);
});

test("should propagate shutdown errors after reporting them once", async () => {
  /**
   * Проверяется, что coordinator не глотает ошибку закрытия
   * и все равно использует единый error-path для вызывающего кода.
   * Это важно, потому что сбой graceful shutdown должен выставлять exitCode
   * и быть наблюдаемым, а не растворяться внутри fire-and-forget логики.
   * Граничный случай: ошибка возникает на первом шаге teardown,
   * поэтому последующие шаги уже не должны выполняться.
   */
  let reportedError: unknown = null;
  let closeHttpServerCalled = false;

  const coordinator = createShutdownCoordinator({
    closeRealtime: async () => {
      throw new Error("Realtime close failed.");
    },
    closeHttpServer: async () => {
      closeHttpServerCalled = true;
    },
    closeMediaFoundation: async () => undefined,
    disposeDataLayer: async () => undefined,
    onShutdownError: (error) => {
      reportedError = error;
    },
  });

  await assert.rejects(
    () => coordinator.shutdown("SIGTERM"),
    /Realtime close failed\./,
  );

  assert.equal(closeHttpServerCalled, false);
  assert.ok(reportedError instanceof Error);
  assert.equal((reportedError as Error).message, "Realtime close failed.");
});
