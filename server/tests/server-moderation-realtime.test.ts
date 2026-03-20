import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  SESSION_TOKEN_HEADER,
} from "../src/config/constants.js";
import { hashSessionToken } from "../src/auth/session.js";
import { createGraphqlServer } from "../src/graphql/server.js";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";
import { createRuntimeScreenShareRegistry } from "../src/realtime/screen-share.js";
import { forceDisconnectRealtimeUser } from "../src/realtime/forced-disconnect.js";
import { createRuntimeVoiceStateRegistry } from "../src/realtime/voice-state.js";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

test("should force-disconnect an active member when kicking through GraphQL", async () => {
  /**
   * Проверяется, что kick-сценарий дергает специальный realtime/media cleanup helper
   * до live-удаления сервера из списка пользователя.
   * Это важно, потому что moderation не должна ограничиваться удалением membership в БД:
   * активный участник обязан немедленно вылететь из voice presence и media session.
   * Граничные случаи: helper должен получить именно target user и конкретный serverId,
   * а причина forced disconnect должна отличаться от бана.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const forceDisconnectCalls: Array<{
    userId: string;
    serverId: string;
    reason: string;
  }> = [];
  const sessionToken = "kick-realtime-session";

  seedModerationServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
  });

  const yoga = createGraphqlServer({
    dataLayer,
    realtimeRuntime: {
      emitEvent: async () => [],
    } as never,
    forceDisconnectUserFromServer: async (input) => {
      forceDisconnectCalls.push(input);
      return true;
    },
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
  assert.deepEqual(forceDisconnectCalls, [
    {
      userId: "user-2",
      serverId: "server-1",
      reason: "Вы были исключены из сервера.",
    },
  ]);
});

test("should force-disconnect an active member when banning through GraphQL", async () => {
  /**
   * Проверяется, что ban-сценарий вызывает тот же forced disconnect helper,
   * но с отдельной человекочитаемой причиной для целевого пользователя.
   * Это важно, потому что ban должен завершать active voice presence так же строго, как kick,
   * и клиент должен получить именно ban-специфичное объяснение разрыва.
   * Граничные случаи: target user и serverId обязаны совпадать с moderation-целью,
   * а причина не должна подменяться текстом от kick-сценария.
   */
  const { dataLayer, users, sessions, servers, serverMembers } = createAuthTestDataLayer();
  const forceDisconnectCalls: Array<{
    userId: string;
    serverId: string;
    reason: string;
  }> = [];
  const sessionToken = "ban-realtime-session";

  seedModerationServer({
    users,
    sessions,
    servers,
    serverMembers,
    sessionToken,
  });

  const yoga = createGraphqlServer({
    dataLayer,
    realtimeRuntime: {
      emitEvent: async () => [],
    } as never,
    forceDisconnectUserFromServer: async (input) => {
      forceDisconnectCalls.push(input);
      return true;
    },
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
  assert.deepEqual(forceDisconnectCalls, [
    {
      userId: "user-2",
      serverId: "server-1",
      reason: "Вы были заблокированы в сервере.",
    },
  ]);
});

test("should clear presence screen share and media state during forced disconnect", async () => {
  /**
   * Проверяется, что forced disconnect:
   * 1) снимает пользователя с runtime presence,
   * 2) очищает его voice state,
   * 3) выключает активную демонстрацию экрана и
   * 4) teardown-ит media session с realtime-событиями для остальных участников.
   * Это важно, потому что без полного cleanup moderation оставит висящие presence/media-хвосты,
   * и UI других пользователей начнет показывать несогласованное состояние канала.
   * Граничные случаи: screen share может быть активен, а user уже иметь mute/deafen state,
   * поэтому helper должен зачистить обе runtime-ветки за один проход.
   */
  const presenceRegistry = createRuntimePresenceRegistry();
  const voiceStateRegistry = createRuntimeVoiceStateRegistry();
  const screenShareRegistry = createRuntimeScreenShareRegistry();
  const emittedPresenceEvents: Array<Record<string, unknown>> = [];
  const emittedScreenShareEvents: Array<Record<string, unknown>> = [];
  const emittedForcedDisconnectEvents: Array<Record<string, unknown>> = [];
  const teardownCalls: Array<{
    type: "session" | "screen";
    userId: string;
    serverId: string;
    channelId: string;
  }> = [];

  presenceRegistry.setPresence({
    userId: "user-2",
    displayName: "Member",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
    occurredAt: "2026-03-20T12:00:00.000Z",
  });
  voiceStateRegistry.setState({
    userId: "user-2",
    serverId: "server-1",
    channelId: "channel-1",
    muted: true,
    deafened: true,
  });
  screenShareRegistry.setState({
    userId: "user-2",
    serverId: "server-1",
    channelId: "channel-1",
  });

  const didForceDisconnect = await forceDisconnectRealtimeUser({
    userId: "user-2",
    serverId: "server-1",
    reason: "Вы были заблокированы в сервере.",
    presenceRegistry,
    voiceStateRegistry,
    screenShareRegistry,
    mediaSignalingBridge: {
      handleSignal: async () => ({
        accepted: true,
        acknowledgedAt: new Date().toISOString(),
      }),
      teardownUserSession: async (input) => {
        teardownCalls.push({
          type: "session",
          ...input,
        });
      },
      teardownUserScreenShare: async (input) => {
        teardownCalls.push({
          type: "screen",
          ...input,
        });
      },
      applyVoiceState: async () => undefined,
    },
    emitPresenceUpdated: async (payload) => {
      emittedPresenceEvents.push(payload);
    },
    emitScreenShareUpdated: async (payload) => {
      emittedScreenShareEvents.push(payload);
    },
    emitForcedDisconnect: async (payload) => {
      emittedForcedDisconnectEvents.push(payload);
    },
  });

  assert.equal(didForceDisconnect, true);
  assert.equal(presenceRegistry.getUserPresence("user-2"), null);
  assert.equal(voiceStateRegistry.getUserState("user-2"), null);
  assert.equal(screenShareRegistry.getUserState("user-2"), null);
  assert.deepEqual(teardownCalls, [
    {
      type: "screen",
      userId: "user-2",
      serverId: "server-1",
      channelId: "channel-1",
    },
    {
      type: "session",
      userId: "user-2",
      serverId: "server-1",
      channelId: "channel-1",
    },
  ]);
  assert.equal(emittedScreenShareEvents.length, 1);
  assert.deepEqual(emittedScreenShareEvents[0], {
    serverId: "server-1",
    userId: "user-2",
    channelId: "channel-1",
    active: false,
    occurredAt: emittedScreenShareEvents[0]?.occurredAt,
  });
  assert.equal(emittedPresenceEvents.length, 1);
  assert.deepEqual(emittedPresenceEvents[0], {
    serverId: "server-1",
    member: {
      userId: "user-2",
      displayName: "Member",
      avatarUrl: null,
      channelId: "channel-1",
      joinedAt: "2026-03-20T12:00:00.000Z",
    },
    previousChannelId: "channel-1",
    action: "left",
    occurredAt: emittedPresenceEvents[0]?.occurredAt,
  });
  assert.equal(emittedForcedDisconnectEvents.length, 1);
  assert.deepEqual(emittedForcedDisconnectEvents[0], {
    serverId: "server-1",
    userId: "user-2",
    reason: "Вы были заблокированы в сервере.",
    occurredAt: emittedForcedDisconnectEvents[0]?.occurredAt,
  });
});

type SeedModerationServerInput = {
  users: ReturnType<typeof createAuthTestDataLayer>["users"];
  sessions: ReturnType<typeof createAuthTestDataLayer>["sessions"];
  servers: ReturnType<typeof createAuthTestDataLayer>["servers"];
  serverMembers: ReturnType<typeof createAuthTestDataLayer>["serverMembers"];
  sessionToken: string;
};

/**
 * Создает минимальный сервер и двух участников для GraphQL-тестов forced moderation.
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
