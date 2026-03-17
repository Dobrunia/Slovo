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

test("should return the selected server snapshot with channels through GraphQL", async () => {
  /**
   * Проверяется, что query initial snapshot выбранного сервера
   * возвращает сам сервер и его voice-каналы для участника этого сервера.
   * Это важно, потому что именно этот snapshot станет стартовой загрузкой экрана сервера,
   * а ошибка здесь сразу ломает и навигацию, и отображение структуры каналов.
   * Граничные случаи: роль участника должна доходить до клиента,
   * а каналы обязаны сортироваться по `sortOrder`, даже если в хранилище они лежат в другом порядке.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const sessionToken = "server-snapshot-session-token";

  users.push({
    id: "user-1",
    email: "member@example.com",
    username: "member",
    passwordHash: "stored-password-hash",
    displayName: "Member",
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
  servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: "https://example.com/server.png",
    isPublic: true,
    ownerId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  serverMembers.push({
    id: "membership-1",
    serverId: "server-1",
    userId: "user-1",
    role: "OWNER",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  voiceChannels.push(
    {
      id: "channel-2",
      serverId: "server-1",
      name: "General",
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-1",
      serverId: "server-1",
      name: "Lobby",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
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
            serverSnapshot(
              input: {
                serverId: "server-1"
              }
            ) {
              server {
                id
                name
                avatarUrl
                isPublic
                role
              }
              channels {
                id
                name
                sortOrder
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
      serverSnapshot: {
        server: {
          id: string;
          name: string;
          avatarUrl: string | null;
          isPublic: boolean;
          role: "OWNER" | "MEMBER";
        };
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.deepEqual(payload.data.serverSnapshot, {
    server: {
      id: "server-1",
      name: "Alpha",
      avatarUrl: "https://example.com/server.png",
      isPublic: true,
      role: "OWNER",
    },
    channels: [
      {
        id: "channel-1",
        name: "Lobby",
        sortOrder: 1,
      },
      {
        id: "channel-2",
        name: "General",
        sortOrder: 2,
      },
    ],
  });
});

test("should reject server snapshot access when the user is not a server member", async () => {
  /**
   * Проверяется, что query initial snapshot не раскрывает сервер постороннему пользователю,
   * даже если такой сервер реально существует в хранилище.
   * Это важно, потому что страница сервера содержит приватную структуру каналов и metadata,
   * а любая утечка этого snapshot сразу превращается в ошибку авторизации и доступа.
   * Граничные случаи: сервер существует, auth-сессия валидна, но membership отсутствует;
   * ответ должен сообщать только о недоступности сервера без лишних деталей.
   */
  const { dataLayer, users, sessions, servers } = createAuthTestDataLayer();
  const sessionToken = "server-snapshot-foreign-session-token";

  users.push({
    id: "user-1",
    email: "member@example.com",
    username: "member",
    passwordHash: "stored-password-hash",
    displayName: "Member",
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
  servers.push({
    id: "server-1",
    name: "Hidden",
    avatarUrl: null,
    isPublic: false,
    ownerId: "another-user",
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
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      body: JSON.stringify({
        query: `
          query {
            serverSnapshot(
              input: {
                serverId: "server-1"
              }
            ) {
              server {
                id
              }
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

  assert.equal(payload.errors?.[0]?.message, "Сервер недоступен.");
});
