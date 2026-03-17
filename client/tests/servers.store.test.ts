import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const myServersMock = vi.fn();
const createServerMock = vi.fn();

vi.mock("../src/graphql/servers", () => ({
  createServersApiClient: () => ({
    myServers: myServersMock,
    createServer: createServerMock,
  }),
}));

describe("servers store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    myServersMock.mockReset();
    createServerMock.mockReset();
    window.localStorage.clear();
  });

  it("should load the current user server list into the store", async () => {
    /**
     * Проверяется, что store корректно загружает список серверов
     * для активной пользовательской сессии и сохраняет его в локальном состоянии.
     * Это важно, потому что верхний rail серверов полностью зависит от этого состояния
     * и не должен показывать пустой список при успешном ответе backend.
     * Граничные случаи: до загрузки store пустой, после загрузки помечается как загруженный.
     */
    const testServers = [
      {
        id: "server-1",
        name: "Alpha",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER" as const,
      },
      {
        id: "server-2",
        name: "Beta",
        avatarUrl: "https://example.com/beta.png",
        isPublic: true,
        role: "MEMBER" as const,
      },
    ];

    myServersMock.mockResolvedValueOnce(testServers);

    const [{ useAuthStore }, { useServersStore }] = await Promise.all([
      import("../src/stores/auth"),
      import("../src/stores/servers"),
    ]);

    const authStore = useAuthStore();
    authStore.sessionToken = "session-token";

    const store = useServersStore();

    await expect(store.loadServers()).resolves.toBeUndefined();

    expect(myServersMock).toHaveBeenCalledWith("session-token");
    expect(store.items).toEqual(testServers);
    expect(store.errorMessage).toBeNull();
    expect(store.isLoaded).toBe(true);
    expect(store.loadedForSessionToken).toBe("session-token");
  });

  it("should clear stale servers and expose a safe generic message when loading fails", async () => {
    /**
     * Проверяется, что store очищает устаревший список серверов
     * и не показывает пользователю сырую техническую ошибку backend при неудачной загрузке.
     * Это важно, потому что ошибки уровня Prisma, SQL или схемы БД не должны попадать в интерфейс
     * и не должны оставлять на экране старые данные, которые уже нельзя считать актуальными.
     * Граничные случаи: до ошибки в store уже лежат серверы, а backend возвращает подробный внутренний текст.
     */
    myServersMock.mockRejectedValueOnce(
      new Error("The column `slovo.Server.inviteToken` does not exist in the current database."),
    );

    const [{ useAuthStore }, { useServersStore }] = await Promise.all([
      import("../src/stores/auth"),
      import("../src/stores/servers"),
    ]);

    const authStore = useAuthStore();
    authStore.sessionToken = "session-token";

    const store = useServersStore();
    store.items = [
      {
        id: "stale-server",
        name: "Old data",
        avatarUrl: null,
        isPublic: false,
        role: "OWNER",
      },
    ];

    await expect(store.loadServers()).resolves.toBeUndefined();

    expect(store.items).toEqual([]);
    expect(store.errorMessage).toBe("Не удалось загрузить список серверов.");
    expect(store.isLoaded).toBe(true);
    expect(store.loadedForSessionToken).toBeNull();
  });
});
