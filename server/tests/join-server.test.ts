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

test("should join a public server through GraphQL and emit a user server realtime update", async () => {
  /**
   * Проверяется, что пользователь может вступить в public server по serverId,
   * получить membership с ролью MEMBER и сразу увидеть live-эффект для своего списка серверов.
   * Это важно, потому что public join — основной discovery-путь после поиска серверов,
   * и он должен одновременно менять постоянное состояние и инициировать realtime-синхронизацию.
   * Граничные случаи: сервер должен быть именно публичным, membership создается ровно один раз,
   * а realtime payload обязан содержать действие `joined`.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "join-public-server-session";
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
  servers.push({
    id: "server-1",
    name: "Public House",
    avatarUrl: "https://cdn.example.com/public-house.png",
    inviteToken: "public-invite-token",
    isPublic: true,
    ownerId: "owner-1",
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
            joinServer(
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
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      joinServer: {
        server: {
          id: string;
          name: string;
          avatarUrl: string | null;
          isPublic: boolean;
          role: "OWNER" | "ADMIN" | "MEMBER";
        };
      };
    };
  };

  assert.equal(serverMembers.length, 1);
  assert.deepEqual(payload.data.joinServer.server, {
    id: "server-1",
    name: "Public House",
    avatarUrl: "https://cdn.example.com/public-house.png",
    isPublic: true,
    role: "MEMBER",
  });
  assert.equal(serverMembers[0]?.serverId, "server-1");
  assert.equal(serverMembers[0]?.userId, "user-1");
  assert.equal(serverMembers[0]?.role, "MEMBER");
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.userServersUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-1",
    serverId: "server-1",
    action: "joined",
    occurredAt: serverMembers[0]?.createdAt.toISOString(),
  });
});

test("should join a private server through GraphQL by invite token", async () => {
  /**
   * Проверяется, что private server не требует флага public,
   * если пользователь приходит по активному invite token.
   * Это важно, потому что invite flow — обязательный способ входа в private servers,
   * и без него серверы с закрытым доступом останутся недостижимыми для новых участников.
   * Граничные случаи: сервер остается private, membership создается с ролью MEMBER,
   * а inviteToken используется как единственный источник доступа.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "join-private-server-session";

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
  servers.push({
    id: "server-1",
    name: "Private House",
    avatarUrl: null,
    inviteToken: "private-invite-token",
    isPublic: false,
    ownerId: "owner-1",
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
          mutation {
            joinServer(
              input: {
                inviteToken: "private-invite-token"
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
      joinServer: {
        server: {
          id: string;
          name: string;
          avatarUrl: string | null;
          isPublic: boolean;
          role: "OWNER" | "ADMIN" | "MEMBER";
        };
      };
    };
  };

  assert.equal(serverMembers.length, 1);
  assert.deepEqual(payload.data.joinServer.server, {
    id: "server-1",
    name: "Private House",
    avatarUrl: null,
    isPublic: false,
    role: "MEMBER",
  });
});

test("should reject joining a private server without an invite token", async () => {
  /**
   * Проверяется, что private server нельзя открыть простым join по serverId,
   * если у пользователя нет invite token.
   * Это важно, потому что иначе флаг private потеряет смысл,
   * и закрытые серверы начнут пропускать пользователей через public join flow.
   * Граничные случаи: membership не должен создаваться,
   * а ошибка должна явно указывать на необходимость invite-ссылки.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "join-private-without-invite-session";

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
  servers.push({
    id: "server-1",
    name: "Private House",
    avatarUrl: null,
    inviteToken: "private-invite-token",
    isPublic: false,
    ownerId: "owner-1",
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
          mutation {
            joinServer(
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

  assert.equal(
    payload.errors?.[0]?.message,
    "Без invite-ссылки можно вступить только в публичный сервер.",
  );
  assert.equal(serverMembers.length, 0);
});

test("should reject joining a server when the user is banned", async () => {
  /**
   * Проверяется, что ban имеет приоритет над invite/public доступом
   * и полностью блокирует создание membership.
   * Это важно, потому что moderation должна оставаться сильнее user acquisition flow,
   * иначе заблокированный пользователь сможет повторно войти по старой invite-ссылке или через public discovery.
   * Граничные случаи: ban проверяется до create membership, а realtime-уведомление не должно отправляться при отказе.
   */
  const { dataLayer, users, sessions, servers, serverMembers, serverBans } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "join-banned-server-session";
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
  servers.push({
    id: "server-1",
    name: "Public House",
    avatarUrl: null,
    inviteToken: "public-invite-token",
    isPublic: true,
    ownerId: "owner-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  serverBans.push({
    id: "ban-1",
    serverId: "server-1",
    userId: "user-1",
    bannedByUserId: "owner-1",
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
            joinServer(
              input: {
                inviteToken: "public-invite-token"
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

  assert.equal(payload.errors?.[0]?.message, "Пользователь заблокирован в этом сервере.");
  assert.equal(serverMembers.length, 0);
  assert.equal(emittedEvents.length, 0);
});
