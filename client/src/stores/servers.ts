import { ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServersApiClient } from "../graphql/servers";
import { useAuthStore } from "./auth";
import type { ClientServerListItem } from "../types/server";

/**
 * Pinia store списка серверов текущего пользователя.
 */
export const useServersStore = defineStore("servers", () => {
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const errorMessage = ref<string | null>(null);
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
      errorMessage.value = toErrorMessage(error);
      loadedForSessionToken.value = null;
      isLoaded.value = true;
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Сбрасывает клиентское состояние списка серверов.
   */
  function reset(): void {
    isLoading.value = false;
    isLoaded.value = false;
    errorMessage.value = null;
    loadedForSessionToken.value = null;
    items.value = [];
  }

  return {
    isLoading,
    isLoaded,
    errorMessage,
    loadedForSessionToken,
    items,
    loadServers,
    reset,
  };
});

/**
 * Приводит неизвестную ошибку к читаемому сообщению.
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось загрузить список серверов.";
}
