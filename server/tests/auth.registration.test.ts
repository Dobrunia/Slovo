import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
} from "../src/config/constants.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

/**
 * Проверяется, что публичная GraphQL-регистрация создает нового пользователя,
 * не возвращает сырой пароль наружу и сохраняет в хранилище именно хеш.
 * Это важно, потому что регистрация — первая точка входа в систему, а ошибка
 * здесь ломает и безопасность хранения паролей, и последующий логин.
 * Граничные случаи: пустых auth-сессий после регистрации быть не должно,
 * email должен нормализоваться, а пароль не должен совпадать с сохраненным значением.
 */
test("should register a new user through GraphQL and store a password hash", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
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
            register(
              input: {
                email: "  USER@Example.com "
                username: "Dobrunia"
                password: "super-secret-password"
                displayName: "Добрыня"
              }
            ) {
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
      register: {
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
  assert.equal(sessions.length, 0);
  assert.equal(users[0]?.email, "user@example.com");
  assert.equal(users[0]?.passwordHash === "super-secret-password", false);
  assert.equal(typeof users[0]?.passwordHash, "string");
  assert.ok(users[0]?.passwordHash.length > 20);
  assert.deepEqual(payload.data.register.user, {
    id: "user-1",
    email: "user@example.com",
    username: "Dobrunia",
    displayName: "Добрыня",
    avatarUrl: null,
  });
});

/**
 * Проверяется, что регистрация не позволяет создать дубликат по email или username
 * и не записывает лишнего пользователя при конфликте уникальности.
 * Это важно, потому что инварианты уникальности лежат в основе auth-flow и
 * должны отсекаться до похода в реальную БД, чтобы ошибка была предсказуемой.
 * Граничные случаи: повтор email и повтор username рассматриваются одинаково
 * как resolver-ошибка, а исходная запись пользователя должна остаться единственной.
 */
test("should reject duplicate registration by email or username", async () => {
  const { dataLayer, users } = createAuthTestDataLayer();
  const yoga = createGraphqlServer({
    dataLayer,
  });

  const register = async (input: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }) =>
    yoga.fetch(
      new Request(GRAPHQL_TEST_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation {
              register(
                input: {
                  email: ${JSON.stringify(input.email)}
                  username: ${JSON.stringify(input.username)}
                  password: ${JSON.stringify(input.password)}
                  displayName: ${JSON.stringify(input.displayName)}
                }
              ) {
                user {
                  id
                }
              }
            }
          `,
        }),
      }),
    );

  await register({
    email: "user@example.com",
    username: "dobrunia",
    password: "super-secret-password",
    displayName: "Добрыня",
  });

  const duplicateEmailResponse = await register({
    email: "user@example.com",
    username: "another-user",
    password: "super-secret-password",
    displayName: "Другой пользователь",
  });
  const duplicateUsernameResponse = await register({
    email: "second@example.com",
    username: "dobrunia",
    password: "super-secret-password",
    displayName: "Еще один пользователь",
  });

  const duplicateEmailPayload = (await duplicateEmailResponse.json()) as {
    errors?: Array<{
      extensions?: {
        strictql?: {
          code?: string;
        };
      };
    }>;
  };
  const duplicateUsernamePayload = (await duplicateUsernameResponse.json()) as {
    errors?: Array<{
      extensions?: {
        strictql?: {
          code?: string;
        };
      };
    }>;
  };

  assert.equal(users.length, 1);
  assert.equal(
    duplicateEmailPayload.errors?.[0]?.extensions?.strictql?.code,
    "RESOLVER_ERROR",
  );
  assert.equal(
    duplicateUsernamePayload.errors?.[0]?.extensions?.strictql?.code,
    "RESOLVER_ERROR",
  );
});
