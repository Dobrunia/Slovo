import { ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServerApiClient } from "../graphql/server";
import { useAuthStore } from "./auth";
import type { ClientServerSnapshot } from "../types/server";

/**
 * Pinia store модуля выбранного сервера.
 */
export const useServerModuleStore = defineStore("serverModule", () => {
  const selectedServerId = ref<string | null>(null);
  const loadedServerId = ref<string | null>(null);
  const snapshot = ref<ClientServerSnapshot | null>(null);
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);

  const serverApiClient = createServerApiClient({
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
  });

  /**
   * Синхронизирует выбор сервера с доступным списком серверов пользователя.
   */
  async function syncAvailableServers(serverIds: string[]): Promise<void> {
    if (serverIds.length === 0) {
      reset();
      return;
    }

    const nextSelectedServerId =
      selectedServerId.value && serverIds.includes(selectedServerId.value)
        ? selectedServerId.value
        : serverIds[0];

    if (
      nextSelectedServerId === selectedServerId.value &&
      nextSelectedServerId === loadedServerId.value &&
      snapshot.value
    ) {
      return;
    }

    await openServer(nextSelectedServerId);
  }

  /**
   * Открывает сервер по id и загружает его initial snapshot.
   */
  async function openServer(serverId: string): Promise<void> {
    const normalizedServerId = serverId.trim();

    if (!normalizedServerId) {
      reset();
      return;
    }

    if (
      normalizedServerId === selectedServerId.value &&
      normalizedServerId === loadedServerId.value &&
      snapshot.value
    ) {
      return;
    }

    selectedServerId.value = normalizedServerId;
    await loadSelectedServerSnapshot();
  }

  /**
   * Перезагружает initial snapshot уже выбранного сервера.
   */
  async function reloadSelectedServer(): Promise<void> {
    if (!selectedServerId.value) {
      return;
    }

    await loadSelectedServerSnapshot();
  }

  /**
   * Сбрасывает состояние модуля выбранного сервера.
   */
  function reset(): void {
    selectedServerId.value = null;
    loadedServerId.value = null;
    snapshot.value = null;
    isLoading.value = false;
    errorMessage.value = null;
  }

  /**
   * Выполняет GraphQL initial load snapshot-а выбранного сервера.
   */
  async function loadSelectedServerSnapshot(): Promise<void> {
    const authStore = useAuthStore();
    const sessionToken = authStore.sessionToken;

    if (!sessionToken || !selectedServerId.value) {
      reset();
      return;
    }

    isLoading.value = true;
    errorMessage.value = null;

    try {
      const nextSnapshot = await serverApiClient.serverSnapshot(
        sessionToken,
        selectedServerId.value,
      );

      snapshot.value = nextSnapshot;
      loadedServerId.value = selectedServerId.value;
    } catch (error) {
      snapshot.value = null;
      loadedServerId.value = null;
      errorMessage.value = toErrorMessage(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    selectedServerId,
    loadedServerId,
    snapshot,
    isLoading,
    errorMessage,
    syncAvailableServers,
    openServer,
    reloadSelectedServer,
    reset,
  };
});

/**
 * Приводит неизвестную ошибку initial load сервера к читаемому сообщению.
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось загрузить данные сервера.";
}
