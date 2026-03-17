import { ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServersApiClient } from "../graphql/servers";
import { useAuthStore } from "./auth";
import type {
  ClientCreateServerInput,
  ClientServerListItem,
} from "../types/server";

/**
 * Pinia store списка серверов текущего пользователя.
 */
export const useServersStore = defineStore("servers", () => {
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isLoaded = ref(false);
  const errorMessage = ref<string | null>(null);
  const createErrorMessage = ref<string | null>(null);
  const loadedForSessionToken = ref<string | null>(null);
  const items = ref<ClientServerListItem[]>([]);

  const serversApiClient = createServersApiClient({
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
  });

  /**
   * Загружает список серверов текущего пользователя по активной auth-сессии.
   */
  async function loadServers(): Promise<void> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;

    if (!sessionToken) {
      reset();
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;

    try {
      items.value = await serversApiClient.myServers(sessionToken);
      loadedForSessionToken.value = sessionToken;
      isLoaded.value = true;
    } catch (error) {
      items.value = [];
      errorMessage.value = toLoadServersErrorMessage(error);
      loadedForSessionToken.value = null;
      isLoaded.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Создает новый сервер для текущего пользователя и сразу обновляет локальный список.
   */
  async function createServer(input: ClientCreateServerInput): Promise<ClientServerListItem> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;

    if (!sessionToken) {
      const error = new Error("Нужна активная сессия для создания сервера.");
      createErrorMessage.value = error.message;
      throw error;
    }

    isCreating.value = true;
    createErrorMessage.value = null;

    try {
      const normalizedName = input.name.trim();
      const result = await serversApiClient.createServer(sessionToken, {
        name: normalizedName,
      });

      upsertServer(result.server);
      loadedForSessionToken.value = sessionToken;
      isLoaded.value = true;

      return result.server;
    } catch (error) {
      createErrorMessage.value = toCreateServerErrorMessage(error);
      throw error;
    } finally {
      isCreating.value = false;
    }
  }

  /**
   * Добавляет сервер в локальный список или обновляет уже существующий элемент без дубликатов.
   */
  function upsertServer(server: ClientServerListItem): void {
    const nextItems = items.value.filter((item) => item.id !== server.id);
    items.value = [server, ...nextItems];
  }

  /**
   * Очищает временную ошибку формы создания сервера.
   */
  function clearCreateError(): void {
    createErrorMessage.value = null;
  }

  /**
   * Сбрасывает клиентское состояние списка серверов.
   */
  function reset(): void {
    isLoading.value = false;
    isCreating.value = false;
    isLoaded.value = false;
    errorMessage.value = null;
    createErrorMessage.value = null;
    loadedForSessionToken.value = null;
    items.value = [];
  }

  return {
    isLoading,
    isCreating,
    isLoaded,
    errorMessage,
    createErrorMessage,
    loadedForSessionToken,
    items,
    loadServers,
    createServer,
    clearCreateError,
    reset,
  };
});

/**
 * Возвращает безопасное пользовательское сообщение для загрузки списка серверов.
 */
function toLoadServersErrorMessage(error: unknown): string {
  if (error instanceof Error && isKnownLoadServersErrorMessage(error.message)) {
    return error.message;
  }

  return "Не удалось загрузить список серверов.";
}

/**
 * Определяет, можно ли безопасно показать текст ошибки пользователю без утечки внутренних деталей.
 */
function isKnownLoadServersErrorMessage(message: string): boolean {
  return message === "Требуется авторизация.";
}

/**
 * Приводит неизвестную ошибку создания сервера к читаемому сообщению.
 */
function toCreateServerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось создать сервер.";
}
