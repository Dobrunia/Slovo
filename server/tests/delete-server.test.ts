import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
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

test("should delete a server and emit removal events for all affected members", async () => {
  /**
   * Проверяется, что удаление сервера владельцем:
   * 1) удаляет сам сервер,
   * 2) каскадно убирает membership и каналы,
   * 3) возвращает id удаленного сервера и
   * 4) отправляет realtime-событие удаления для всех участников сервера.
   * Это важно, потому что сервер — корневая сущность, и его удаление должно
   * синхронно убирать все зависимые структуры и пользовательскую навигацию.
   * Граничные случаи: удаление должно коснуться и владельца, и обычного участника,
   * а payload realtime-уведомлений обязан содержать action `deleted`.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "delete-server-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  users.push(
    {
      id: "user-1",
      email: "owner@example.com",
      username: "owner",
      passwordHash: "stored-password-hash",
      displayName: "Owner",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "user-2",
      email: "member@example.com",
      username: "member",
      passwordHash: "stored-password-hash",
      displayName: "Member",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );
  sessions.push({
    id: "session-1",
    userId: "user-1",
    tokenHash: hashSessionToken(sessionToken),
    createdAt: new Date(),
  });
  servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    inviteToken: "invite-token",
    isPublic: false,
    ownerId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date("2026-03-17T20:00:00.000Z"),
  });
  serverMembers.push(
    {
      id: "membership-1",
      serverId: "server-1",
      userId: "user-1",
      role: "OWNER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "membership-2",
      serverId: "server-1",
      userId: "user-2",
      role: "MEMBER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );
  voiceChannels.push({
    id: "channel-1",
    serverId: "server-1",
    name: "Общий",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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
            deleteServer(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      deleteServer: {
        serverId: string;
      };
    };
  };

  assert.deepEqual(payload.data.deleteServer, {
    serverId: "server-1",
  });
  assert.equal(servers.length, 0);
  assert.equal(serverMembers.length, 0);
  assert.equal(voiceChannels.length, 0);
  assert.equal(emittedEvents.length, 2);
  assert.deepEqual(
    emittedEvents.map((eventPayload) => eventPayload.name),
    [REALTIME_EVENT_NAMES.userServersUpdated, REALTIME_EVENT_NAMES.userServersUpdated],
  );
  assert.deepEqual(
    emittedEvents.map((eventPayload) => eventPayload.payload),
    [
      {
        userId: "user-1",
        serverId: "server-1",
        action: "deleted",
        occurredAt: "2026-03-17T20:00:00.000Z",
      },
      {
        userId: "user-2",
        serverId: "server-1",
        action: "deleted",
        occurredAt: "2026-03-17T20:00:00.000Z",
      },
    ],
  );
});

test("should reject server deletion for a non-owner member", async () => {
  /**
   * Проверяется, что обычный участник не может удалить сервер,
   * даже если он аутентифицирован и состоит в этом сервере.
   * Это важно, потому что после упрощения модели ролей все server management-права
   * принадлежат только единственному владельцу.
   * Граничные случаи: сервер, каналы и membership должны остаться нетронутыми,
   * а realtime-события удаления не должны отправляться.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "delete-server-forbidden-session";
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
    avatarUrl: null,
    inviteToken: "invite-token",
    isPublic: false,
    ownerId: "owner-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  serverMembers.push({
    id: "membership-1",
    serverId: "server-1",
    userId: "user-1",
    role: "MEMBER",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  voiceChannels.push({
    id: "channel-1",
    serverId: "server-1",
    name: "Общий",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
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
            deleteServer(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
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

  assert.equal(payload.errors?.[0]?.message, "Недостаточно прав для управления сервером.");
  assert.equal(servers.length, 1);
  assert.equal(serverMembers.length, 1);
  assert.equal(voiceChannels.length, 1);
  assert.equal(emittedEvents.length, 0);
});
