import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  MAX_CHANNELS_PER_SERVER,
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

test("should create a voice channel and emit a refreshed live snapshot", async () => {
  /**
   * Проверяется, что создание канала через GraphQL:
   * 1) добавляет новый voice-канал в выбранный сервер,
   * 2) ставит ему следующий `sortOrder`,
   * 3) возвращает полный обновленный список каналов и
   * 4) отправляет realtime-событие `channels.updated`.
   * Это важно, потому что channel CRUD должен сразу синхронизировать
   * и постоянное состояние, и live-экран сервера.
   * Граничные случаи: новый канал должен добавляться в конец списка,
   * а payload realtime-события обязан содержать уже отсортированный snapshot.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-create-session";
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
  });
  voiceChannels.push({
    id: "channel-1",
    serverId: "server-1",
    name: "Общий",
    sortOrder: 0,
    createdAt: new Date("2026-03-17T10:00:00.000Z"),
    updatedAt: new Date("2026-03-17T10:00:00.000Z"),
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
            createVoiceChannel(
              input: {
                serverId: "server-1"
                name: "Стрим"
              }
            ) {
              channels {
                id
                name
                sortOrder
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
      createVoiceChannel: {
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.equal(voiceChannels.length, 2);
  assert.deepEqual(payload.data.createVoiceChannel.channels, [
    {
      id: "channel-1",
      name: "Общий",
      sortOrder: 0,
    },
    {
      id: "channel-2",
      name: "Стрим",
      sortOrder: 1,
    },
  ]);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.channelsUpdated);
  assert.deepEqual(emittedEvents[0]?.payload, {
    serverId: "server-1",
    channels: [
      {
        id: "channel-1",
        name: "Общий",
        sortOrder: 0,
      },
      {
        id: "channel-2",
        name: "Стрим",
        sortOrder: 1,
      },
    ],
    updatedAt: emittedEvents[0]?.payload.updatedAt,
  });
});

test("should reject voice channel creation when the server has reached the max limit", async () => {
  /**
   * Проверяется, что сервер не позволяет создать канал сверх лимита
   * `MAX_CHANNELS_PER_SERVER`.
   * Это важно, потому что лимит каналов является частью доменной модели сервера
   * и должен соблюдаться именно на сервере, а не только в UI.
   * Граничные случаи: при отказе не должно создаться ни одного нового канала,
   * а realtime-событие обновления структуры сервера не должно отправляться.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-create-limit-session";
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
  });
  for (let index = 0; index < MAX_CHANNELS_PER_SERVER; index += 1) {
    voiceChannels.push({
      id: `channel-${index + 1}`,
      serverId: "server-1",
      name: `Канал ${index + 1}`,
      sortOrder: index,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

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
            createVoiceChannel(
              input: {
                serverId: "server-1"
                name: "Лишний"
              }
            ) {
              channels {
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
    `Внутри одного сервера нельзя создать более ${MAX_CHANNELS_PER_SERVER} каналов.`,
  );
  assert.equal(voiceChannels.length, MAX_CHANNELS_PER_SERVER);
  assert.equal(emittedEvents.length, 0);
});

test("should rename a voice channel and emit the updated live snapshot", async () => {
  /**
   * Проверяется, что переименование канала обновляет именно выбранный канал
   * и возвращает полный свежий snapshot структуры сервера.
   * Это важно, потому что клиентский экран сервера живет от initial snapshot
   * и последующих live-обновлений, а не от точечных локальных догадок.
   * Граничные случаи: порядок каналов не должен меняться,
   * а realtime-пayload обязан содержать уже новое имя канала.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-update-session";
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
      name: "Игровой",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

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
            updateVoiceChannel(
              input: {
                serverId: "server-1"
                channelId: "channel-2"
                name: "Комната"
              }
            ) {
              channels {
                id
                name
                sortOrder
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
      updateVoiceChannel: {
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.deepEqual(payload.data.updateVoiceChannel.channels, [
    {
      id: "channel-1",
      name: "Общий",
      sortOrder: 0,
    },
    {
      id: "channel-2",
      name: "Комната",
      sortOrder: 1,
    },
  ]);
  assert.equal(voiceChannels[1]?.name, "Комната");
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.channelsUpdated);
});

test("should reorder voice channels and persist the exact requested order", async () => {
  /**
   * Проверяется, что сервер принимает явный новый порядок каналов
   * и сохраняет `sortOrder` строго в соответствии с присланным массивом `channelIds`.
   * Это важно, потому что drag-and-drop или кнопки перестановки на клиенте
   * должны детерминированно приводить к одному и тому же порядку у всех клиентов.
   * Граничные случаи: итоговый snapshot обязан быть переупорядочен полностью,
   * а не только у одного измененного элемента.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-reorder-session";
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
  });
  voiceChannels.push(
    {
      id: "channel-1",
      serverId: "server-1",
      name: "Один",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-2",
      serverId: "server-1",
      name: "Два",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-3",
      serverId: "server-1",
      name: "Три",
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

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
            reorderVoiceChannels(
              input: {
                serverId: "server-1"
                channelIds: ["channel-3", "channel-1", "channel-2"]
              }
            ) {
              channels {
                id
                name
                sortOrder
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
      reorderVoiceChannels: {
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.deepEqual(payload.data.reorderVoiceChannels.channels, [
    {
      id: "channel-3",
      name: "Три",
      sortOrder: 0,
    },
    {
      id: "channel-1",
      name: "Один",
      sortOrder: 1,
    },
    {
      id: "channel-2",
      name: "Два",
      sortOrder: 2,
    },
  ]);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.channelsUpdated);
});

test("should delete a voice channel, compact sort order and emit the refreshed snapshot", async () => {
  /**
   * Проверяется, что удаление канала:
   * 1) действительно удаляет выбранный канал,
   * 2) переуплотняет `sortOrder` у оставшихся каналов без дырок и
   * 3) отправляет live-снимок уже новой структуры.
   * Это важно, потому что после delete серверный экран не должен зависать
   * с невалидным порядком каналов или ссылками на удаленную сущность.
   * Граничные случаи: после удаления среднего канала соседние элементы
   * должны получить последовательные `sortOrder` 0..N-1.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-delete-session";
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
  });
  voiceChannels.push(
    {
      id: "channel-1",
      serverId: "server-1",
      name: "Один",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-2",
      serverId: "server-1",
      name: "Два",
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "channel-3",
      serverId: "server-1",
      name: "Три",
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  );

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
            deleteVoiceChannel(
              input: {
                serverId: "server-1"
                channelId: "channel-2"
              }
            ) {
              channels {
                id
                name
                sortOrder
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
      deleteVoiceChannel: {
        channels: Array<{
          id: string;
          name: string;
          sortOrder: number;
        }>;
      };
    };
  };

  assert.deepEqual(payload.data.deleteVoiceChannel.channels, [
    {
      id: "channel-1",
      name: "Один",
      sortOrder: 0,
    },
    {
      id: "channel-3",
      name: "Три",
      sortOrder: 1,
    },
  ]);
  assert.deepEqual(
    voiceChannels.map((channel) => ({
      id: channel.id,
      sortOrder: channel.sortOrder,
    })),
    [
      {
        id: "channel-1",
        sortOrder: 0,
      },
      {
        id: "channel-3",
        sortOrder: 1,
      },
    ],
  );
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0]?.name, REALTIME_EVENT_NAMES.channelsUpdated);
});

test("should reject voice channel management for a non-manager member", async () => {
  /**
   * Проверяется, что обычный MEMBER не может управлять каналами сервера,
   * даже если он состоит в сервере и прошел аутентификацию.
   * Это важно, потому что channel CRUD относится к server management
   * и должен быть доступен только OWNER.
   * Граничные случаи: существующий канал не должен измениться,
   * а realtime-событие обновления каналов не должно отправляться.
   */
  const { dataLayer, users, sessions, servers, serverMembers, voiceChannels } =
    createAuthTestDataLayer();
  const emittedEvents: Array<{
    name: string;
    payload: Record<string, unknown>;
  }> = [];
  const sessionToken = "channel-forbidden-session";
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
  });
  voiceChannels.push({
    id: "channel-1",
    serverId: "server-1",
    name: "Общий",
    sortOrder: 0,
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
            updateVoiceChannel(
              input: {
                serverId: "server-1"
                channelId: "channel-1"
                name: "Нельзя"
              }
            ) {
              channels {
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
  assert.equal(voiceChannels[0]?.name, "Общий");
  assert.equal(emittedEvents.length, 0);
});

type SeedManagedServerInput = {
  users: ReturnType<typeof createAuthTestDataLayer>["users"];
  sessions: ReturnType<typeof createAuthTestDataLayer>["sessions"];
  servers: ReturnType<typeof createAuthTestDataLayer>["servers"];
  serverMembers: ReturnType<typeof createAuthTestDataLayer>["serverMembers"];
  sessionToken: string;
  role: "OWNER" | "MEMBER";
};

/**
 * Заполняет базовый серверный контекст для auth GraphQL-теста channel CRUD.
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
    avatarUrl: null,
    inviteToken: "invite-token",
    isPublic: false,
    ownerId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
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
