import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  DISPLAY_NAME_MAX_LENGTH,
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
 * Проверяется, что мутация изменения display name обновляет профиль текущего пользователя,
 * сохраняет уже существующий avatarUrl, нормализует пробелы по краям
 * и отправляет realtime-событие profileUpdated с актуальным профилем.
 * Это важно, потому что задача соединяет сразу постоянное состояние профиля
 * и live-синхронизацию всех клиентов, где этот пользователь видим.
 * Граничные случаи: display name приходит с внешними пробелами,
 * avatar не должен теряться, а realtime payload обязан использовать обновленное время.
 */
test("should update display name through GraphQL and emit profile realtime event", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "update-display-name-session-token";
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
    displayName: "Старое имя",
    avatarUrl: "https://example.com/avatar.png",
    createdAt: new Date("2026-03-17T10:00:00.000Z"),
    updatedAt: new Date("2026-03-17T10:00:00.000Z"),
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
            updateDisplayName(
              input: {
                displayName: "  Новое имя  "
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
      updateDisplayName: {
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

  assert.equal(users[0]?.displayName, "Новое имя");
  assert.equal(users[0]?.avatarUrl, "https://example.com/avatar.png");
  assert.deepEqual(payload.data.updateDisplayName.user, {
    id: "user-1",
    email: "profile@example.com",
    username: "profile-user",
    displayName: "Новое имя",
    avatarUrl: "https://example.com/avatar.png",
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.profileUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    userId: "user-1",
    displayName: "Новое имя",
    avatarUrl: "https://example.com/avatar.png",
    updatedAt: users[0]?.updatedAt.toISOString(),
  });
});

/**
 * Проверяется, что мутация не принимает заведомо невалидный display name,
 * не трогает существующий профиль и не отправляет realtime-событие при ошибке валидации.
 * Это важно, потому что профильные ограничения должны соблюдаться до записи в БД,
 * а live-слой не должен рассылать фиктивные обновления при отклоненном запросе.
 * Граничные случаи: длина превышает серверный максимум,
 * старое имя пользователя должно остаться без изменений, а список событий — пустым.
 */
test("should reject invalid display name update without mutating profile or emitting events", async () => {
  const { dataLayer, users, sessions } = createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "invalid-display-name-session-token";
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
    displayName: "Старое имя",
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

  const tooLongDisplayName = "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1);
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
            updateDisplayName(
              input: {
                displayName: ${JSON.stringify(tooLongDisplayName)}
              }
            ) {
              user {
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
      extensions?: {
        strictql?: {
          code?: string;
        };
      };
    }>;
  };

  assert.equal(payload.errors?.[0]?.extensions?.strictql?.code, "INPUT_VALIDATION_ERROR");
  assert.equal(users[0]?.displayName, "Старое имя");
  assert.equal(emittedEvents.length, 0);
});
