import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  SESSION_TOKEN_HEADER,
} from "../src/config/constants.js";
import { hashSessionToken } from "../src/auth/session.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

test("should return only matching public servers through GraphQL search", async () => {
  /**
   * Проверяется, что поиск публичных серверов возвращает только public server-записи,
   * название которых совпадает с поисковой строкой без учета регистра.
   * Это важно, потому что discovery flow не должен раскрывать private servers,
   * а также обязан давать предсказуемый поиск по имени для пользовательского сценария вступления.
   * Граничные случаи: private server должен быть скрыт, несовпадающее название должно отфильтроваться,
   * а аватар может отсутствовать без поломки публичного payload.
   */
  const { dataLayer, users, sessions, servers } = createAuthTestDataLayer();
  const sessionToken = "search-public-servers-session";

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "user",
    passwordHash: "stored-password-hash",
    displayName: "User",
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
  servers.push(
    {
      id: "server-1",
      name: "Alpha Squad",
      avatarUrl: null,
      inviteToken: "invite-1",
      isPublic: true,
      ownerId: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date("2026-03-17T10:00:00.000Z"),
    },
    {
      id: "server-2",
      name: "Private Alpha",
      avatarUrl: null,
      inviteToken: "invite-2",
      isPublic: false,
      ownerId: "owner-2",
      createdAt: new Date(),
      updatedAt: new Date("2026-03-17T11:00:00.000Z"),
    },
    {
      id: "server-3",
      name: "Bravo House",
      avatarUrl: "https://cdn.example.com/bravo.png",
      inviteToken: "invite-3",
      isPublic: true,
      ownerId: "owner-3",
      createdAt: new Date(),
      updatedAt: new Date("2026-03-17T12:00:00.000Z"),
    },
    {
      id: "server-4",
      name: "ALPHA Lab",
      avatarUrl: "https://cdn.example.com/alpha-lab.png",
      inviteToken: "invite-4",
      isPublic: true,
      ownerId: "owner-4",
      createdAt: new Date(),
      updatedAt: new Date("2026-03-17T13:00:00.000Z"),
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
            searchPublicServers(
              input: {
                query: "alpha"
              }
            ) {
              id
              name
              avatarUrl
              isPublic
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      searchPublicServers: Array<{
        id: string;
        name: string;
        avatarUrl?: string | null;
        isPublic: true;
      }>;
    };
  };

  assert.deepEqual(payload.data.searchPublicServers, [
    {
      id: "server-4",
      name: "ALPHA Lab",
      avatarUrl: "https://cdn.example.com/alpha-lab.png",
      isPublic: true,
    },
    {
      id: "server-1",
      name: "Alpha Squad",
      avatarUrl: null,
      isPublic: true,
    },
  ]);
});

test("should deny public server search without an authenticated session", async () => {
  /**
   * Проверяется, что search query публичных серверов не доступен без авторизации,
   * даже несмотря на то, что сами результаты содержат только public server-записи.
   * Это важно, потому что текущий discovery flow встроен в авторизованную часть приложения,
   * а доступ к нему должен подчиняться той же сессионной модели, что и остальные server operations.
   * Граничные случаи: сервер не должен вернуть данные, а ошибка должна явно указывать на необходимость авторизации.
   */
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
            searchPublicServers(
              input: {
                query: "alpha"
              }
            ) {
              id
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    errors?: Array<{
      message?: string;
    }>;
  };

  assert.equal(payload.errors?.[0]?.message, "Требуется авторизация.");
});
