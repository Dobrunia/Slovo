import test from "node:test";
import assert from "node:assert/strict";
import { hashSessionToken } from "../src/auth/session.js";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  SESSION_TOKEN_HEADER,
} from "../src/config/constants.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

/**
 * Проверяется, что query `me` возвращает именно текущего пользователя,
 * если в запросе передан валидный session token и он связан с существующей auth-сессией.
 * Это важно, потому что весь клиентский app shell и дальнейшая инициализация интерфейса
 * будут строиться вокруг `me` как источника текущего пользователя после логина.
 * Граничные случаи: пользователь ищется по `userId` из session context, а наружу
 * по-прежнему не должны утекать чувствительные поля вроде `passwordHash`.
 */
test("should return the current user through GraphQL me query", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const sessionToken = "me-session-token";

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash: "stored-password-hash",
    displayName: "Добрыня",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  sessions.push({
    id: "session-1",
    userId: "user-1",
    tokenHash: hashSessionToken(sessionToken),
    createdAt: new Date(),
  });

  const yoga = createGraphqlServer({
    dataLayer,
  });
  const response = await yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      body: JSON.stringify({
        query: `
          query {
            me(input: {}) {
              id
              email
              username
              displayName
              avatarUrl
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      me: {
        id: string;
        email: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
      };
    };
  };

  assert.deepEqual(payload.data.me, {
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    displayName: "Добрыня",
    avatarUrl: null,
  });
});

/**
 * Проверяется, что query `me` не становится публичной и корректно отклоняется,
 * если клиент не прислал session token или он не смог быть сопоставлен с пользователем.
 * Это важно, потому что случайная утечка профиля анонимному пользователю сломает
 * базовую auth-модель проекта и дальнейшие приватные GraphQL-операции.
 * Граничные случаи: запрос проходит через ту же GraphQL-схему, но ошибка должна
 * приходить именно как auth-denied, а не как случайная resolver/internal ошибка.
 */
test("should deny the me query without an authenticated session", async () => {
  const { dataLayer } = createAuthTestDataLayer();
  const yoga = createGraphqlServer({
    dataLayer,
  });
  const response = await yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            me(input: {}) {
              id
            }
          }
        `,
      }),
    }),
  );

  const payload = (await response.json()) as {
    errors?: Array<{
      extensions?: {
        strictql?: {
          code?: string;
        };
      };
    }>;
  };

  assert.equal(payload.errors?.[0]?.extensions?.strictql?.code, "AUTH_DENIED");
});
