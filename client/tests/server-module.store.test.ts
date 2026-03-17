import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import { useServerModuleStore } from "../src/stores/serverModule";
import { useServersStore } from "../src/stores/servers";
import type { ClientUser } from "../src/types/auth";

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
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
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
    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_CLIENT_GRAPHQL_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer active-session-token",
        }),
      }),
    );

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("serverSnapshot");
    expect(payload.query).toContain('serverId: "server-1"');
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
