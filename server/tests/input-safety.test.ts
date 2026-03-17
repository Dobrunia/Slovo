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

/**
 * Выполняет GraphQL-запрос к тестовому StrictQL-серверу с JSON body.
 */
async function executeGraphqlRequest(args: {
  yoga: ReturnType<typeof createGraphqlServer>;
  sessionToken: string;
  query: string;
}) {
  return args.yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_TOKEN_HEADER]: args.sessionToken,
      },
      body: JSON.stringify({
        query: args.query,
      }),
    }),
  );
}

test("should treat SQL-like search input as plain text and not broaden public server search", async () => {
  /**
   * Проверяется, что SQL-подобная поисковая строка не превращается
   * в более широкий запрос и не начинает возвращать все публичные серверы подряд.
   * Это важно, потому что пользовательский discovery-search принимает свободный текст,
   * а backend не должен интерпретировать спецсимволы как часть SQL-синтаксиса.
   * Граничные случаи: в данных одновременно есть несколько публичных серверов,
   * но SQL-подобный payload должен дать пустой результат, а не раскрыть весь список.
   */
  const { dataLayer, users, sessions, servers } = createAuthTestDataLayer();
  const sessionToken = "input-safety-search-session";

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
      name: "Bravo House",
      avatarUrl: null,
      inviteToken: "invite-2",
      isPublic: true,
      ownerId: "owner-2",
      createdAt: new Date(),
      updatedAt: new Date("2026-03-17T11:00:00.000Z"),
    },
  );

  const yoga = createGraphqlServer({
    dataLayer,
  });
  const response = await executeGraphqlRequest({
    yoga,
    sessionToken,
    query: `
      query {
        searchPublicServers(
          input: {
            query: "' OR 1=1 --"
          }
        ) {
          id
          name
          isPublic
        }
      }
    `,
  });

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      searchPublicServers: Array<{
        id: string;
        name: string;
        isPublic: true;
      }>;
    };
  };

  assert.deepEqual(payload.data.searchPublicServers, []);
});

test("should store SQL-like names as plain data during server and channel creation", async () => {
  /**
   * Проверяется, что SQL-подобные строки в имени сервера и канала
   * сохраняются как обычные данные, а не ломают мутации и не искажают состояние.
   * Это важно, потому что пользовательские названия приходят напрямую из инпутов,
   * и backend обязан трактовать их только как текстовые значения.
   * Граничные случаи: создаются сразу сервер и канал с подозрительным payload,
   * после чего проверяется и сам ответ API, и фактическое состояние in-memory data layer.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const sessionToken = "input-safety-create-session";
  const dangerousServerName = "'; DROP TABLE Server; --";
  const dangerousChannelName = "\" OR 1=1 --";

  users.push({
    id: "user-1",
    email: "owner@example.com",
    username: "owner",
    passwordHash: "stored-password-hash",
    displayName: "Owner",
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
  const createServerResponse = await executeGraphqlRequest({
    yoga,
    sessionToken,
    query: `
      mutation {
        createServer(
          input: {
            name: ${JSON.stringify(dangerousServerName)}
          }
        ) {
          server {
            id
            name
            role
          }
        }
      }
    `,
  });

  assert.equal(createServerResponse.status, 200);

  const createServerPayload = (await createServerResponse.json()) as {
    data: {
      createServer: {
        server: {
          id: string;
          name: string;
          role: "OWNER" | "MEMBER";
        };
      };
    };
  };

  const createdServerId = createServerPayload.data.createServer.server.id;

  assert.equal(createServerPayload.data.createServer.server.name, dangerousServerName);
  assert.equal(createServerPayload.data.createServer.server.role, "OWNER");
  assert.equal(servers[0]?.name, dangerousServerName);
  assert.equal(serverMembers[0]?.serverId, createdServerId);

  const createChannelResponse = await executeGraphqlRequest({
    yoga,
    sessionToken,
    query: `
      mutation {
        createVoiceChannel(
          input: {
            serverId: ${JSON.stringify(createdServerId)}
            name: ${JSON.stringify(dangerousChannelName)}
          }
        ) {
          channels {
            id
            name
            sortOrder
          }
        }
      }
    `,
  });

  assert.equal(createChannelResponse.status, 200);

  const createChannelPayload = (await createChannelResponse.json()) as {
    data: {
      createVoiceChannel: {
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.deepEqual(createChannelPayload.data.createVoiceChannel.channels, [
    {
      id: voiceChannels[0]?.id,
      name: dangerousChannelName,
      sortOrder: 0,
    },
  ]);
  assert.equal(voiceChannels[0]?.name, dangerousChannelName);
});
