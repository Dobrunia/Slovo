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

test("should cascade-delete members channels and bans only for the removed server", async () => {
  /**
   * Проверяется, что удаление сервера каскадно очищает связанные membership,
   * voice channels и bans только у удаляемого сервера, не затрагивая соседние серверы.
   * Это важно, потому что delete server — разрушающая операция,
   * и после нее не должно оставаться висячих связей или случайно удаляться данные другого сервера.
   * Граничные случаи: в тесте одновременно присутствуют целевой и посторонний серверы,
   * чтобы проверить точечность каскада, а не просто факт полной очистки массивов.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels, serverBans } =
    createAuthTestDataLayer();
  const sessionToken = "delete-server-cascade-session";

  users.push(
    {
      id: "owner-1",
      email: "owner@example.com",
      username: "owner",
      passwordHash: "stored-password-hash",
      displayName: "Owner",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "member-1",
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
    userId: "owner-1",
    tokenHash: hashSessionToken(sessionToken),
    createdAt: new Date(),
  });
  servers.push(
    {
      id: "server-target",
      name: "Удаляемый сервер",
      avatarUrl: null,
      inviteToken: "invite-target",
      isPublic: false,
      ownerId: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "server-keep",
      name: "Соседний сервер",
      avatarUrl: null,
      inviteToken: "invite-keep",
      isPublic: true,
      ownerId: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );
  serverMembers.push(
    {
      id: "membership-1",
      serverId: "server-target",
      userId: "owner-1",
      role: "OWNER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "membership-2",
      serverId: "server-target",
      userId: "member-1",
      role: "MEMBER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "membership-3",
      serverId: "server-keep",
      userId: "owner-1",
      role: "OWNER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );
  voiceChannels.push(
    {
      id: "channel-1",
      serverId: "server-target",
      name: "Target Channel",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-2",
      serverId: "server-keep",
      name: "Keep Channel",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );
  serverBans.push(
    {
      id: "ban-1",
      serverId: "server-target",
      userId: "member-1",
      bannedByUserId: "owner-1",
      createdAt: new Date(),
    },
    {
      id: "ban-2",
      serverId: "server-keep",
      userId: "member-1",
      bannedByUserId: "owner-1",
      createdAt: new Date(),
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
          mutation {
            deleteServer(
              input: {
                serverId: "server-target"
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

  assert.equal(payload.data.deleteServer.serverId, "server-target");
  assert.deepEqual(
    servers.map((server) => server.id),
    ["server-keep"],
  );
  assert.deepEqual(
    serverMembers.map((member) => member.serverId),
    ["server-keep"],
  );
  assert.deepEqual(
    voiceChannels.map((channel) => channel.serverId),
    ["server-keep"],
  );
  assert.deepEqual(
    serverBans.map((serverBan) => serverBan.serverId),
    ["server-keep"],
  );
});
