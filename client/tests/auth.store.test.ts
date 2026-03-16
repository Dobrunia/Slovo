import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { AUTH_SESSION_STORAGE_KEY, DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";
import { useAuthStore } from "../src/stores/auth";
import type { ClientUser } from "../src/types/auth";

const testUser: ClientUser = {
  id: "user-1",
  email: "user@example.com",
  username: "dobrunia",
  displayName: "Добрыня",
  avatarUrl: null,
};

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * Проверяется, что Pinia auth-store умеет поднять сессию из localStorage,
   * сходить в GraphQL `me` и перевести приложение в authenticated-state без повторного логина.
   * Это важно, потому что app shell и защищенные маршруты должны переживать перезагрузку страницы
   * и восстанавливать текущего пользователя из уже сохраненного session token.
   * Граничные случаи: токен читается из стандартного storage key, а fetch должен уйти
   * на стандартный GraphQL endpoint с Authorization Bearer header.
   */
  test("should restore the authenticated session from storage during initialization", async () => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, "stored-session-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createGraphqlResponse({
        data: {
          me: testUser,
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const store = useAuthStore();

    await store.initialize();

    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_CLIENT_GRAPHQL_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer stored-session-token",
        }),
      }),
    );
    expect(store.status).toBe("authenticated");
    expect(store.currentUser).toEqual(testUser);
    expect(store.sessionToken).toBe("stored-session-token");
  });

  /**
   * Проверяется, что Pinia auth-store очищает протухший session token,
   * если запрос `me` не смог подтвердить сессию после инициализации.
   * Это важно, потому что иначе клиент может зависнуть на невалидной авторизации,
   * а router и UI будут считать пользователя вошедшим, хотя сервер уже отвергает токен.
   * Граничные случаи: токен должен удалиться и из localStorage, и из reactive state,
   * а итоговый статус обязан перейти в `anonymous`.
   */
  test("should clear a stale stored session token when me fails", async () => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, "stale-session-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        createGraphqlResponse({
          errors: [{ message: "AUTH_DENIED" }],
        }),
      ),
    );

    const store = useAuthStore();

    await store.initialize();

    expect(store.status).toBe("anonymous");
    expect(store.currentUser).toBeNull();
    expect(store.sessionToken).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  /**
   * Проверяется, что успешный login сохраняет новый session token,
   * обновляет текущего пользователя и позволяет затем явно выйти через logout.
   * Это важно, потому что login/logout являются основными переходами auth state,
   * на которых строятся guest/private маршруты и состояние app shell.
   * Граничные случаи: токен должен сохраниться в localStorage сразу после логина,
   * а logout обязан синхронно очистить и storage, и reactive state без дополнительных запросов.
   */
  test("should persist login data and clear it again on logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        createGraphqlResponse({
          data: {
            login: {
              sessionToken: "fresh-session-token",
              user: testUser,
            },
          },
        }),
      ),
    );

    const store = useAuthStore();

    await store.login({
      email: "user@example.com",
      password: "super-secret-password",
    });

    expect(store.status).toBe("authenticated");
    expect(store.currentUser).toEqual(testUser);
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBe("fresh-session-token");

    store.logout();

    expect(store.status).toBe("anonymous");
    expect(store.currentUser).toBeNull();
    expect(store.sessionToken).toBeNull();
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  /**
   * Проверяется, что после успешной регистрации клиент сразу выполняет логин,
   * получает session token и переводит пользователя в authenticated-state без отдельного шага входа.
   * Это важно, потому что иначе пользователь проходит лишний экран после уже успешного создания аккаунта,
   * хотя серверный auth-flow позволяет немедленно открыть защищенную часть приложения.
   * Граничные случаи: должны уйти два запроса подряд, второй запрос обязан использовать
   * нормализованный email, а session token должен сохраниться и в store, и в localStorage.
   */
  test("should log in the user immediately after successful registration", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            register: {
              user: testUser,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createGraphqlResponse({
          data: {
            login: {
              sessionToken: "fresh-session-token",
              user: testUser,
            },
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const store = useAuthStore();

    await store.register({
      email: " USER@example.com ",
      username: " dobrunia ",
      displayName: " Добрыня ",
      password: "super-secret-password",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.status).toBe("authenticated");
    expect(store.currentUser).toEqual(testUser);
    expect(store.sessionToken).toBe("fresh-session-token");
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBe("fresh-session-token");

    const loginCall = fetchMock.mock.calls.at(1) as [RequestInfo | URL, RequestInit?] | undefined;
    const loginPayload = JSON.parse(String(loginCall?.[1]?.body)) as {
      query: string;
    };

    expect(loginPayload.query).toContain('email: "user@example.com"');
  });
});

/**
 * Создает минимальный GraphQL Response-объект для клиентских auth-store тестов.
 */
function createGraphqlResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
