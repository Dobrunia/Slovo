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

describe("servers create flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  /**
   * Проверяется, что создание сервера уходит в GraphQL с активным session token,
   * а затем новый сервер сразу появляется в Pinia store без ручной перезагрузки страницы.
   * Это важно, потому что кнопка создания сервера должна мгновенно обновлять верхний rail,
   * иначе пользователь не увидит результат своего действия и подумает, что запрос не сработал.
   * Граничные случаи: запрос обязан содержать Authorization header и inline-поле name,
   * а локальный список не должен оставаться пустым после успешного ответа сервера.
   */
  test("should create a server through GraphQL and append it to the local store immediately", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          createServer: {
            server: {
              id: "server-1",
              name: "Новый сервер",
              avatarUrl: null,
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

    const createdServer = await serversStore.createServer({
      name: "  Новый сервер  ",
    });

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

    expect(payload.query).toContain("createServer");
    expect(payload.query).toContain('name: "Новый сервер"');
    expect(createdServer.id).toBe("server-1");
    expect(serversStore.items).toEqual([
      {
        id: "server-1",
        name: "Новый сервер",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
    ]);
  });

  /**
   * Проверяется, что store не пытается создавать сервер без активной auth-сессии
   * и сразу возвращает понятную ошибку пользователю.
   * Это важно, потому что createServer является приватной операцией и должен жестко
   * зависеть от session token, а не уходить в пустой или заведомо битый GraphQL-запрос.
   * Граничные случаи: fetch вообще не должен вызываться, а текст ошибки должен сохраниться
   * в отдельном состоянии createErrorMessage для отображения в модальном окне.
   */
  test("should reject server creation when there is no active session token", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const serversStore = useServersStore();

    await expect(
      serversStore.createServer({
        name: "Новый сервер",
      }),
    ).rejects.toThrow("Нужна активная сессия для создания сервера.");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(serversStore.createErrorMessage).toBe("Нужна активная сессия для создания сервера.");
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
