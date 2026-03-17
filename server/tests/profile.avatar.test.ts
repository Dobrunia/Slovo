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

/**
 * Проверяется, что мутация изменения аватара обновляет avatarUrl текущего пользователя
 * и рассылает profileUpdated с новым аватаром, не теряя display name.
 * Это важно, потому что аватар — live-видимая часть профиля,
 * и ошибка здесь сразу ломает согласованность между БД и клиентскими экранами.
 * Граничные случаи: URL приходит с внешними пробелами,
 * display name обязан остаться прежним, а realtime payload должен содержать новый avatarUrl.
 */
test("should update avatar through GraphQL and emit profile realtime event", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "update-avatar-session-token";
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
    email: "profile@example.com",
    username: "profile-user",
    passwordHash: "stored-password-hash",
    displayName: "Имя профиля",
    avatarUrl: null,
    createdAt: new Date("2026-03-17T11:00:00.000Z"),
    updatedAt: new Date("2026-03-17T11:00:00.000Z"),
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
            updateAvatar(
              input: {
                avatarUrl: "  https://example.com/new-avatar.png  "
              }
            ) {
              user {
                id
                email
                username
                displayName
                avatarUrl
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
      updateAvatar: {
        user: {
          id: string;
          email: string;
          username: string;
          displayName: string;
          avatarUrl?: string;
        };
      };
    };
  };

  assert.equal(users[0]?.avatarUrl, "https://example.com/new-avatar.png");
  assert.equal(users[0]?.displayName, "Имя профиля");
  assert.deepEqual(payload.data.updateAvatar.user, {
    id: "user-1",
    email: "profile@example.com",
    username: "profile-user",
    displayName: "Имя профиля",
    avatarUrl: "https://example.com/new-avatar.png",
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.profileUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-1",
    displayName: "Имя профиля",
    avatarUrl: "https://example.com/new-avatar.png",
    updatedAt: users[0]?.updatedAt.toISOString(),
  });
});

/**
 * Проверяется, что мутация позволяет очистить аватар,
 * если пользователь передал пустую строку вместо URL,
 * и при этом тоже отправляет корректное live-обновление профиля.
 * Это важно, потому что снятие аватара — такой же допустимый профильный сценарий,
 * как и установка нового изображения, а клиенту нужен единый mutation для обоих действий.
 * Граничные случаи: входное значение состоит только из пробелов,
 * avatarUrl должен стать `null`, а realtime payload тоже обязан передать `null`.
 */
test("should clear avatar through GraphQL and emit profile realtime event with null avatar", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "clear-avatar-session-token";
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
    email: "profile@example.com",
    username: "profile-user",
    passwordHash: "stored-password-hash",
    displayName: "Имя профиля",
    avatarUrl: "https://example.com/current-avatar.png",
    createdAt: new Date("2026-03-17T11:00:00.000Z"),
    updatedAt: new Date("2026-03-17T11:00:00.000Z"),
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
            updateAvatar(
              input: {
                avatarUrl: "   "
              }
            ) {
              user {
                id
                displayName
                avatarUrl
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
      updateAvatar: {
        user: {
          id: string;
          displayName: string;
          avatarUrl?: string;
        };
      };
    };
  };

  assert.equal(users[0]?.avatarUrl, null);
  assert.deepEqual(payload.data.updateAvatar.user, {
    id: "user-1",
    displayName: "Имя профиля",
    avatarUrl: null,
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.profileUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-1",
    displayName: "Имя профиля",
    avatarUrl: null,
    updatedAt: users[0]?.updatedAt.toISOString(),
  });
});
