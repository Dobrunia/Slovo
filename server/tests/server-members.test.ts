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

test("should return the owner-only server members snapshot for moderation UI", async () => {
  /**
   * Проверяется, что owner получает список участников сервера
   * в форме, пригодной для moderation UI внутри модального окна.
   * Это важно, потому что без отдельного snapshot-а интерфейс модерации
   * не сможет показать целевых пользователей для kick/ban действий.
   * Граничные случаи: owner должен идти первым, а у каждого участника
   * должны приходить displayName, avatarUrl и role.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "server-members-session";

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
      avatarUrl: "https://cdn.example.com/member.png",
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
    updatedAt: new Date(),
  });
  serverMembers.push(
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
            serverMembers(
              input: {
                serverId: "server-1"
              }
            ) {
              serverId
              members {
                userId
                displayName
                avatarUrl
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
      serverMembers: {
        serverId: string;
        members: Array<{
          userId: string;
          displayName: string;
          avatarUrl: string | null;
          role: "OWNER" | "MEMBER";
        }>;
      };
    };
  };

  assert.deepEqual(payload.data.serverMembers, {
    serverId: "server-1",
    members: [
      {
        userId: "user-1",
        displayName: "Owner",
        avatarUrl: null,
        role: "OWNER",
      },
      {
        userId: "user-2",
        displayName: "Member",
        avatarUrl: "https://cdn.example.com/member.png",
        role: "MEMBER",
      },
    ],
  });
});

test("should reject the server members snapshot for a non-owner member", async () => {
  /**
   * Проверяется, что обычный участник не может читать owner-only moderation snapshot,
   * даже если он уже состоит в сервере и имеет валидную auth-сессию.
   * Это важно, потому что список участников вместе с moderation-действиями
   * относится к слою управления сервером и не должен быть доступен MEMBER.
   * Граничные случаи: серверное состояние не должно меняться,
   * а клиент должен получить явную ошибку прав доступа.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const sessionToken = "server-members-forbidden-session";

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
            serverMembers(
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
});
