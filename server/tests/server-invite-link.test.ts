import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CLIENT_ORIGIN,
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  DEFAULT_SERVER_INVITE_PATHNAME,
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

test("should lazily create and return an invite link through GraphQL for a server manager", async () => {
  /**
   * Проверяется, что query invite-ссылки умеет лениво создать токен,
   * если у сервера он еще не был выпущен, и сразу вернуть готовую ссылку.
   * Это важно, потому что после миграции могут существовать старые серверы без inviteToken,
   * а UI настроек сервера не должен ломаться или требовать отдельной ручной инициализации.
   * Граничные случаи: доступ разрешен только manager-роли, токен создается ровно на выбранном сервере,
   * а итоговая ссылка должна собираться из client origin и invite path prefix.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "server-invite-query-session";

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
  servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    inviteToken: null,
    isPublic: false,
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
            serverInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      serverInviteLink: {
        serverId: string;
        inviteLink: string;
      };
    };
  };

  assert.equal(payload.data.serverInviteLink.serverId, "server-1");
  assert.ok(servers[0]?.inviteToken);
  assert.equal(
    payload.data.serverInviteLink.inviteLink,
    `${DEFAULT_CLIENT_ORIGIN}${DEFAULT_SERVER_INVITE_PATHNAME}${servers[0]?.inviteToken}`,
  );
});

test("should keep the same invite link stable until the owner explicitly regenerates it", async () => {
  /**
   * Проверяется, что уже выданная invite-ссылка остается той же самой
   * при повторных чтениях, пока владелец сервера не запросит регенерацию.
   * Это важно, потому что пользовательский invite-flow предполагает стабильную ссылку:
   * ее можно отправить другому человеку и ожидать, что она не протухнет от простого открытия настроек.
   * Граничные случаи: запрос выполняется два раза подряд для уже существующего inviteToken,
   * а сервер не должен подменять токен сам по себе между чтениями.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "server-invite-stable-session";

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
  servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    inviteToken: "stable-token",
    isPublic: false,
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

  const yoga = createGraphqlServer({
    dataLayer,
  });

  const firstResponse = await yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      body: JSON.stringify({
        query: `
          query {
            serverInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
            }
          }
        `,
      }),
    }),
  );

  const secondResponse = await yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      body: JSON.stringify({
        query: `
          query {
            serverInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
            }
          }
        `,
      }),
    }),
  );

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const firstPayload = (await firstResponse.json()) as {
    data: {
      serverInviteLink: {
        serverId: string;
        inviteLink: string;
      };
    };
  };
  const secondPayload = (await secondResponse.json()) as {
    data: {
      serverInviteLink: {
        serverId: string;
        inviteLink: string;
      };
    };
  };

  assert.equal(firstPayload.data.serverInviteLink.serverId, "server-1");
  assert.equal(secondPayload.data.serverInviteLink.serverId, "server-1");
  assert.equal(firstPayload.data.serverInviteLink.inviteLink, secondPayload.data.serverInviteLink.inviteLink);
  assert.equal(
    firstPayload.data.serverInviteLink.inviteLink,
    `${DEFAULT_CLIENT_ORIGIN}${DEFAULT_SERVER_INVITE_PATHNAME}stable-token`,
  );
  assert.equal(servers[0]?.inviteToken, "stable-token");
});

test("should reject invite link access for a server member without management rights", async () => {
  /**
   * Проверяется, что invite-ссылка и ее управление не доступны обычному MEMBER-участнику,
   * даже если он уже состоит в сервере и аутентифицирован.
   * Это важно, потому что invite flow относится к server management,
   * и простой факт membership не должен автоматически давать доступ к server settings.
   * Граничные случаи: состояние сервера не должно измениться, inviteToken не должен создаться лениво,
   * а ошибка должна быть доменной и явной.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "server-invite-forbidden-session";

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
    inviteToken: null,
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
            serverInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
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
  assert.equal(servers[0]?.inviteToken, null);
});

test("should regenerate an invite link through GraphQL and emit a server realtime update", async () => {
  /**
   * Проверяется, что перевыпуск invite-ссылки меняет сохраненный inviteToken сервера
   * и отправляет realtime-событие обновления сервера для live-инвалидации клиентов.
   * Это важно, потому что invite link — редактируемое состояние сервера,
   * и после регенерации старый токен должен перестать быть активным.
   * Граничные случаи: доступ есть только у владельца, ссылка должна реально измениться,
   * а payload realtime-события обязан содержать актуальные публичные метаданные сервера.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "server-invite-regenerate-session";
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
  servers.push({
    id: "server-1",
    name: "Alpha",
    avatarUrl: "https://cdn.example.com/server.png",
    inviteToken: "old-token",
    isPublic: true,
    ownerId: "owner-1",
    createdAt: new Date(),
    updatedAt: new Date("2026-03-17T10:00:00.000Z"),
  });
  serverMembers.push({
    id: "membership-1",
    serverId: "server-1",
    userId: "user-1",
    role: "OWNER",
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
            regenerateServerInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
            }
          }
        `,
      }),
    }),
  );

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      regenerateServerInviteLink: {
        serverId: string;
        inviteLink: string;
      };
    };
  };

  assert.equal(payload.data.regenerateServerInviteLink.serverId, "server-1");
  assert.ok(servers[0]?.inviteToken);
  assert.notEqual(servers[0]?.inviteToken, "old-token");
  assert.equal(
    payload.data.regenerateServerInviteLink.inviteLink,
    `${DEFAULT_CLIENT_ORIGIN}${DEFAULT_SERVER_INVITE_PATHNAME}${servers[0]?.inviteToken}`,
  );
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.serverUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    serverId: "server-1",
    name: "Alpha",
    avatarUrl: "https://cdn.example.com/server.png",
    isPublic: true,
    updatedAt: servers[0]?.updatedAt.toISOString(),
  });
});

test("should reject invite link regeneration for a server member without management rights", async () => {
  /**
   * Проверяется, что обычный MEMBER не может перевыпустить invite-ссылку сервера,
   * даже если он аутентифицирован и уже состоит в этом сервере.
   * Это важно, потому что регенерация invite token — управленческое действие,
   * которое должно быть доступно только владельцу, иначе любой участник
   * смог бы сбрасывать действующие приглашения и ломать onboarding сервера.
   * Граничные случаи: старый inviteToken должен остаться без изменений,
   * а realtime-события обновления сервера не должны отправляться.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "server-invite-regenerate-forbidden-session";
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
    inviteToken: "existing-token",
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
            regenerateServerInviteLink(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              inviteLink
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
  assert.equal(servers[0]?.inviteToken, "existing-token");
  assert.equal(emittedEvents.length, 0);
});
