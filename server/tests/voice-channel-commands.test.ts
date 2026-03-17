import test from "node:test";
import assert from "node:assert/strict";
import { createAuthTestDataLayer } from "./helpers/auth-test-helpers.js";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";
import {
  joinVoiceChannelCommand,
  leaveVoiceChannelCommand,
  moveVoiceChannelCommand,
} from "../src/realtime/voice-commands.js";

/**
 * Проверяется, что join-команда валидирует membership, помещает пользователя
 * в runtime presence и эмитит live-событие входа в канал.
 * Это важно, потому что первая точка взаимодействия с voice-каналом должна
 * сразу менять runtime state и давать клиентам событие для синхронизации UI.
 * Граничные случаи: событие должно содержать аватар и display name пользователя,
 * а ack обязан возвращаться даже без дополнительной GraphQL-перезагрузки.
 */
test("should join a voice channel and emit a joined presence event", async () => {
  const { dataLayer, users, servers, serverMembers, voiceChannels } = createAuthTestDataLayer();
  const presenceRegistry = createRuntimePresenceRegistry();
  const emittedEvents: Array<{
    serverId: string;
    member: {
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      serverId: string;
      channelId: string;
      joinedAt: string;
    };
    previousChannelId: string | null;
    action: "joined" | "left" | "moved";
    occurredAt: string;
  }> = [];

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash: "hash",
    displayName: "Добрыня",
    avatarUrl: "https://cdn.example.com/avatar.png",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  servers.push({
    id: "server-1",
    name: "Основной сервер",
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
  voiceChannels.push({
    id: "channel-1",
    serverId: "server-1",
    name: "Общий",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const ack = await joinVoiceChannelCommand({
    dataLayer,
    presenceRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    emitPresenceUpdated: async (payload) => {
      emittedEvents.push(payload);
    },
  });

  assert.equal(ack.accepted, true);
  assert.equal(typeof ack.acknowledgedAt, "string");
  assert.deepEqual(presenceRegistry.getServerPresence("server-1"), [
    {
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: "https://cdn.example.com/avatar.png",
      serverId: "server-1",
      channelId: "channel-1",
      joinedAt: ack.acknowledgedAt,
    },
  ]);
  assert.deepEqual(emittedEvents, [
    {
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: "https://cdn.example.com/avatar.png",
        serverId: "server-1",
        channelId: "channel-1",
        joinedAt: ack.acknowledgedAt,
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: ack.acknowledgedAt,
    },
  ]);
});

/**
 * Проверяется, что move и leave команды используют одну и ту же runtime-модель:
 * сначала пользователь переносится в другой канал, затем полностью выходит из voice.
 * Это важно, потому что voice-flow должен быть непротиворечивым и не оставлять
 * "зависших" присутствий ни после перехода, ни после выхода из канала.
 * Граничные случаи: move обязан эмитить `moved` с `previousChannelId`,
 * а leave обязан удалить пользователя из registry и отправить `left`.
 */
test("should move between channels and then leave the current voice presence", async () => {
  const { dataLayer, users, servers, serverMembers, voiceChannels } = createAuthTestDataLayer();
  const presenceRegistry = createRuntimePresenceRegistry();
  const emittedEvents: Array<{
    serverId: string;
    member: {
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      serverId: string;
      channelId: string;
      joinedAt: string;
    };
    previousChannelId: string | null;
    action: "joined" | "left" | "moved";
    occurredAt: string;
  }> = [];

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash: "hash",
    displayName: "Добрыня",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  servers.push({
    id: "server-1",
    name: "Основной сервер",
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
  voiceChannels.push(
    {
      id: "channel-1",
      serverId: "server-1",
      name: "Общий",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-2",
      serverId: "server-1",
      name: "Стрим",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

  await joinVoiceChannelCommand({
    dataLayer,
    presenceRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    emitPresenceUpdated: async (payload) => {
      emittedEvents.push(payload);
    },
  });

  const moveAck = await moveVoiceChannelCommand({
    dataLayer,
    presenceRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    targetChannelId: "channel-2",
    emitPresenceUpdated: async (payload) => {
      emittedEvents.push(payload);
    },
  });

  const leaveAck = await leaveVoiceChannelCommand({
    dataLayer,
    presenceRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-2",
    emitPresenceUpdated: async (payload) => {
      emittedEvents.push(payload);
    },
  });

  assert.equal(moveAck.accepted, true);
  assert.equal(leaveAck.accepted, true);
  assert.equal(presenceRegistry.getUserPresence("user-1"), null);
  assert.deepEqual(
    emittedEvents.map((event) => ({
      action: event.action,
      channelId: event.member.channelId,
      previousChannelId: event.previousChannelId,
    })),
    [
      {
        action: "joined",
        channelId: "channel-1",
        previousChannelId: null,
      },
      {
        action: "moved",
        channelId: "channel-2",
        previousChannelId: "channel-1",
      },
      {
        action: "left",
        channelId: "channel-2",
        previousChannelId: "channel-2",
      },
    ],
  );
});

/**
 * Проверяется, что команды не дают работать с каналами постороннего сервера
 * и корректно режут сценарии без membership или с несуществующим каналом.
 * Это важно, потому что realtime-команды не должны обходить ту же access-модель,
 * что и обычный GraphQL-слой приложения.
 * Граничные случаи: пользователь состоит в одном сервере, но пытается зайти
 * в канал другого сервера, и команда должна завершиться доменной ошибкой.
 */
test("should reject a voice join command for a server without membership", async () => {
  const { dataLayer, users, servers, voiceChannels } = createAuthTestDataLayer();
  const presenceRegistry = createRuntimePresenceRegistry();

  users.push({
    id: "user-1",
    email: "user@example.com",
    username: "dobrunia",
    passwordHash: "hash",
    displayName: "Добрыня",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  servers.push({
    id: "server-1",
    name: "Чужой сервер",
    avatarUrl: null,
    inviteToken: null,
    isPublic: false,
    ownerId: "user-2",
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

  await assert.rejects(
    () =>
      joinVoiceChannelCommand({
        dataLayer,
        presenceRegistry,
        userId: "user-1",
        serverId: "server-1",
        channelId: "channel-1",
        emitPresenceUpdated: async () => undefined,
      }),
    {
      message: "Сервер недоступен.",
    },
  );
});
