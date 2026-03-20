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

test("should kick a server member through GraphQL and emit a live removal event", async () => {
  /**
   * Проверяется, что владелец сервера может кикнуть обычного участника,
   * при этом membership целевого пользователя удаляется, ban не создается,
   * а realtime-уведомление для списка серверов целевого пользователя отправляется сразу.
   * Это важно, потому что kick — это минимальное moderation-действие без необратимой блокировки,
   * и оно должно убирать сервер у жертвы сразу, без ручной перезагрузки клиента.
   * Граничные случаи: owner должен остаться участником сервера,
   * а payload live-события обязан использовать действие `deleted`.
   */
  const { dataLayer, users, sessions, servers, serverMembers, serverBans } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "kick-server-member-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedModerationServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
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
            kickServerMember(
              input: {
                serverId: "server-1"
                targetUserId: "user-2"
              }
            ) {
              serverId
              userId
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      kickServerMember: {
        serverId: string;
        userId: string;
      };
    };
  };

  assert.deepEqual(payload.data.kickServerMember, {
    serverId: "server-1",
    userId: "user-2",
  });
  assert.deepEqual(
    serverMembers.map((member) => ({
      serverId: member.serverId,
      userId: member.userId,
      role: member.role,
    })),
    [
      {
        serverId: "server-1",
        userId: "user-1",
        role: "OWNER",
      },
    ],
  );
  assert.equal(serverBans.length, 0);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.userServersUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-2",
    serverId: "server-1",
    action: "deleted",
    occurredAt: expectIsoString(emittedEvents[0]?.payload.occurredAt),
  });
});

test("should ban a server member through GraphQL and emit a live removal event", async () => {
  /**
   * Проверяется, что бан обычного участника одновременно:
   * 1) удаляет его membership,
   * 2) создает постоянную запись server ban и
   * 3) отправляет realtime-удаление сервера для клиента заблокированного пользователя.
   * Это важно, потому что ban отличается от kick именно сохранением запрета
   * на повторный вход, но визуально для клиента эффект должен быть таким же немедленным.
   * Граничные случаи: bannedByUserId должен указывать на владельца,
   * а ban не должен затронуть membership самого owner.
   */
  const { dataLayer, users, sessions, servers, serverMembers, serverBans } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "ban-server-member-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedModerationServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
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
            banServerMember(
              input: {
                serverId: "server-1"
                targetUserId: "user-2"
              }
            ) {
              serverId
              userId
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      banServerMember: {
        serverId: string;
        userId: string;
      };
    };
  };

  assert.deepEqual(payload.data.banServerMember, {
    serverId: "server-1",
    userId: "user-2",
  });
  assert.deepEqual(
    serverMembers.map((member) => ({
      serverId: member.serverId,
      userId: member.userId,
      role: member.role,
    })),
    [
      {
        serverId: "server-1",
        userId: "user-1",
        role: "OWNER",
      },
    ],
  );
  assert.deepEqual(serverBans, [
    {
      id: "ban-1",
      serverId: "server-1",
      userId: "user-2",
      bannedByUserId: "user-1",
      createdAt: serverBans[0]?.createdAt,
    },
  ]);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.userServersUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-2",
    serverId: "server-1",
    action: "deleted",
    occurredAt: serverBans[0]?.createdAt.toISOString(),
  });
});

test("should reject moderation of the server owner", async () => {
  /**
   * Проверяется, что владелец сервера не может кикнуть или забанить самого owner,
   * даже если запрос формально проходит по auth и server ownership.
   * Это важно, потому что по текущей модели owner у сервера только один,
   * и moderation не должна разрушать единственный источник управления сервером.
   * Граничные случаи: membership и bans должны остаться без изменений,
   * а realtime-события не должны отправляться при отказе.
   */
  const { dataLayer, users, sessions, servers, serverMembers, serverBans } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "moderation-owner-forbidden-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedModerationServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
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
            banServerMember(
              input: {
                serverId: "server-1"
                targetUserId: "user-1"
              }
            ) {
              serverId
              userId
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

  assert.equal(payload.errors?.[0]?.message, "Нельзя модерировать владельца сервера.");
  assert.equal(serverMembers.length, 2);
  assert.equal(serverBans.length, 0);
  assert.equal(emittedEvents.length, 0);
});

type SeedModerationServerInput = {
  users: ReturnType<typeof createAuthTestDataLayer>["users"];
  sessions: ReturnType<typeof createAuthTestDataLayer>["sessions"];
  servers: ReturnType<typeof createAuthTestDataLayer>["servers"];
  serverMembers: ReturnType<typeof createAuthTestDataLayer>["serverMembers"];
  sessionToken: string;
};

/**
 * Создает минимальный сервер и двух участников для GraphQL-тестов модерации.
 */
function seedModerationServer(input: SeedModerationServerInput): void {
  input.users.push(
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
  input.sessions.push({
    id: "session-1",
    userId: "user-1",
    tokenHash: hashSessionToken(input.sessionToken),
    createdAt: new Date(),
  });
  input.servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    inviteToken: "invite-token",
    isPublic: false,
    ownerId: "user-1",
    createdAt: new Date("2026-03-20T12:00:00.000Z"),
    updatedAt: new Date("2026-03-20T12:00:00.000Z"),
  });
  input.serverMembers.push(
    {
      id: "membership-1",
      serverId: "server-1",
      userId: "user-1",
      role: "OWNER",
      createdAt: new Date("2026-03-20T12:00:00.000Z"),
      updatedAt: new Date("2026-03-20T12:00:00.000Z"),
    },
    {
      id: "membership-2",
      serverId: "server-1",
      userId: "user-2",
      role: "MEMBER",
      createdAt: new Date("2026-03-20T12:01:00.000Z"),
      updatedAt: new Date("2026-03-20T12:01:00.000Z"),
    },
  );
}

/**
 * Нормализует ожидание ISO-строки внутри deepEqual без привязки к точному времени.
 */
function expectIsoString(value: unknown): string {
  assert.equal(typeof value, "string");
  assert.ok(!Number.isNaN(Date.parse(value)));
  return value;
}
