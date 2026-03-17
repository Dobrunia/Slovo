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
 * Проверяется, что приватный query списка серверов возвращает только те серверы,
 * в которых текущий пользователь действительно состоит, и не подмешивает чужие membership.
 * Это важно, потому что именно этот initial load станет основой навигации приложения,
 * и любая ошибка здесь приведет либо к утечке чужих серверов, либо к пустому списку у пользователя.
 * Граничные случаи: проверяется сортировка по `updatedAt` сервера по убыванию,
 * сохранение роли участника и то, что поля вроде `avatarUrl` и `isPublic` доходят до клиента.
 */
test("should return the current user's servers through GraphQL", async () => {
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "my-servers-session-token";
  const now = Date.now();

  users.push(
    {
      id: "user-1",
      email: "user@example.com",
      username: "dobrunia",
      passwordHash: "stored-password-hash",
      displayName: "Добрыня",
      avatarUrl: null,
      createdAt: new Date(now - 1000),
      updatedAt: new Date(now - 1000),
    },
    {
      id: "user-2",
      email: "other@example.com",
      username: "other-user",
      passwordHash: "stored-password-hash",
      displayName: "Другой",
      avatarUrl: null,
      createdAt: new Date(now - 900),
      updatedAt: new Date(now - 900),
    },
  );

  sessions.push({
    id: "session-1",
    userId: "user-1",
    tokenHash: hashSessionToken(sessionToken),
    createdAt: new Date(now - 500),
  });

  servers.push(
    {
      id: "server-1",
      name: "Alpha",
      avatarUrl: null,
      isPublic: false,
      ownerId: "user-1",
      createdAt: new Date(now - 400),
      updatedAt: new Date(now - 400),
    },
    {
      id: "server-2",
      name: "Beta",
      avatarUrl: "https://example.com/beta.png",
      isPublic: true,
      ownerId: "user-2",
      createdAt: new Date(now - 300),
      updatedAt: new Date(now - 100),
    },
    {
      id: "server-3",
      name: "Hidden",
      avatarUrl: null,
      isPublic: true,
      ownerId: "user-2",
      createdAt: new Date(now - 200),
      updatedAt: new Date(now - 50),
    },
  );

  serverMembers.push(
    {
      id: "membership-1",
      serverId: "server-1",
      userId: "user-1",
      role: "OWNER",
      createdAt: new Date(now - 350),
      updatedAt: new Date(now - 350),
    },
    {
      id: "membership-2",
      serverId: "server-2",
      userId: "user-1",
      role: "MEMBER",
      createdAt: new Date(now - 120),
      updatedAt: new Date(now - 120),
    },
    {
      id: "membership-3",
      serverId: "server-3",
      userId: "user-2",
      role: "OWNER",
      createdAt: new Date(now - 40),
      updatedAt: new Date(now - 40),
    },
  );

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
            myServers(input: {}) {
              id
              name
              avatarUrl
              isPublic
              role
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      myServers: Array<{
        id: string;
        name: string;
        avatarUrl: string | null;
        isPublic: boolean;
        role: "OWNER" | "MEMBER";
      }>;
    };
  };

  assert.deepEqual(payload.data.myServers, [
    {
      id: "server-2",
      name: "Beta",
      avatarUrl: "https://example.com/beta.png",
      isPublic: true,
      role: "MEMBER",
    },
    {
      id: "server-1",
      name: "Alpha",
      avatarUrl: null,
      isPublic: false,
      role: "OWNER",
    },
  ]);
});

/**
 * Проверяется, что query списка серверов не становится публичным и отклоняется,
 * если клиент не передал валидную auth-сессию.
 * Это важно, потому что список серверов — приватное состояние пользователя,
 * и без этой защиты любой анонимный клиент смог бы получить его навигационный snapshot.
 * Граничные случаи: запрос проходит через тот же GraphQL endpoint, а ошибка должна
 * приходить именно как `AUTH_DENIED`, а не как случайное внутреннее исключение резолвера.
 */
test("should deny the user servers query without an authenticated session", async () => {
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
            myServers(input: {}) {
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
