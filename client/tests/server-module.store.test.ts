import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import { useServerModuleStore } from "../src/stores/serverModule";
import { useServersStore } from "../src/stores/servers";
import type { ClientUser } from "../src/types/auth";

const realtimeMocks = vi.hoisted(() => ({
  join: vi.fn(),
  leave: vi.fn(),
  move: vi.fn(),
  setSelfMute: vi.fn(),
  setSelfDeafen: vi.fn(),
  setScreenShareActive: vi.fn(),
}));

vi.mock("../src/realtime/runtime", () => ({
  executeJoinVoiceChannelCommand: realtimeMocks.join,
  executeLeaveVoiceChannelCommand: realtimeMocks.leave,
  executeMoveVoiceChannelCommand: realtimeMocks.move,
  executeSetSelfMuteCommand: realtimeMocks.setSelfMute,
  executeSetSelfDeafenCommand: realtimeMocks.setSelfDeafen,
  executeSetScreenShareActiveCommand: realtimeMocks.setScreenShareActive,
}));

const testUser: ClientUser = {
  id: "user-1",
  email: "user@example.com",
  username: "dobrunia",
  displayName: "Добрыня",
  avatarUrl: null,
};

describe("server module store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    realtimeMocks.join.mockReset();
    realtimeMocks.leave.mockReset();
    realtimeMocks.move.mockReset();
    realtimeMocks.setSelfMute.mockReset();
    realtimeMocks.setSelfDeafen.mockReset();
    realtimeMocks.setScreenShareActive.mockReset();
  });

  /**
   * Проверяется, что store умеет выбрать первый доступный сервер,
   * автоматически загрузить его GraphQL snapshot и сохранить текущий selection.
   * Это важно, потому что home-экран после логина должен сразу показывать
   * содержимое одного из серверов, а не оставаться в пустом состоянии при наличии данных.
   * Граничные случаи: если до этого ничего не было выбрано, store должен взять
   * первый id из списка и выполнить запрос с session token текущего пользователя.
   */
  test("should pick the first available server and load its snapshot", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverSnapshot: {
              server: {
                id: "server-1",
                name: "Основной сервер",
                avatarUrl: null,
                isPublic: false,
                role: "OWNER",
              },
              channels: [
                {
                  id: "channel-1",
                  name: "Общий",
                  sortOrder: 0,
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverPresenceSnapshot: {
              members: [
                {
                  userId: "user-1",
                  displayName: "Добрыня",
                  avatarUrl: null,
                  channelId: "channel-1",
                  joinedAt: "2026-03-17T10:00:00.000Z",
                },
              ],
            },
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();

    await serverModuleStore.syncAvailableServers(["server-1", "server-2"]);

    expect(serverModuleStore.selectedServerId).toBe("server-1");
    expect(serverModuleStore.snapshot?.server.name).toBe("Основной сервер");
    expect(serverModuleStore.snapshot?.channels).toHaveLength(1);
    expect(serverModuleStore.presenceMembers).toEqual([
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_CLIENT_GRAPHQL_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer active-session-token",
        }),
      }),
    );

    const snapshotRequestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const snapshotPayload = JSON.parse(String(snapshotRequestInit.body)) as {
      query: string;
    };
    const presenceRequestInit = fetchMock.mock.calls.at(1)?.[1] as RequestInit;
    const presencePayload = JSON.parse(String(presenceRequestInit.body)) as {
      query: string;
    };

    expect(snapshotPayload.query).toContain("serverSnapshot");
    expect(snapshotPayload.query).toContain('serverId: "server-1"');
    expect(presencePayload.query).toContain("serverPresenceSnapshot");
    expect(presencePayload.query).toContain('serverId: "server-1"');
  });

  /**
   * Проверяется, что store корректно сбрасывает selection и snapshot,
   * когда у пользователя больше не остается ни одного доступного сервера.
   * Это важно, потому что UI не должен продолжать показывать старые данные
   * уже недоступного сервера после logout, смены аккаунта или очистки списка.
   * Граничные случаи: сетевой запрос в этом сценарии не нужен, а все reactive-поля
   * должны вернуться в начальное состояние без остаточного selectedServerId.
   */
  test("should reset the module state when there are no available servers", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();

    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [],
    };

    await serverModuleStore.syncAvailableServers([]);

    expect(serverModuleStore.selectedServerId).toBeNull();
    expect(serverModuleStore.snapshot).toBeNull();
    expect(serverModuleStore.errorMessage).toBeNull();
  });

  /**
   * Проверяется, что store умеет создавать канал через GraphQL
   * и сразу заменяет локальный список каналов на payload, который вернул сервер.
   * Это важно, потому что server settings modal должен видеть итоговый серверный порядок,
   * а не строить локальные предположения о `sortOrder` и новых id.
   * Граничные случаи: в мутацию должен уходить текущий `serverId`,
   * а новый канал должен появляться в конце snapshot-а.
   */
  test("should create a channel and replace the local snapshot with the mutation result", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          createVoiceChannel: {
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
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [
        {
          id: "channel-1",
          name: "Общий",
          sortOrder: 0,
        },
      ],
    };

    await serverModuleStore.createChannel("  Стрим  ");

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("createVoiceChannel");
    expect(payload.query).toContain('serverId: "server-1"');
    expect(payload.query).toContain('name: "Стрим"');
    expect(serverModuleStore.snapshot?.channels).toEqual([
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
  });

  /**
   * Проверяется, что переименование канала обновляет именно тот snapshot,
   * который вернул сервер после мутации, без повторной полной загрузки сервера.
   * Это важно, потому что в модалке редактирования каналов имя должно обновляться
   * мгновенно и строго по серверному источнику истины.
   * Граничные случаи: запрос обязан содержать `channelId`,
   * а соседние каналы не должны потерять свои `sortOrder`.
   */
  test("should update a channel name from the returned mutation snapshot", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          updateVoiceChannel: {
            channels: [
              {
                id: "channel-1",
                name: "Комната",
                sortOrder: 0,
              },
              {
                id: "channel-2",
                name: "Стрим",
                sortOrder: 1,
              },
            ],
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
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
    };

    await serverModuleStore.updateChannel("channel-1", "  Комната  ");

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("updateVoiceChannel");
    expect(payload.query).toContain('channelId: "channel-1"');
    expect(payload.query).toContain('name: "Комната"');
    expect(serverModuleStore.snapshot?.channels).toEqual([
      {
        id: "channel-1",
        name: "Комната",
        sortOrder: 0,
      },
      {
        id: "channel-2",
        name: "Стрим",
        sortOrder: 1,
      },
    ]);
  });

  /**
   * Проверяется, что перестановка каналов отправляет на сервер точный новый порядок id
   * и локально принимает именно тот упорядоченный snapshot, который вернула мутация.
   * Это важно, потому что reorder не должен вычисляться на клиенте постфактум:
   * сервер остается источником истины по `sortOrder`.
   * Граничные случаи: запрос обязан содержать новый массив `channelIds`,
   * а store должен сохранить каналы уже в новом порядке.
   */
  test("should reorder channels from the returned mutation snapshot", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          reorderVoiceChannels: {
            channels: [
              {
                id: "channel-2",
                name: "Стрим",
                sortOrder: 0,
              },
              {
                id: "channel-1",
                name: "Общий",
                sortOrder: 1,
              },
            ],
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
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
    };

    await serverModuleStore.reorderChannels(["channel-2", "channel-1"]);

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("reorderVoiceChannels");
    expect(payload.query).toContain('channelIds: ["channel-2","channel-1"]');
    expect(serverModuleStore.snapshot?.channels).toEqual([
      {
        id: "channel-2",
        name: "Стрим",
        sortOrder: 0,
      },
      {
        id: "channel-1",
        name: "Общий",
        sortOrder: 1,
      },
    ]);
  });

  /**
   * Проверяется, что сохранение метаданных сервера обновляет и текущий snapshot,
   * и верхний rail со списком серверов одним и тем же серверным payload.
   * Это важно, потому что название и аватар сервера одновременно видны
   * и в модуле открытого сервера, и в глобальной навигации.
   * Граничные случаи: запрос обязан содержать `serverId`, новое имя и avatarUrl,
   * а оба store должны получить одно и то же итоговое состояние без повторной загрузки.
   */
  test("should update server metadata in both the snapshot and the server rail store", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          updateServer: {
            server: {
              id: "server-1",
              name: "Новый сервер",
              avatarUrl: "https://cdn.example.com/server.png",
              isPublic: false,
              role: "OWNER",
            },
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serversStore = useServersStore();
    serversStore.items = [
      {
        id: "server-1",
        name: "Старый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
    ];

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Старый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [],
    };

    await serverModuleStore.updateServerProfile({
      name: "  Новый сервер  ",
      avatarUrl: "  https://cdn.example.com/server.png  ",
    });

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("updateServer");
    expect(payload.query).toContain('serverId: "server-1"');
    expect(payload.query).toContain('name: "Новый сервер"');
    expect(payload.query).toContain('avatarUrl: "https://cdn.example.com/server.png"');
    expect(serverModuleStore.snapshot?.server).toEqual({
      id: "server-1",
      name: "Новый сервер",
      avatarUrl: "https://cdn.example.com/server.png",
      isPublic: false,
      role: "OWNER",
    });
    expect(serversStore.items).toEqual([
      {
        id: "server-1",
        name: "Новый сервер",
        avatarUrl: "https://cdn.example.com/server.png",
        isPublic: false,
        role: "OWNER",
      },
    ]);
  });

  /**
   * Проверяется, что удаление сервера вызывает серверную мутацию,
   * убирает его из верхнего rail store и сбрасывает текущий snapshot модуля сервера.
   * Это важно, потому что после удаления root-сущности клиент не должен
   * продолжать держать локальные ссылки на уже несуществующий сервер.
   * Граничные случаи: запрос обязан содержать `serverId`,
   * а после успешного ответа selection и snapshot должны быть полностью очищены.
   */
  test("should delete the selected server and clear both local server stores", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          deleteServer: {
            serverId: "server-1",
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serversStore = useServersStore();
    serversStore.items = [
      {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      {
        id: "server-2",
        name: "Резервный сервер",
        avatarUrl: null,
        isPublic: false,
        role: "MEMBER",
      },
    ];

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [],
    };

    await serverModuleStore.deleteSelectedServer();

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("deleteServer");
    expect(payload.query).toContain('serverId: "server-1"');
    expect(serverModuleStore.selectedServerId).toBeNull();
    expect(serverModuleStore.snapshot).toBeNull();
    expect(serversStore.items).toEqual([
      {
        id: "server-2",
        name: "Резервный сервер",
        avatarUrl: null,
        isPublic: false,
        role: "MEMBER",
      },
    ]);
  });

  /**
   * Проверяется, что live-событие обновления сервера меняет текущий snapshot
   * и тот же сервер в верхнем списке серверов без повторного GraphQL-запроса.
   * Это важно, потому что изменение названия или аватара сервером другим клиентом
   * должно сразу синхронизироваться в открытом серверном экране и в navigation rail.
   * Граничные случаи: роль пользователя не должна потеряться, а обновление должно
   * применяться только к уже открытому серверу, не ломая остальные элементы списка.
   */
  test("should apply a live server update to both the snapshot and the server rail", () => {
    const serversStore = useServersStore();
    serversStore.items = [
      {
        id: "server-1",
        name: "Старое имя",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      {
        id: "server-2",
        name: "Другой сервер",
        avatarUrl: null,
        isPublic: false,
        role: "MEMBER",
      },
    ];

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Старое имя",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [],
    };

    serverModuleStore.applyLiveServerUpdated({
      serverId: "server-1",
      name: "Новое имя",
      avatarUrl: "https://cdn.example.com/server.png",
      isPublic: true,
      updatedAt: "2026-03-17T10:00:00.000Z",
    });

    expect(serverModuleStore.snapshot?.server).toEqual({
      id: "server-1",
      name: "Новое имя",
      avatarUrl: "https://cdn.example.com/server.png",
      isPublic: true,
      role: "OWNER",
    });
    expect(serversStore.items).toEqual([
      {
        id: "server-1",
        name: "Новое имя",
        avatarUrl: "https://cdn.example.com/server.png",
        isPublic: true,
        role: "OWNER",
      },
      {
        id: "server-2",
        name: "Другой сервер",
        avatarUrl: null,
        isPublic: false,
        role: "MEMBER",
      },
    ]);
  });

  /**
   * Проверяется, что live-событие обновления каналов заменяет структуру только
   * у действительно открытого сервера и игнорируется для чужого `serverId`.
   * Это важно, потому что один клиент может получать несколько live-событий подряд,
   * и серверный экран не должен случайно перетирать свой snapshot чужими данными.
   * Граничные случаи: сначала приходит событие для другого сервера и ничего не меняет,
   * затем событие для текущего сервера полностью заменяет локальный список каналов.
   */
  test("should apply live channel updates only for the currently opened server", () => {
    const serverModuleStore = useServerModuleStore();
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Основной сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [
        {
          id: "channel-1",
          name: "Общий",
          sortOrder: 0,
        },
      ],
    };

    serverModuleStore.applyLiveChannelsUpdated({
      serverId: "server-2",
      channels: [
        {
          id: "channel-x",
          name: "Чужой",
          sortOrder: 0,
        },
      ],
      updatedAt: "2026-03-17T10:00:00.000Z",
    });

    expect(serverModuleStore.snapshot?.channels).toEqual([
      {
        id: "channel-1",
        name: "Общий",
        sortOrder: 0,
      },
    ]);

    serverModuleStore.applyLiveChannelsUpdated({
      serverId: "server-1",
      channels: [
        {
          id: "channel-2",
          name: "Стрим",
          sortOrder: 0,
        },
        {
          id: "channel-1",
          name: "Общий",
          sortOrder: 1,
        },
      ],
      updatedAt: "2026-03-17T10:01:00.000Z",
    });

    expect(serverModuleStore.snapshot?.channels).toEqual([
      {
        id: "channel-2",
        name: "Стрим",
        sortOrder: 0,
      },
      {
        id: "channel-1",
        name: "Общий",
        sortOrder: 1,
      },
    ]);
  });

  /**
   * Проверяется, что delta-события presence корректно добавляют, перемещают
   * и удаляют участников внутри текущего выбранного сервера.
   * Это важно, потому что live-UI опирается не на полный reload, а на поток
   * `presence.updated`, и store должен уметь детерминированно применять такие изменения.
   * Граничные случаи: сначала пользователь заходит в канал, затем перемещается,
   * а после события `left` должен полностью исчезнуть из локального snapshot-а.
   */
  /**
   * Проверяется, что owner-only moderation snapshot участников грузится отдельным query
   * и сохраняется в store в готовой для модального окна форме.
   * Это важно, потому что секция модерации не должна вытаскивать участников
   * из случайных источников или переиспользовать snapshot канала не по назначению.
   * Граничные случаи: запрос обязан содержать `serverMembers`,
   * а owner и member должны попасть в итоговый список без потери role и avatarUrl.
   */
  test("should load the owner-only server members snapshot", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          serverMembers: {
            serverId: "server-1",
            members: [
              {
                userId: "user-1",
                displayName: "Добрыня",
                avatarUrl: null,
                role: "OWNER",
              },
              {
                userId: "user-2",
                displayName: "Алиса",
                avatarUrl: "https://cdn.example.com/alice.png",
                role: "MEMBER",
              },
            ],
          },
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";

    await serverModuleStore.loadMembers();

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("serverMembers");
    expect(payload.query).toContain('serverId: "server-1"');
    expect(serverModuleStore.members).toEqual([
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        role: "OWNER",
      },
      {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: "https://cdn.example.com/alice.png",
        role: "MEMBER",
      },
    ]);
  });

  /**
   * Проверяется, что moderation-действия owner-а идут через отдельные GraphQL-мутации
   * и локально убирают целевого участника из списка без полной перезагрузки модалки.
   * Это важно, потому что kick/ban являются частыми owner-only действиями,
   * и после успешного ответа список участников должен сразу оставаться консистентным.
   * Граничные случаи: и kick, и ban должны использовать один и тот же выбранный `serverId`,
   * а store обязан удалять именно того пользователя, которого вернула мутация.
   */
  test("should remove the moderated member from the local list after kick and ban", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            kickServerMember: {
              serverId: "server-1",
              userId: "user-2",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            banServerMember: {
              serverId: "server-1",
              userId: "user-3",
            },
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.members = [
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        role: "OWNER",
      },
      {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: null,
        role: "MEMBER",
      },
      {
        userId: "user-3",
        displayName: "Боб",
        avatarUrl: null,
        role: "MEMBER",
      },
    ];

    await serverModuleStore.kickMember("user-2");
    await serverModuleStore.banMember("user-3");

    const kickRequestPayload = JSON.parse(
      String((fetchMock.mock.calls.at(0)?.[1] as RequestInit).body),
    ) as { query: string };
    const banRequestPayload = JSON.parse(
      String((fetchMock.mock.calls.at(1)?.[1] as RequestInit).body),
    ) as { query: string };

    expect(kickRequestPayload.query).toContain("kickServerMember");
    expect(kickRequestPayload.query).toContain('targetUserId: "user-2"');
    expect(banRequestPayload.query).toContain("banServerMember");
    expect(banRequestPayload.query).toContain('targetUserId: "user-3"');
    expect(serverModuleStore.members).toEqual([
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        role: "OWNER",
      },
    ]);
  });

  test("should apply live presence updates as join move and leave deltas", () => {
    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";

    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-17T10:00:00.000Z",
    });

    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: null,
        channelId: "channel-2",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
      previousChannelId: "channel-1",
      action: "moved",
      occurredAt: "2026-03-17T10:01:00.000Z",
    });

    expect(serverModuleStore.presenceMembers).toEqual([
      {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: null,
        channelId: "channel-2",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
    ]);

    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-2",
        displayName: "Алиса",
        avatarUrl: null,
        channelId: "channel-2",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
      previousChannelId: "channel-2",
      action: "left",
      occurredAt: "2026-03-17T10:02:00.000Z",
    });

    expect(serverModuleStore.presenceMembers).toEqual([]);
  });

  /**
   * Проверяется, что store выбирает правильную realtime-команду для канала:
   * первый вход делает `join`, смена канала делает `move`, а повторный клик
   * по текущему каналу может завершиться отдельным `leaveCurrentChannel`.
   * Это важно, потому что именно store решает, какую live-команду отправить,
   * и ошибка здесь сломает весь voice-flow при кликах по списку каналов.
   * Граничные случаи: сначала пользователь не находится в канале,
   * затем уже находится в одном канале и переходит в другой.
   */
  test("should execute join move and leave voice commands from the current presence state", async () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";

    await serverModuleStore.joinOrMoveToChannel("channel-1");

    expect(realtimeMocks.join).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
    });

    serverModuleStore.presenceMembers = [
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
    ];

    await serverModuleStore.joinOrMoveToChannel("channel-2");

    expect(realtimeMocks.move).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
      targetChannelId: "channel-2",
    });

    serverModuleStore.presenceMembers = [
      {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-2",
        joinedAt: "2026-03-17T10:00:00.000Z",
      },
    ];

    await serverModuleStore.leaveCurrentChannel();

    expect(realtimeMocks.leave).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-2",
    });
  });

  /**
   * Проверяется, что store умеет применять live-обновление voice state
   * для текущего пользователя и синхронно отражать его в локальном состоянии модуля.
   * Это важно, потому что mute/deafen теперь становятся server-authoritative,
   * а текущая панель пользователя должна опираться не на локальные toggle-флаги.
   * Граничные случаи: событие для другого пользователя должно игнорироваться,
   * а для текущего пользователя одновременно обновляются оба флага состояния.
   */
  test("should apply live voice state updates only for the current authenticated user", () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();

    serverModuleStore.applyVoiceStateUpdated({
      serverId: "server-1",
      userId: "user-2",
      channelId: "channel-1",
      muted: true,
      deafened: true,
      occurredAt: "2026-03-19T10:00:00.000Z",
    });

    expect(serverModuleStore.currentVoiceState).toEqual({
      muted: false,
      deafened: false,
    });

    serverModuleStore.applyVoiceStateUpdated({
      serverId: "server-1",
      userId: "user-1",
      channelId: "channel-1",
      muted: true,
      deafened: false,
      occurredAt: "2026-03-19T10:01:00.000Z",
    });

    expect(serverModuleStore.currentVoiceState).toEqual({
      muted: true,
      deafened: false,
    });
  });

  /**
   * Проверяется, что store отправляет отдельные realtime-команды
   * для self-mute и self-deafen по активному voice presence пользователя.
   * Это важно, потому что именно store теперь связывает control panel
   * с серверным live-state и media-поведением, а не меняет локальные ref-флаги.
   * Граничные случаи: если пользователь уже находится в канале,
   * обе команды обязаны уходить с тем же `serverId` и `channelId`.
   */
  test("should execute self mute and self deafen commands for the current presence", async () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-19T10:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-19T10:00:00.000Z",
    });

    await serverModuleStore.setSelfMuted(true);
    await serverModuleStore.setSelfDeafened(true);

    expect(realtimeMocks.setSelfMute).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
      muted: true,
    });
    expect(realtimeMocks.setSelfDeafen).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
      deafened: true,
    });
  });

  /**
   * Проверяется, что live-события screen share обновляют runtime state и очищают
   * локальные stream-ы пользователя при остановке демонстрации.
   * Это важно, потому что UI центральной области и control panel опираются
   * именно на server-authoritative screen-share состояние, а не на локальные ref-флаги.
   * Граничные случаи: сначала share включается, затем выключается тем же пользователем,
   * и store должен удалить и состояние, и stream без полного reset модуля.
   */
  test("should apply live screen share updates and clear matching streams on stop", () => {
    const serverModuleStore = useServerModuleStore();
    const localStream = {} as MediaStream;
    const remoteStream = {} as MediaStream;

    serverModuleStore.replaceScreenShareStreams([
      {
        userId: "user-1",
        stream: localStream,
        isCurrentUser: true,
      },
      {
        userId: "user-2",
        stream: remoteStream,
        isCurrentUser: false,
      },
    ]);

    serverModuleStore.applyScreenShareUpdated({
      serverId: "server-1",
      userId: "user-1",
      channelId: "channel-1",
      active: true,
      occurredAt: "2026-03-20T12:00:00.000Z",
    });

    expect(serverModuleStore.currentUserScreenShareState).toBeNull();

    const authStore = useAuthStore();
    authStore.currentUser = testUser;

    expect(serverModuleStore.currentUserScreenShareState).toEqual({
      userId: "user-1",
      serverId: "server-1",
      channelId: "channel-1",
    });

    serverModuleStore.applyScreenShareUpdated({
      serverId: "server-1",
      userId: "user-1",
      channelId: "channel-1",
      active: false,
      occurredAt: "2026-03-20T12:01:00.000Z",
    });

    expect(serverModuleStore.currentUserScreenShareState).toBeNull();
    expect(serverModuleStore.screenShareStreams).toEqual([
      {
        userId: "user-2",
        stream: remoteStream,
        isCurrentUser: false,
      },
    ]);
  });

  /**
   * Проверяется, что store отправляет отдельную realtime-команду для включения
   * демонстрации экрана и локально отражает успешный server-authoritative toggle.
   * Это важно, потому что screen share теперь управляется не напрямую mediasoup-сессией,
   * а через LiveRail-команду с последующей синхронизацией состояния.
   * Граничные случаи: пользователь уже находится в активном канале,
   * поэтому store должен взять serverId/channelId из текущего presence.
   */
  test("should execute the screen share command for the current presence", async () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-20T12:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-20T12:00:00.000Z",
    });

    await serverModuleStore.setScreenShareActive(true);

    expect(realtimeMocks.setScreenShareActive).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
      active: true,
    });
    expect(serverModuleStore.currentUserScreenShareState).toEqual({
      userId: "user-1",
      serverId: "server-1",
      channelId: "channel-1",
    });
  });

  /**
   * Проверяется, что store корректно очищает только экран открытого сервера,
   * если пользователь потерял к нему доступ через moderation или server deletion,
   * но при этом не трогает независимое active voice presence на другом сервере.
   * Это важно, потому что после кика/бана из одного сервера UI должен уйти с его страницы,
   * не ломая голосовую сессию, которая может идти в другом сервере.
   * Граничные случаи: selected server совпадает с потерянным доступом,
   * а active voice presence у пользователя привязан к другому серверу.
   */
  test("should clear only the revoked server page state without dropping another active voice presence", () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.selectedChannelId = "channel-1";
    serverModuleStore.loadedServerId = "server-1";
    serverModuleStore.snapshot = {
      server: {
        id: "server-1",
        name: "Первый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
      channels: [],
    };
    serverModuleStore.inviteLink = {
      serverId: "server-1",
      inviteLink: "https://slovo.example/invite/alpha",
    };
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-2",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-9",
        joinedAt: "2026-03-20T12:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-20T12:00:00.000Z",
    });

    serverModuleStore.handleServerAccessRevoked("server-1");

    expect(serverModuleStore.selectedServerId).toBeNull();
    expect(serverModuleStore.selectedChannelId).toBeNull();
    expect(serverModuleStore.loadedServerId).toBeNull();
    expect(serverModuleStore.snapshot).toBeNull();
    expect(serverModuleStore.inviteLink).toBeNull();
    expect(serverModuleStore.currentUserPresence).toEqual({
      serverId: "server-2",
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: null,
      channelId: "channel-9",
      joinedAt: "2026-03-20T12:00:00.000Z",
    });
  });

  /**
   * Проверяется, что forced disconnect локально снимает пользователя с активного канала,
   * очищает screen-share stream-ы и сохраняет человекочитаемую причину в presence error state.
   * Это важно, потому что target-клиент после кика/бана должен мгновенно перестать видеть себя
   * в канале и получить понятную причину разрыва, не дожидаясь полной перезагрузки страницы.
   * Граничные случаи: у пользователя уже есть active voice presence и локальные stream-ы,
   * поэтому store обязан зачистить оба состояния за один вызов.
   */
  test("should clear local voice state and keep the forced disconnect reason", () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;

    const serverModuleStore = useServerModuleStore();
    const localStream = {} as MediaStream;

    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-20T13:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-20T13:00:00.000Z",
    });
    serverModuleStore.replaceScreenShareStreams([
      {
        userId: "user-1",
        stream: localStream,
        isCurrentUser: true,
      },
    ]);

    serverModuleStore.handleForcedDisconnect({
      serverId: "server-1",
      userId: "user-1",
      reason: "Вы были исключены из сервера.",
      occurredAt: "2026-03-20T13:01:00.000Z",
    });

    expect(serverModuleStore.currentUserPresence).toBeNull();
    expect(serverModuleStore.selectedChannelId).toBeNull();
    expect(serverModuleStore.screenShareStreams).toEqual([]);
    expect(serverModuleStore.presenceErrorMessage).toBe("Вы были исключены из сервера.");
  });

  /**
   * Проверяется, что активное голосовое присутствие не привязано к открытому серверу в URL,
   * а значит пользователь может оставаться в канале одного сервера и переключать страницу
   * на другой сервер без локального disconnect и без потери mute/deafen state.
   * Это важно, потому что выбранный сервер в интерфейсе и активный voice channel
   * теперь являются разными сущностями, и store должен хранить их независимо.
   * Граничные случаи: при переключении на другой сервер selected channel должен очиститься,
   * а при возврате обратно должен восстановиться именно активный voice channel.
   */
  test("should keep the active voice presence independent from the selected server page", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverSnapshot: {
              server: {
                id: "server-1",
                name: "Первый сервер",
                avatarUrl: null,
                isPublic: false,
                role: "OWNER",
              },
              channels: [
                {
                  id: "channel-1",
                  name: "Общий",
                  sortOrder: 0,
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverPresenceSnapshot: {
              members: [],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverSnapshot: {
              server: {
                id: "server-2",
                name: "Второй сервер",
                avatarUrl: null,
                isPublic: false,
                role: "MEMBER",
              },
              channels: [
                {
                  id: "channel-9",
                  name: "Стрим",
                  sortOrder: 0,
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverPresenceSnapshot: {
              members: [],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverSnapshot: {
              server: {
                id: "server-1",
                name: "Первый сервер",
                avatarUrl: null,
                isPublic: false,
                role: "OWNER",
              },
              channels: [
                {
                  id: "channel-1",
                  name: "Общий",
                  sortOrder: 0,
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            serverPresenceSnapshot: {
              members: [],
            },
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();

    await serverModuleStore.openServer("server-1");
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-20T10:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-20T10:00:00.000Z",
    });
    serverModuleStore.applyVoiceStateUpdated({
      serverId: "server-1",
      userId: "user-1",
      channelId: "channel-1",
      muted: true,
      deafened: false,
      occurredAt: "2026-03-20T10:01:00.000Z",
    });

    await serverModuleStore.openServer("server-2");

    expect(serverModuleStore.currentUserPresence).toEqual({
      serverId: "server-1",
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: null,
      channelId: "channel-1",
      joinedAt: "2026-03-20T10:00:00.000Z",
    });
    expect(serverModuleStore.selectedChannelId).toBeNull();
    expect(serverModuleStore.currentVoiceState).toEqual({
      muted: true,
      deafened: false,
    });

    await serverModuleStore.openServer("server-1");

    expect(serverModuleStore.selectedChannelId).toBe("channel-1");
  });

  /**
   * Проверяется, что переход в канал другого сервера не пытается выполнить
   * недопустимую cross-server move-команду, а корректно делает leave на старом сервере
   * и затем join на новом выбранном сервере.
   * Это важно, потому что URL больше не управляет voice lifecycle,
   * и store обязан сам корректно разрулить смену голосового сервера.
   * Граничные случаи: после успешной цепочки локальное активное присутствие
   * должно указывать уже на новый сервер и новый канал.
   */
  test("should leave the previous server before joining a channel on another server", async () => {
    const authStore = useAuthStore();
    authStore.currentUser = testUser;
    authStore.sessionToken = "active-session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const serverModuleStore = useServerModuleStore();
    serverModuleStore.selectedServerId = "server-1";
    serverModuleStore.applyPresenceUpdated({
      serverId: "server-1",
      member: {
        userId: "user-1",
        displayName: "Добрыня",
        avatarUrl: null,
        channelId: "channel-1",
        joinedAt: "2026-03-20T10:00:00.000Z",
      },
      previousChannelId: null,
      action: "joined",
      occurredAt: "2026-03-20T10:00:00.000Z",
    });

    serverModuleStore.selectedServerId = "server-2";

    await serverModuleStore.joinOrMoveToChannel("channel-9");

    expect(realtimeMocks.leave).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-1",
      channelId: "channel-1",
    });
    expect(realtimeMocks.join).toHaveBeenCalledWith({
      sessionToken: "active-session-token",
      serverId: "server-2",
      channelId: "channel-9",
    });
    expect(serverModuleStore.currentUserPresence).toEqual({
      serverId: "server-2",
      userId: "user-1",
      displayName: "Добрыня",
      avatarUrl: null,
      channelId: "channel-9",
      joinedAt: expect.any(String),
    });
  });
});

/**
 * Создает минимальный GraphQL Response-объект для клиентских тестов модуля сервера.
 */
function createGraphqlResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
