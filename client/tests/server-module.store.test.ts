import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import { useServerModuleStore } from "../src/stores/serverModule";
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
