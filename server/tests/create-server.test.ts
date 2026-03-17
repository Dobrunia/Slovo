import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  MAX_SERVERS_PER_OWNER,
  SESSION_TOKEN_HEADER,
} from "../src/config/constants.js";
import { hashSessionToken } from "../src/auth/session.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import type { SlovoRealtimeRuntime } from "../src/realtime/runtime.js";
import { REALTIME_EVENT_NAMES } from "../../shared/realtime/names.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

test("should create a server, owner membership and realtime notification through GraphQL", async () => {
  /**
   * Проверяется, что мутация создания сервера создает сам сервер,
   * сразу добавляет создателя как единственного OWNER-участника
   * и отправляет live-уведомление для обновления списка серверов пользователя.
   * Это важно, потому что задача соединяет сразу три критичных эффекта:
   * постоянное состояние в БД, membership-модель и realtime-синхронизацию клиента.
   * Граничные случаи: сервер создается с флагом public, аватар может отсутствовать,
   * а realtime payload обязан содержать пользователя, сервер и тип действия `created`.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "create-server-session-token";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

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
    realtimeRuntime,
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
          mutation {
            createServer(
              input: {
                name: "Alpha"
                isPublic: true
              }
            ) {
              server {
                id
                name
                avatarUrl
                isPublic
                role
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
      createServer: {
        server: {
          id: string;
          name: string;
          avatarUrl: string | null;
          isPublic: boolean;
          role: "OWNER" | "MEMBER";
        };
      };
    };
  };

  assert.equal(servers.length, 1);
  assert.equal(serverMembers.length, 1);
  assert.equal(servers[0]?.ownerId, "user-1");
  assert.deepEqual(serverMembers[0], {
    id: "membership-1",
    serverId: servers[0]?.id,
    userId: "user-1",
    role: "OWNER",
    createdAt: serverMembers[0]?.createdAt,
    updatedAt: serverMembers[0]?.updatedAt,
  });
  assert.deepEqual(payload.data.createServer.server, {
    id: servers[0]?.id,
    name: "Alpha",
    avatarUrl: null,
    isPublic: true,
    role: "OWNER",
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.userServersUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-1",
    serverId: servers[0]?.id,
    action: "created",
    occurredAt: servers[0]?.updatedAt.toISOString(),
  });
});

test("should reject server creation when the owner has reached the max servers limit", async () => {
  /**
   * Проверяется, что мутация создания сервера уважает лимит владельца
   * и не позволяет создать третий сервер при текущем ограничении `MAX_SERVERS_PER_OWNER = 2`.
   * Это важно, потому что лимит — часть доменной модели сервиса,
   * и без него серверная логика быстро разойдется с обещанными продуктовыми ограничениями.
   * Граничные случаи: новые записи сервера и membership не должны появиться,
   * а realtime-уведомление не должно отправляться, если create был отклонен.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "create-server-limit-session-token";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

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
  servers.push(
    {
      id: "server-1",
      name: "One",
      avatarUrl: null,
      isPublic: false,
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "server-2",
      name: "Two",
      avatarUrl: null,
      isPublic: false,
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

  const yoga = createGraphqlServer({
    dataLayer,
    realtimeRuntime,
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
          mutation {
            createServer(
              input: {
                name: "Overflow"
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

  assert.equal(
    payload.errors?.[0]?.message,
    `Пользователь не может владеть более чем ${MAX_SERVERS_PER_OWNER} серверами.`,
  );
  assert.equal(servers.length, MAX_SERVERS_PER_OWNER);
  assert.equal(serverMembers.length, 0);
  assert.equal(emittedEvents.length, 0);
});
