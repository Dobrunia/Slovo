import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import { useServersStore } from "../src/stores/servers";
import type { ClientUser } from "../src/types/auth";
import type { ClientServerListItem } from "../src/types/server";

const authenticatedUser: ClientUser = {
  id: "user-1",
  email: "user@example.com",
  username: "dobrunia",
  displayName: "Добрыня",
  avatarUrl: null,
};

const testServers: ClientServerListItem[] = [
  {
    id: "server-2",
    name: "Beta",
    avatarUrl: "https://example.com/beta.png",
    isPublic: true,
    role: "MEMBER",
  },
  {
    id: "server-1",
    name: "Alpha",
    avatarUrl: null,
    isPublic: false,
    role: "OWNER",
  },
];

describe("servers store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  /**
   * Проверяется, что Pinia store списка серверов умеет загрузить private initial load
   * для текущего пользователя и положить его в реактивное состояние без лишних преобразований.
   * Это важно, потому что именно этот store будет питать основную навигацию приложения после логина,
   * и если здесь потеряется session token или payload, пользователь увидит пустой интерфейс.
   * Граничные случаи: запрос должен идти на стандартный GraphQL endpoint с auth headers,
   * а store обязан перейти в loaded-state и сохранить полученные серверы в исходном порядке ответа.
   */
  test("should load the current user's servers into the store", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          myServers: testServers,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const authStore = useAuthStore();
    authStore.currentUser = authenticatedUser;
    authStore.sessionToken = "session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const store = useServersStore();

    await store.loadServers();

    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_CLIENT_GRAPHQL_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer session-token",
        }),
      }),
    );
    expect(store.items).toEqual(testServers);
    expect(store.isLoaded).toBe(true);
    expect(store.errorMessage).toBeNull();
  });

  /**
   * Проверяется, что store корректно обнуляет список и записывает сообщение об ошибке,
   * если GraphQL-загрузка серверов не удалась.
   * Это важно, потому что при сбое initial load пользователь не должен видеть устаревшие данные,
   * а UI обязан получить явный error-state вместо тихого зависания в прежнем списке.
   * Граничные случаи: store должен очистить уже существующие элементы,
   * завершить loading-state и сохранить текст ошибки из GraphQL response.
   */
  test("should clear stale servers and expose an error when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        createGraphqlResponse({
          errors: [{ message: "SERVERS_LOAD_FAILED" }],
        }),
      ),
    );

    const authStore = useAuthStore();
    authStore.currentUser = authenticatedUser;
    authStore.sessionToken = "session-token";
    authStore.status = "authenticated";
    authStore.isInitialized = true;

    const store = useServersStore();
    store.items = [...testServers];

    await expect(store.loadServers()).rejects.toThrow("SERVERS_LOAD_FAILED");

    expect(store.items).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.isLoaded).toBe(true);
    expect(store.errorMessage).toBe("SERVERS_LOAD_FAILED");
  });
});

/**
 * Создает минимальный GraphQL Response-объект для клиентских тестов списка серверов.
 */
function createGraphqlResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
