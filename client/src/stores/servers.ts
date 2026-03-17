import { ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServersApiClient } from "../graphql/servers";
import { useAuthStore } from "./auth";
import type {
  ClientCreateServerInput,
  ClientJoinServerInput,
  ClientPublicServerDiscoveryItem,
  ClientServerListItem,
} from "../types/server";

/**
 * Pinia store списка серверов текущего пользователя.
 */
export const useServersStore = defineStore("servers", () => {
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isSearching = ref(false);
  const isJoining = ref(false);
  const isLoaded = ref(false);
  const errorMessage = ref<string | null>(null);
  const createErrorMessage = ref<string | null>(null);
  const searchErrorMessage = ref<string | null>(null);
  const joinErrorMessage = ref<string | null>(null);
  const loadedForSessionToken = ref<string | null>(null);
  const items = ref<ClientServerListItem[]>([]);
  const searchResults = ref<ClientPublicServerDiscoveryItem[]>([]);
  const recommendedItems = ref<ClientPublicServerDiscoveryItem[]>([]);

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
   * Ищет публичные серверы для discovery flow и исключает уже присоединенные серверы.
   */
  async function searchPublicServers(query: string): Promise<ClientPublicServerDiscoveryItem[]> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      searchResults.value = [];
      searchErrorMessage.value = null;
      return [];
    }

    if (!sessionToken) {
      const error = new Error("Нужна активная сессия для поиска серверов.");
      searchErrorMessage.value = error.message;
      throw error;
    }

    isSearching.value = true;
    searchErrorMessage.value = null;

    try {
      const results = await serversApiClient.searchPublicServers(sessionToken, normalizedQuery);
      const joinedServerIds = new Set(items.value.map((item) => item.id));
      const filteredResults = results.filter((server) => !joinedServerIds.has(server.id));
      searchResults.value = filteredResults;
      return filteredResults;
    } catch (error) {
      searchResults.value = [];
      searchErrorMessage.value = toSearchServersErrorMessage(error);
      throw error;
    } finally {
      isSearching.value = false;
    }
  }

  /**
   * Загружает две рекомендованные публичные сервера для discovery-модалки.
   */
  async function loadRecommendedServers(): Promise<ClientPublicServerDiscoveryItem[]> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;

    if (!sessionToken) {
      const error = new Error("Нужна активная сессия для поиска серверов.");
      searchErrorMessage.value = error.message;
      throw error;
    }

    isSearching.value = true;
    searchErrorMessage.value = null;

    try {
      const results = await serversApiClient.searchPublicServers(sessionToken, "");
      const joinedServerIds = new Set(items.value.map((item) => item.id));
      const filteredResults = results.filter((server) => !joinedServerIds.has(server.id));
      recommendedItems.value = filteredResults.slice(0, 2);
      return recommendedItems.value;
    } catch (error) {
      recommendedItems.value = [];
      searchErrorMessage.value = toSearchServersErrorMessage(error);
      throw error;
    } finally {
      isSearching.value = false;
    }
  }

  /**
   * Выполняет вступление пользователя в сервер по `serverId` или `inviteToken`.
   */
  async function joinServer(input: ClientJoinServerInput): Promise<ClientServerListItem> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;

    if (!sessionToken) {
      const error = new Error("Нужна активная сессия для вступления в сервер.");
      joinErrorMessage.value = error.message;
      throw error;
    }

    isJoining.value = true;
    joinErrorMessage.value = null;

    try {
      const result = await serversApiClient.joinServer(sessionToken, input);
      upsertServer(result.server);
      searchResults.value = searchResults.value.filter((item) => item.id !== result.server.id);
      loadedForSessionToken.value = sessionToken;
      isLoaded.value = true;
      return result.server;
    } catch (error) {
      joinErrorMessage.value = toJoinServerErrorMessage(error);
      throw error;
    } finally {
      isJoining.value = false;
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
   * Синхронизирует локальный список серверов с уже известным обновленным сервером.
   */
  function applyServerItem(server: ClientServerListItem): void {
    upsertServer(server);
  }

  /**
   * Удаляет сервер из локального списка и discovery-состояния.
   */
  function removeServerItem(serverId: string): void {
    items.value = items.value.filter((item) => item.id !== serverId);
    searchResults.value = searchResults.value.filter((item) => item.id !== serverId);
    recommendedItems.value = recommendedItems.value.filter((item) => item.id !== serverId);
  }

  /**
   * Очищает временную ошибку формы создания сервера.
   */
  function clearCreateError(): void {
    createErrorMessage.value = null;
  }

  /**
   * Очищает состояние discovery/join flow в клиенте.
   */
  function clearDiscoveryState(): void {
    isSearching.value = false;
    isJoining.value = false;
    searchErrorMessage.value = null;
    joinErrorMessage.value = null;
    searchResults.value = [];
    recommendedItems.value = [];
  }

  /**
   * Сбрасывает клиентское состояние списка серверов.
   */
  function reset(): void {
    isLoading.value = false;
    isCreating.value = false;
    isSearching.value = false;
    isJoining.value = false;
    isLoaded.value = false;
    errorMessage.value = null;
    createErrorMessage.value = null;
    searchErrorMessage.value = null;
    joinErrorMessage.value = null;
    loadedForSessionToken.value = null;
    items.value = [];
    searchResults.value = [];
    recommendedItems.value = [];
  }

  return {
    isLoading,
    isCreating,
    isSearching,
    isJoining,
    isLoaded,
    errorMessage,
    createErrorMessage,
    searchErrorMessage,
    joinErrorMessage,
    loadedForSessionToken,
    items,
    searchResults,
    recommendedItems,
    loadServers,
    createServer,
    searchPublicServers,
    loadRecommendedServers,
    joinServer,
    applyServerItem,
    removeServerItem,
    clearCreateError,
    clearDiscoveryState,
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

/**
 * Приводит неизвестную ошибку поиска серверов к читаемому сообщению.
 */
function toSearchServersErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось выполнить поиск серверов.";
}

/**
 * Приводит неизвестную ошибку вступления в сервер к читаемому сообщению.
 */
function toJoinServerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось вступить в сервер.";
}
