import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { AUTH_SESSION_STORAGE_KEY, DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createAuthApiClient } from "../graphql/auth";
import { createProfileApiClient } from "../graphql/profile";
import type {
  AuthSessionResult,
  AuthStatus,
  ClientUser,
  LoginInput,
  RegisterInput,
  RegisterResult,
} from "../types/auth";
import type { ClientProfileUpdateInput } from "../types/profile";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Pinia store авторизации клиента.
 */
export const useAuthStore = defineStore("auth", () => {
  const status = ref<AuthStatus>("idle");
  const isInitialized = ref(false);
  const isSubmitting = ref(false);
  const isProfileUpdating = ref(false);
  const currentUser = ref<ClientUser | null>(null);
  const sessionToken = ref<string | null>(readStoredSessionToken(getStorage()));
  const errorMessage = ref<string | null>(null);
  const profileErrorMessage = ref<string | null>(null);

  const authApiClient = createAuthApiClient({
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
  });
  const profileApiClient = createProfileApiClient({
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
  });

  const isAuthenticated = computed(() => Boolean(currentUser.value && sessionToken.value));

  /**
   * Инициализирует auth-состояние клиента из session token и запроса `me`.
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value || status.value === "initializing") {
      return;
    }

    const storage = getStorage();
    const storedSessionToken = sessionToken.value ?? readStoredSessionToken(storage);

    if (!storedSessionToken) {
      status.value = "anonymous";
      isInitialized.value = true;
      return;
    }

    status.value = "initializing";
    errorMessage.value = null;

    try {
      const user = await authApiClient.me(storedSessionToken);
      applyAuthenticatedState({
        sessionToken: storedSessionToken,
        user,
      });
    } catch (error) {
      clearAuthenticatedState();
      errorMessage.value = toErrorMessage(error);
      status.value = "anonymous";
      isInitialized.value = true;
    }
  }

  /**
   * Регистрирует нового пользователя и сразу создает авторизованную сессию.
   */
  async function register(input: RegisterInput): Promise<RegisterResult> {
    isSubmitting.value = true;
    errorMessage.value = null;

    try {
      const normalizedEmail = input.email.trim().toLowerCase();
      const result = await authApiClient.register({
        email: normalizedEmail,
        username: input.username.trim(),
        displayName: input.displayName.trim(),
        password: input.password,
      });

      const authSession = await authApiClient.login({
        email: normalizedEmail,
        password: input.password,
      });

      applyAuthenticatedState(authSession);
      return result;
    } catch (error) {
      clearAuthenticatedState();
      errorMessage.value = toErrorMessage(error);
      status.value = "anonymous";
      isInitialized.value = true;
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Выполняет логин пользователя и сохраняет auth session token.
   */
  async function login(input: LoginInput): Promise<AuthSessionResult> {
    isSubmitting.value = true;
    errorMessage.value = null;

    try {
      const result = await authApiClient.login({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      });

      applyAuthenticatedState(result);
      return result;
    } catch (error) {
      clearAuthenticatedState();
      errorMessage.value = toErrorMessage(error);
      status.value = "anonymous";
      isInitialized.value = true;
      throw error;
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Завершает пользовательскую сессию на клиенте.
   */
  function logout(): void {
    clearAuthenticatedState();
    errorMessage.value = null;
    profileErrorMessage.value = null;
    status.value = "anonymous";
    isInitialized.value = true;
  }

  /**
   * Обновляет display name и avatar текущего пользователя через GraphQL.
   */
  async function updateProfile(input: ClientProfileUpdateInput): Promise<ClientUser> {
    if (!sessionToken.value || !currentUser.value) {
      const error = new Error("Нужна активная сессия для изменения профиля.");
      profileErrorMessage.value = error.message;
      throw error;
    }

    isProfileUpdating.value = true;
    profileErrorMessage.value = null;

    try {
      let nextUser = currentUser.value;
      const normalizedDisplayName = input.displayName.trim();
      const normalizedAvatarUrl = normalizeAvatarUrl(input.avatarUrl);

      if (normalizedDisplayName !== nextUser.displayName) {
        const result = await profileApiClient.updateDisplayName(sessionToken.value, {
          displayName: normalizedDisplayName,
        });
        nextUser = result.user;
      }

      if (normalizedAvatarUrl !== (nextUser.avatarUrl ?? null)) {
        const result = await profileApiClient.updateAvatar(sessionToken.value, {
          avatarUrl: normalizedAvatarUrl,
        });
        nextUser = result.user;
      }

      currentUser.value = nextUser;
      return nextUser;
    } catch (error) {
      profileErrorMessage.value = toProfileErrorMessage(error);
      throw error;
    } finally {
      isProfileUpdating.value = false;
    }
  }

  /**
   * Очищает ошибку формы редактирования профиля.
   */
  function clearProfileError(): void {
    profileErrorMessage.value = null;
  }

  /**
   * Применяет авторизованное состояние клиента.
   */
  function applyAuthenticatedState(result: AuthSessionResult): void {
    const storage = getStorage();
    currentUser.value = result.user;
    sessionToken.value = result.sessionToken;
    errorMessage.value = null;
    status.value = "authenticated";
    isInitialized.value = true;
    persistSessionToken(storage, result.sessionToken);
  }

  /**
   * Очищает авторизованное состояние клиента.
   */
  function clearAuthenticatedState(): void {
    const storage = getStorage();
    currentUser.value = null;
    sessionToken.value = null;
    removeSessionToken(storage);
  }

  return {
    status,
    isInitialized,
    isSubmitting,
    isProfileUpdating,
    currentUser,
    sessionToken,
    errorMessage,
    profileErrorMessage,
    isAuthenticated,
    initialize,
    register,
    login,
    logout,
    updateProfile,
    clearProfileError,
  };
});

/**
 * Возвращает браузерное хранилище, если оно доступно.
 */
function getStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

/**
 * Читает ранее сохраненный session token из localStorage.
 */
function readStoredSessionToken(storage: StorageLike | null): string | null {
  return storage?.getItem(AUTH_SESSION_STORAGE_KEY) ?? null;
}

/**
 * Сохраняет session token в localStorage.
 */
function persistSessionToken(storage: StorageLike | null, value: string): void {
  storage?.setItem(AUTH_SESSION_STORAGE_KEY, value);
}

/**
 * Удаляет session token из localStorage.
 */
function removeSessionToken(storage: StorageLike | null): void {
  storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
}

/**
 * Приводит неизвестную ошибку к читаемому сообщению.
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось выполнить запрос.";
}

/**
 * Нормализует значение аватара из пользовательского ввода.
 */
function normalizeAvatarUrl(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

/**
 * Приводит неизвестную ошибку изменения профиля к читаемому сообщению.
 */
function toProfileErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось сохранить изменения профиля.";
}
