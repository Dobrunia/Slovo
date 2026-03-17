import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const updateDisplayNameMock = vi.fn();
const updateAvatarMock = vi.fn();

vi.mock("../src/graphql/auth", () => ({
  createAuthApiClient: () => ({
    register: vi.fn(),
    login: vi.fn(),
    me: vi.fn(),
  }),
}));

vi.mock("../src/graphql/profile", () => ({
  createProfileApiClient: () => ({
    updateDisplayName: updateDisplayNameMock,
    updateAvatar: updateAvatarMock,
  }),
}));

import { useAuthStore } from "../src/stores/auth";

describe("auth profile store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    updateDisplayNameMock.mockReset();
    updateAvatarMock.mockReset();
    window.localStorage.clear();
  });

  it("should update current user after sequential profile mutations", async () => {
    /*
     * Проверяется, что store сохраняет профиль через две отдельные GraphQL-мутации
     * и после обеих операций оставляет в currentUser итоговое актуальное состояние.
     * Это важно, потому что display name и avatar обновляются раздельно, и клиент
     * не должен потерять промежуточные изменения или откатить пользователя к старым данным.
     */
    const store = useAuthStore();

    store.sessionToken = "session-token";
    store.currentUser = {
      id: "user-1",
      email: "user@example.com",
      username: "slovo-user",
      displayName: "Старое имя",
      avatarUrl: "https://cdn.example.com/old.png",
    };

    updateDisplayNameMock.mockResolvedValue({
      user: {
        ...store.currentUser,
        displayName: "Новое имя",
      },
    });

    updateAvatarMock.mockResolvedValue({
      user: {
        ...store.currentUser,
        displayName: "Новое имя",
        avatarUrl: null,
      },
    });

    const result = await store.updateProfile({
      displayName: "  Новое имя  ",
      avatarUrl: "   ",
    });

    expect(updateDisplayNameMock).toHaveBeenCalledWith("session-token", {
      displayName: "Новое имя",
    });
    expect(updateAvatarMock).toHaveBeenCalledWith("session-token", {
      avatarUrl: null,
    });
    expect(result).toEqual({
      id: "user-1",
      email: "user@example.com",
      username: "slovo-user",
      displayName: "Новое имя",
      avatarUrl: null,
    });
    expect(store.currentUser).toEqual(result);
    expect(store.profileErrorMessage).toBeNull();
  });

  it("should skip profile mutations when normalized values are unchanged", async () => {
    /*
     * Проверяется, что store не отправляет лишние запросы, если пользователь
     * фактически не изменил display name и avatar после trim и нормализации пустого значения.
     * Это важно для предотвращения лишних live-уведомлений и ненужных сетевых запросов.
     */
    const store = useAuthStore();

    store.sessionToken = "session-token";
    store.currentUser = {
      id: "user-1",
      email: "user@example.com",
      username: "slovo-user",
      displayName: "Текущее имя",
      avatarUrl: null,
    };

    const result = await store.updateProfile({
      displayName: "  Текущее имя  ",
      avatarUrl: "   ",
    });

    expect(updateDisplayNameMock).not.toHaveBeenCalled();
    expect(updateAvatarMock).not.toHaveBeenCalled();
    expect(result).toEqual(store.currentUser);
  });
});
