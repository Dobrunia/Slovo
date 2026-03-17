import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import { useServersStore } from "../src/stores/servers";
import type { ClientUser } from "../src/types/auth";

const testUser: ClientUser = {
  id: "user-1",
  email: "user@example.com",
  username: "dobrunia",
  displayName: "Добрыня",
  avatarUrl: null,
};

describe("servers discovery flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  /**
   * Проверяется, что store умеет загружать рекомендации discovery-модалки
   * через тот же GraphQL-query поиска публичных серверов, но с пустой строкой.
   * Это важно, потому что пользователь должен видеть два популярных сервера
   * сразу при открытии модалки, даже без ручного ввода поискового запроса.
   * Граничные случаи: пустой query должен дойти до backend как `""`,
   * а already joined серверы должны быть отфильтрованы по id.
   */
  test("should load recommended public servers for an empty discovery query", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          searchPublicServers: [
            {
              id: "server-existing",
              name: "Уже мой",
              avatarUrl: null,
              isPublic: true,
            },
            {
              id: "server-top-1",
              name: "Популярный 1",
              avatarUrl: null,
              isPublic: true,
            },
            {
              id: "server-top-2",
              name: "Популярный 2",
              avatarUrl: "https://example.com/top-2.png",
              isPublic: true,
            },
          ],
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
        id: "server-existing",
        name: "Уже мой",
        avatarUrl: null,
        isPublic: true,
        role: "MEMBER",
      },
    ];

    const results = await serversStore.loadRecommendedServers();

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain('query: ""');
    expect(results).toEqual([
      {
        id: "server-top-1",
        name: "Популярный 1",
        avatarUrl: null,
        isPublic: true,
      },
      {
        id: "server-top-2",
        name: "Популярный 2",
        avatarUrl: "https://example.com/top-2.png",
        isPublic: true,
      },
    ]);
    expect(serversStore.recommendedItems).toEqual(results);
  });

  /**
   * Проверяется, что поиск публичных серверов уходит в GraphQL с активной сессией,
   * а store оставляет в discovery-результатах только те серверы, в которых пользователь
   * еще не состоит.
   * Это важно, потому что discovery-модалка не должна предлагать вступить повторно
   * в уже присоединенный сервер, даже если backend вернул его в общий список поиска.
   * Граничные случаи: поисковая строка должна нормализоваться trim-ом,
   * а локальный уже присоединенный сервер должен быть отфильтрован по id.
   */
  test("should search public servers and keep only not-yet-joined results in the discovery list", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          searchPublicServers: [
            {
              id: "server-existing",
              name: "Уже мой",
              avatarUrl: null,
              isPublic: true,
            },
            {
              id: "server-new",
              name: "Новый публичный",
              avatarUrl: "https://example.com/server.png",
              isPublic: true,
            },
          ],
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
        id: "server-existing",
        name: "Уже мой",
        avatarUrl: null,
        isPublic: true,
        role: "MEMBER",
      },
    ];

    const results = await serversStore.searchPublicServers("  новый  ");

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

    expect(payload.query).toContain("searchPublicServers");
    expect(payload.query).toContain('query: "новый"');
    expect(results).toEqual([
      {
        id: "server-new",
        name: "Новый публичный",
        avatarUrl: "https://example.com/server.png",
        isPublic: true,
      },
    ]);
    expect(serversStore.searchResults).toEqual(results);
  });

  /**
   * Проверяется, что вступление по invite token отправляет корректную GraphQL-мутацию
   * и сразу обновляет локальный список серверов без повторной загрузки всего rail.
   * Это важно, потому что invite-flow должен мгновенно отражаться в интерфейсе,
   * иначе пользователь не увидит результат перехода по ссылке приглашения.
   * Граничные случаи: мутация обязана использовать именно inviteToken,
   * а новый сервер должен оказаться в начале локального списка.
   */
  test("should join a server by invite token and prepend it to the local server list", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          joinServer: {
            server: {
              id: "server-joined",
              name: "Новый сервер",
              avatarUrl: null,
              isPublic: false,
              role: "MEMBER",
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
        id: "server-old",
        name: "Старый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
    ];

    const joinedServer = await serversStore.joinServer({
      inviteToken: "invite-token-123",
    });

    const requestInit = fetchMock.mock.calls.at(0)?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("joinServer");
    expect(payload.query).toContain('inviteToken: "invite-token-123"');
    expect(joinedServer).toEqual({
      id: "server-joined",
      name: "Новый сервер",
      avatarUrl: null,
      isPublic: false,
      role: "MEMBER",
    });
    expect(serversStore.items).toEqual([
      {
        id: "server-joined",
        name: "Новый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "MEMBER",
      },
      {
        id: "server-old",
        name: "Старый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
    ]);
  });
});

/**
 * Создает минимальный GraphQL Response-объект для клиентских discovery/join тестов.
 */
function createGraphqlResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
