import test from "node:test";
import assert from "node:assert/strict";
import { hashSessionToken } from "../src/auth/session.js";
import { resolveRealtimeSocketUserId } from "../src/realtime/socket-context.js";

test("should resolve realtime user id from handshake auth session token", async () => {
  /**
   * Проверяется, что realtime-auth продолжает работать через `handshake.auth.sessionToken`
   * после удаления query-based токена из transport surface.
   * Это важно, потому что websocket-подключение должно оставаться авторизуемым
   * без возврата к небезопасной передаче токена в URL.
   * Граничный случай: в handshake нет заголовков, и единственным источником токена
   * остается auth payload сокета.
   */
  let receivedTokenHash: string | null = null;

  const userId = await resolveRealtimeSocketUserId({
    dataLayer: {
      prisma: {
        authSession: {
          findUnique: async ({
            where,
          }: {
            where: {
              tokenHash: string;
            };
          }) => {
            receivedTokenHash = where.tokenHash;
            return {
              userId: "user-1",
            };
          },
        },
      },
    } as never,
    handshake: {
      auth: {
        sessionToken: "live-session-token",
      },
    },
  });

  assert.equal(userId, "user-1");
  assert.equal(receivedTokenHash, hashSessionToken("live-session-token"));
});

test("should ignore query-based realtime session token", async () => {
  /**
   * Проверяется, что realtime transport больше не принимает session token из query string.
   * Это важно, потому что токен в URL легче утечет в логи, прокси и browser tooling,
   * а проект не должен держать лишнюю auth surface без практической необходимости.
   * Граничный случай: query содержит валидный-looking token, но auth/header пути пусты,
   * поэтому поиск сессии в базе вообще не должен запускаться.
   */
  let authSessionLookupCalled = false;

  const userId = await resolveRealtimeSocketUserId({
    dataLayer: {
      prisma: {
        authSession: {
          findUnique: async () => {
            authSessionLookupCalled = true;
            return {
              userId: "user-1",
            };
          },
        },
      },
    } as never,
    handshake: {
      query: {
        sessionToken: "query-token-should-be-ignored",
      },
    } as never,
  });

  assert.equal(userId, null);
  assert.equal(authSessionLookupCalled, false);
});
