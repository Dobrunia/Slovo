import test from "node:test";
import assert from "node:assert/strict";
import {
  createRealtimeCorsOriginMatcher,
  isSocketIoRequest,
} from "../src/realtime/http.js";

test(
  "should detect socket.io transport requests and keep other application paths untouched",
  () => {
    /**
     * Проверяется, что серверный HTTP-слой умеет отличать transport-запросы
     * Socket.IO от обычных GraphQL/приложенческих запросов.
     * Это важно, потому что GraphQL handler не должен отвечать на `/socket.io`,
     * иначе transport получает 404 вместо handshake.
     * Граничные случаи: path без query, path с query и соседний `/graphql`.
     */
    assert.equal(isSocketIoRequest("/socket.io"), true);
    assert.equal(isSocketIoRequest("/socket.io/?EIO=4&transport=polling"), true);
    assert.equal(isSocketIoRequest("/socket.io?EIO=4&transport=polling"), true);
    assert.equal(isSocketIoRequest("/graphql"), false);
    assert.equal(isSocketIoRequest(undefined), false);
  },
);

test(
  "should allow both localhost and 127.0.0.1 variants for the same realtime dev origin",
  () => {
    /**
     * Проверяется, что dev-CORS matcher для realtime одинаково принимает
     * `localhost` и `127.0.0.1`, если они указывают на один и тот же порт.
     * Это важно, потому что браузер считает их разными origin, а разработчик
     * может открыть клиент по любому из двух адресов.
     * Граничные случаи: origin отсутствует, origin совпадает напрямую и origin совпадает через loopback-alias.
     */
    const matcher = createRealtimeCorsOriginMatcher("http://localhost:5173");

    const decisions: Array<{ error: Error | null; allow?: boolean }> = [];

    matcher(undefined, (error, allow) => {
      decisions.push({ error, allow });
    });
    matcher("http://localhost:5173", (error, allow) => {
      decisions.push({ error, allow });
    });
    matcher("http://127.0.0.1:5173", (error, allow) => {
      decisions.push({ error, allow });
    });

    assert.deepEqual(decisions, [
      { error: null, allow: true },
      { error: null, allow: true },
      { error: null, allow: true },
    ]);
  },
);

test(
  "should reject unrelated realtime origins",
  () => {
    /**
     * Проверяется, что matcher не открывает realtime transport для посторонних origin.
     * Это важно, потому что после расширения dev-совместимости нельзя превратить
     * transport в полностью открытый по CORS.
     * Граничный случай: origin на другом порту должен быть отклонен, даже если hostname похожий.
     */
    const matcher = createRealtimeCorsOriginMatcher("http://localhost:5173");

    let decision: { error: Error | null; allow?: boolean } | null = null;

    matcher("http://localhost:3000", (error, allow) => {
      decision = { error, allow };
    });

    assert.equal(decision?.allow, false);
    assert.ok(decision?.error instanceof Error);
  },
);
