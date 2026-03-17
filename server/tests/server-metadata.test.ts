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

test("should update server name and avatar through GraphQL and emit a server realtime event", async () => {
  /**
   * Проверяется, что мутация обновления сервера:
   * 1) меняет имя и avatarUrl выбранного сервера,
   * 2) возвращает актуальную публичную форму сервера и
   * 3) отправляет realtime-событие `server.updated`.
   * Это важно, потому что название и аватар сервера видны сразу в нескольких частях UI,
   * и сервер должен оставаться единственным источником истины для этих метаданных.
   * Граничные случаи: имя и URL приходят с внешними пробелами,
   * а роль управляющего участника должна сохраниться в output без деградации.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "update-server-metadata-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedManagedServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
    role: "OWNER",
    avatarUrl: null,
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
            updateServer(
              input: {
                serverId: "server-1"
                name: "  Новый сервер  "
                avatarUrl: "  https://cdn.example.com/server.png  "
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
      updateServer: {
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

  assert.equal(servers[0]?.name, "Новый сервер");
  assert.equal(servers[0]?.avatarUrl, "https://cdn.example.com/server.png");
  assert.deepEqual(payload.data.updateServer.server, {
    id: "server-1",
    name: "Новый сервер",
    avatarUrl: "https://cdn.example.com/server.png",
    isPublic: false,
    role: "OWNER",
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.serverUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    serverId: "server-1",
    name: "Новый сервер",
    avatarUrl: "https://cdn.example.com/server.png",
    isPublic: false,
    updatedAt: servers[0]?.updatedAt.toISOString(),
  });
});

test("should clear server avatar through GraphQL when an empty string is passed", async () => {
  /**
   * Проверяется, что мутация позволяет очистить аватар сервера,
   * если клиент передал пустую строку вместо URL.
   * Это важно, потому что удаление аватара — такой же валидный сценарий,
   * как и установка нового изображения, и для этого не нужен отдельный endpoint.
   * Граничные случаи: пустое значение должно нормализоваться в `null`,
   * а realtime-событие тоже обязано сообщить `avatarUrl: null`.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "clear-server-avatar-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedManagedServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
    role: "OWNER",
    avatarUrl: "https://cdn.example.com/current.png",
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
            updateServer(
              input: {
                serverId: "server-1"
                name: "Alpha"
                avatarUrl: "   "
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
      updateServer: {
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

  assert.equal(servers[0]?.avatarUrl, null);
  assert.deepEqual(payload.data.updateServer.server, {
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    isPublic: false,
    role: "OWNER",
  });
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.serverUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    serverId: "server-1",
    name: "Alpha",
    avatarUrl: null,
    isPublic: false,
    updatedAt: servers[0]?.updatedAt.toISOString(),
  });
});

test("should reject server metadata update for a non-manager member", async () => {
  /**
   * Проверяется, что обычный MEMBER не может менять имя и аватар сервера,
   * даже если он аутентифицирован и уже состоит в сервере.
   * Это важно, потому что метаданные сервера относятся к server management
   * и не должны редактироваться произвольным участником.
   * Граничные случаи: состояние сервера не должно измениться,
   * а realtime-события обновления сервера не должны отправляться.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "update-server-metadata-forbidden-session";
  const realtimeRuntime = {
    emitEvent: async (name: string, payload: Record<string, unknown>) => {
      emittedEvents.push({
        name,
        payload,
      });

      return [];
    },
  } as unknown as SlovoRealtimeRuntime;

  seedManagedServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
    role: "MEMBER",
    avatarUrl: null,
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
            updateServer(
              input: {
                serverId: "server-1"
                name: "Нельзя"
                avatarUrl: "https://cdn.example.com/forbidden.png"
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

  assert.equal(payload.errors?.[0]?.message, "Недостаточно прав для управления сервером.");
  assert.equal(servers[0]?.name, "Alpha");
  assert.equal(servers[0]?.avatarUrl, null);
  assert.equal(emittedEvents.length, 0);
});

type SeedManagedServerInput = {
  users: ReturnType<typeof createAuthTestDataLayer>["users"];
  sessions: ReturnType<typeof createAuthTestDataLayer>["sessions"];
  servers: ReturnType<typeof createAuthTestDataLayer>["servers"];
  serverMembers: ReturnType<typeof createAuthTestDataLayer>["serverMembers"];
  sessionToken: string;
  role: "OWNER" | "MEMBER";
  avatarUrl: string | null;
};

/**
 * Создает базовый серверный контекст для GraphQL-тестов метаданных сервера.
 */
function seedManagedServer(input: SeedManagedServerInput): void {
  input.users.push({
    id: "user-1",
    email: "manager@example.com",
    username: "manager",
    passwordHash: "stored-password-hash",
    displayName: "Manager",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  input.sessions.push({
    id: "session-1",
    userId: "user-1",
    tokenHash: hashSessionToken(input.sessionToken),
    createdAt: new Date(),
  });
  input.servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: input.avatarUrl,
    inviteToken: "invite-token",
    isPublic: false,
    ownerId: "user-1",
    createdAt: new Date("2026-03-17T12:00:00.000Z"),
    updatedAt: new Date("2026-03-17T12:00:00.000Z"),
  });
  input.serverMembers.push({
    id: "membership-1",
    serverId: "server-1",
    userId: "user-1",
    role: input.role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
