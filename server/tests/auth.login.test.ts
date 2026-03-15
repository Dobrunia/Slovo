import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword } from "../src/auth/password.js";
import { hashSessionToken } from "../src/auth/session.js";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  SESSION_TOKEN_HEADER,
} from "../src/config/constants.js";
import { createGraphqlContext } from "../src/graphql/context.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

/**
 * Проверяется, что логин принимает корректные учетные данные,
 * создает отдельную auth-сессию и возвращает клиенту сырой session token,
 * при этом в хранилище остается только его хеш.
 * Это важно, потому что login — вторая половина auth-flow, и ошибка тут
 * делает невозможным дальнейший `me`, приватные GraphQL-операции и LiveRail auth.
 * Граничные случаи: email должен нормализоваться, токен не должен совпадать
 * с сохраненным хешем, а пользователь не должен дублироваться в хранилище.
 */
test("should log in a user through GraphQL and create a hashed auth session", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const passwordHash = await hashPassword("super-secret-password");

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash,
    displayName: "Добрыня",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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
          mutation {
            login(
              input: {
                email: " USER@example.com "
                password: "super-secret-password"
              }
            ) {
              sessionToken
              user {
                id
                email
                username
                displayName
                avatarUrl
              }
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      login: {
        sessionToken: string;
        user: {
          id: string;
          email: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        };
      };
    };
  };

  assert.equal(users.length, 1);
  assert.equal(sessions.length, 1);
  assert.equal(payload.data.login.user.id, "user-1");
  assert.equal(payload.data.login.user.email, "user@example.com");
  assert.equal(typeof payload.data.login.sessionToken, "string");
  assert.ok(payload.data.login.sessionToken.length > 20);
  assert.notEqual(payload.data.login.sessionToken, sessions[0]?.tokenHash);
  assert.equal(typeof sessions[0]?.tokenHash, "string");
  assert.ok((sessions[0]?.tokenHash.length ?? 0) > 20);
});

/**
 * Проверяется, что GraphQL context может восстановить `userId`
 * по тому же session token, который был создан при логине и сохранен как хеш.
 * Это важно, потому что именно этот механизм будет использоваться дальше
 * для приватных GraphQL-операций и может быть переиспользован в LiveRail handshake.
 * Граничные случаи: токен передается через заголовок `x-session-token`,
 * а отсутствие совпадения в сессиях должно давать `null`, а не ложный userId.
 */
test("should resolve the authenticated user id from the shared session token header", async () => {
  const { dataLayer, sessions } = createAuthTestDataLayer();
  const sessionToken = "raw-session-token";

  sessions.push({
    id: "session-1",
    userId: "user-42",
    tokenHash: hashSessionToken(sessionToken),
    createdAt: new Date(),
  });

  const contextWithMatch = await createGraphqlContext({
    dataLayer,
    request: new Request(GRAPHQL_TEST_URL, {
      headers: {
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
    }),
  });
  const contextWithoutMatch = await createGraphqlContext({
    dataLayer,
    request: new Request(GRAPHQL_TEST_URL, {
      headers: {
        [SESSION_TOKEN_HEADER]: "another-session-token",
      },
    }),
  });

  assert.equal(contextWithMatch.userId, "user-42");
  assert.equal(contextWithoutMatch.userId, null);
});

/**
 * Проверяется, что логин отклоняет неверный пароль
 * и не создает auth-сессию при ошибочных учетных данных.
 * Это важно, потому что иначе система даст невалидный доступ и разрушит
 * базовый security-invariant всего auth-механизма.
 * Граничные случаи: пользователь существует, но пароль не совпадает,
 * а итоговый ответ должен прийти как resolver-ошибка без побочных записей в сессии.
 */
test("should reject login with invalid credentials", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const passwordHash = await hashPassword("super-secret-password");

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash,
    displayName: "Добрыня",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

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
          mutation {
            login(
              input: {
                email: "user@example.com"
                password: "wrong-password"
              }
            ) {
              sessionToken
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

  assert.equal(sessions.length, 0);
  assert.equal(payload.errors?.[0]?.extensions?.strictql?.code, "RESOLVER_ERROR");
});
