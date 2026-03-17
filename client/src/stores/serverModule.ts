import { ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServerApiClient } from "../graphql/server";
import { useAuthStore } from "./auth";
import { useServersStore } from "./servers";
import type {
  ClientDeleteServerResult,
  ClientServerInviteLink,
  ClientServerListItem,
  ClientServerSnapshot,
  ClientUpdateServerInput,
  ClientVoiceChannel,
} from "../types/server";

/**
 * Pinia store модуля выбранного сервера.
 */
export const useServerModuleStore = defineStore("serverModule", () => {
  const selectedServerId = ref<string | null>(null);
  const loadedServerId = ref<string | null>(null);
  const snapshot = ref<ClientServerSnapshot | null>(null);
  const inviteLink = ref<ClientServerInviteLink | null>(null);
  const isLoading = ref(false);
  const isMutatingChannels = ref(false);
  const isUpdatingServer = ref(false);
  const isInviteLinkLoading = ref(false);
  const isInviteLinkRegenerating = ref(false);
  const isDeletingServer = ref(false);
  const errorMessage = ref<string | null>(null);
  const channelsErrorMessage = ref<string | null>(null);
  const serverUpdateErrorMessage = ref<string | null>(null);
  const inviteLinkErrorMessage = ref<string | null>(null);
  const deleteServerErrorMessage = ref<string | null>(null);

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
    inviteLink.value = null;
    isLoading.value = false;
    isMutatingChannels.value = false;
    isUpdatingServer.value = false;
    isInviteLinkLoading.value = false;
    isInviteLinkRegenerating.value = false;
    isDeletingServer.value = false;
    errorMessage.value = null;
    channelsErrorMessage.value = null;
    serverUpdateErrorMessage.value = null;
    inviteLinkErrorMessage.value = null;
    deleteServerErrorMessage.value = null;
  }

  /**
   * Создает новый канал в текущем выбранном сервере.
   */
  async function createChannel(name: string): Promise<void> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isMutatingChannels.value = true;
    channelsErrorMessage.value = null;

    try {
      const result = await serverApiClient.createVoiceChannel(sessionToken, {
        serverId,
        name: name.trim(),
      });

      replaceSnapshotChannels(result.channels);
    } catch (error) {
      channelsErrorMessage.value = toChannelMutationErrorMessage(error);
      throw error;
    } finally {
      isMutatingChannels.value = false;
    }
  }

  /**
   * Переименовывает канал в текущем сервере.
   */
  async function updateChannel(channelId: string, name: string): Promise<void> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isMutatingChannels.value = true;
    channelsErrorMessage.value = null;

    try {
      const result = await serverApiClient.updateVoiceChannel(sessionToken, {
        serverId,
        channelId,
        name: name.trim(),
      });

      replaceSnapshotChannels(result.channels);
    } catch (error) {
      channelsErrorMessage.value = toChannelMutationErrorMessage(error);
      throw error;
    } finally {
      isMutatingChannels.value = false;
    }
  }

  /**
   * Удаляет канал из текущего сервера.
   */
  async function deleteChannel(channelId: string): Promise<void> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isMutatingChannels.value = true;
    channelsErrorMessage.value = null;

    try {
      const result = await serverApiClient.deleteVoiceChannel(sessionToken, {
        serverId,
        channelId,
      });

      replaceSnapshotChannels(result.channels);
    } catch (error) {
      channelsErrorMessage.value = toChannelMutationErrorMessage(error);
      throw error;
    } finally {
      isMutatingChannels.value = false;
    }
  }

  /**
   * Сохраняет новый порядок каналов текущего сервера.
   */
  async function reorderChannels(channelIds: string[]): Promise<void> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isMutatingChannels.value = true;
    channelsErrorMessage.value = null;

    try {
      const result = await serverApiClient.reorderVoiceChannels(sessionToken, {
        serverId,
        channelIds,
      });

      replaceSnapshotChannels(result.channels);
    } catch (error) {
      channelsErrorMessage.value = toChannelMutationErrorMessage(error);
      throw error;
    } finally {
      isMutatingChannels.value = false;
    }
  }

  /**
   * Очищает ошибку channel CRUD в модуле сервера.
   */
  function clearChannelsError(): void {
    channelsErrorMessage.value = null;
  }

  /**
   * Очищает ошибку обновления метаданных сервера.
   */
  function clearServerUpdateError(): void {
    serverUpdateErrorMessage.value = null;
  }

  /**
   * Очищает ошибку invite-ссылки сервера.
   */
  function clearInviteLinkError(): void {
    inviteLinkErrorMessage.value = null;
  }

  /**
   * Очищает ошибку удаления сервера.
   */
  function clearDeleteServerError(): void {
    deleteServerErrorMessage.value = null;
  }

  /**
   * Обновляет название и аватар текущего выбранного сервера.
   */
  async function updateServerProfile(input: ClientUpdateServerInput): Promise<void> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isUpdatingServer.value = true;
    serverUpdateErrorMessage.value = null;

    try {
      const result = await serverApiClient.updateServer(sessionToken, serverId, {
        name: input.name.trim(),
        avatarUrl: normalizeOptionalText(input.avatarUrl),
      });

      replaceSnapshotServer(result.server);
      useServersStore().applyServerItem(result.server);
    } catch (error) {
      serverUpdateErrorMessage.value = toServerUpdateErrorMessage(error);
      throw error;
    } finally {
      isUpdatingServer.value = false;
    }
  }

  /**
   * Загружает актуальную invite-ссылку текущего сервера.
   */
  async function loadInviteLink(): Promise<ClientServerInviteLink> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isInviteLinkLoading.value = true;
    inviteLinkErrorMessage.value = null;

    try {
      const result = await serverApiClient.serverInviteLink(sessionToken, serverId);
      inviteLink.value = result;
      return result;
    } catch (error) {
      inviteLink.value = null;
      inviteLinkErrorMessage.value = toInviteLinkErrorMessage(error);
      throw error;
    } finally {
      isInviteLinkLoading.value = false;
    }
  }

  /**
   * Перевыпускает invite-ссылку текущего сервера.
   */
  async function regenerateInviteLink(): Promise<ClientServerInviteLink> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isInviteLinkRegenerating.value = true;
    inviteLinkErrorMessage.value = null;

    try {
      const result = await serverApiClient.regenerateServerInviteLink(sessionToken, serverId);
      inviteLink.value = result;
      return result;
    } catch (error) {
      inviteLinkErrorMessage.value = toInviteLinkErrorMessage(error);
      throw error;
    } finally {
      isInviteLinkRegenerating.value = false;
    }
  }

  /**
   * Удаляет текущий выбранный сервер.
   */
  async function deleteSelectedServer(): Promise<ClientDeleteServerResult> {
    const serverId = requireSelectedServerId();
    const sessionToken = requireSessionToken();

    isDeletingServer.value = true;
    deleteServerErrorMessage.value = null;

    try {
      const result = await serverApiClient.deleteServer(sessionToken, serverId);
      useServersStore().removeServerItem(result.serverId);
      reset();
      return result;
    } catch (error) {
      deleteServerErrorMessage.value = toDeleteServerErrorMessage(error);
      throw error;
    } finally {
      isDeletingServer.value = false;
    }
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
      inviteLink.value = null;
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

  /**
   * Обновляет только список каналов в уже загруженном snapshot-е сервера.
   */
  function replaceSnapshotChannels(channels: ClientVoiceChannel[]): void {
    if (!snapshot.value) {
      return;
    }

    snapshot.value = {
      ...snapshot.value,
      channels,
    };
  }

  /**
   * Обновляет только метаданные сервера внутри уже загруженного snapshot-а.
   */
  function replaceSnapshotServer(server: ClientServerListItem): void {
    if (!snapshot.value) {
      return;
    }

    snapshot.value = {
      ...snapshot.value,
      server,
    };
  }

  /**
   * Возвращает id текущего выбранного сервера или завершает операцию ошибкой.
   */
  function requireSelectedServerId(): string {
    if (!selectedServerId.value) {
      throw new Error("Сервер не выбран.");
    }

    return selectedServerId.value;
  }

  /**
   * Возвращает активный session token текущего пользователя или завершает операцию ошибкой.
   */
  function requireSessionToken(): string {
    const authStore = useAuthStore();

    if (!authStore.sessionToken) {
      throw new Error("Требуется авторизация.");
    }

    return authStore.sessionToken;
  }

  return {
    selectedServerId,
    loadedServerId,
    snapshot,
    inviteLink,
    isLoading,
    isMutatingChannels,
    isUpdatingServer,
    isInviteLinkLoading,
    isInviteLinkRegenerating,
    isDeletingServer,
    errorMessage,
    channelsErrorMessage,
    serverUpdateErrorMessage,
    inviteLinkErrorMessage,
    deleteServerErrorMessage,
    syncAvailableServers,
    openServer,
    reloadSelectedServer,
    createChannel,
    updateChannel,
    deleteChannel,
    reorderChannels,
    updateServerProfile,
    loadInviteLink,
    regenerateInviteLink,
    deleteSelectedServer,
    clearChannelsError,
    clearServerUpdateError,
    clearInviteLinkError,
    clearDeleteServerError,
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

/**
 * Приводит неизвестную ошибку channel CRUD к читаемому сообщению.
 */
function toChannelMutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось обновить список каналов.";
}

/**
 * Приводит неизвестную ошибку обновления сервера к читаемому сообщению.
 */
function toServerUpdateErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось обновить сервер.";
}

/**
 * Приводит неизвестную ошибку invite-ссылки к читаемому сообщению.
 */
function toInviteLinkErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось получить invite-ссылку сервера.";
}

/**
 * Приводит неизвестную ошибку удаления сервера к читаемому сообщению.
 */
function toDeleteServerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось удалить сервер.";
}

/**
 * Нормализует необязательный текст: пустая строка превращается в `null`.
 */
function normalizeOptionalText(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
