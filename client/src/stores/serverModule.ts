import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../constants";
import { createServerApiClient } from "../graphql/server";
import {
  executeJoinVoiceChannelCommand,
  executeLeaveVoiceChannelCommand,
  executeMoveVoiceChannelCommand,
  executeSetSelfDeafenCommand,
  executeSetSelfMuteCommand,
} from "../realtime/runtime";
import { useAuthStore } from "./auth";
import { useServersStore } from "./servers";
import type {
  ClientActiveVoicePresence,
  ClientChannelsUpdatedEventPayload,
  ClientDeleteServerResult,
  ClientPresenceUpdatedEventPayload,
  ClientCurrentVoiceState,
  ClientRuntimePresenceMember,
  ClientServerInviteLink,
  ClientServerListItem,
  ClientServerSnapshot,
  ClientServerUpdatedEventPayload,
  ClientUpdateServerInput,
  ClientVoiceStateUpdatedEventPayload,
  ClientVoiceChannel,
} from "../types/server";

/**
 * Pinia store модуля выбранного сервера.
 */
export const useServerModuleStore = defineStore("serverModule", () => {
  const selectedServerId = ref<string | null>(null);
  const selectedChannelId = ref<string | null>(null);
  const loadedServerId = ref<string | null>(null);
  const snapshot = ref<ClientServerSnapshot | null>(null);
  const inviteLink = ref<ClientServerInviteLink | null>(null);
  const isLoading = ref(false);
  const isMutatingChannels = ref(false);
  const isUpdatingServer = ref(false);
  const isInviteLinkLoading = ref(false);
  const isInviteLinkRegenerating = ref(false);
  const isDeletingServer = ref(false);
  const isChangingPresence = ref(false);
  const errorMessage = ref<string | null>(null);
  const channelsErrorMessage = ref<string | null>(null);
  const serverUpdateErrorMessage = ref<string | null>(null);
  const inviteLinkErrorMessage = ref<string | null>(null);
  const deleteServerErrorMessage = ref<string | null>(null);
  const presenceErrorMessage = ref<string | null>(null);
  const presenceMembers = ref<ClientRuntimePresenceMember[]>([]);
  const activeVoicePresence = ref<ClientActiveVoicePresence | null>(null);
  const currentVoiceState = ref<ClientCurrentVoiceState>({
    muted: false,
    deafened: false,
  });

  const serverApiClient = createServerApiClient({
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
  });
  const currentUserPresence = computed(() => {
    const currentUserId = useAuthStore().currentUser?.id;

    if (!currentUserId || activeVoicePresence.value?.userId !== currentUserId) {
      return null;
    }

    return activeVoicePresence.value;
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
    selectedChannelId.value =
      activeVoicePresence.value?.serverId === normalizedServerId
        ? activeVoicePresence.value.channelId
        : null;
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
    selectedChannelId.value = null;
    loadedServerId.value = null;
    snapshot.value = null;
    inviteLink.value = null;
    isLoading.value = false;
    isMutatingChannels.value = false;
    isUpdatingServer.value = false;
    isInviteLinkLoading.value = false;
    isInviteLinkRegenerating.value = false;
    isDeletingServer.value = false;
    isChangingPresence.value = false;
    errorMessage.value = null;
    channelsErrorMessage.value = null;
    serverUpdateErrorMessage.value = null;
    inviteLinkErrorMessage.value = null;
    deleteServerErrorMessage.value = null;
    presenceErrorMessage.value = null;
    presenceMembers.value = [];
    activeVoicePresence.value = null;
    currentVoiceState.value = {
      muted: false,
      deafened: false,
    };
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
   * Очищает ошибку runtime presence-команд.
   */
  function clearPresenceError(): void {
    presenceErrorMessage.value = null;
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
      const [nextSnapshot, nextPresenceSnapshot] = await Promise.all([
        serverApiClient.serverSnapshot(sessionToken, selectedServerId.value),
        serverApiClient.serverPresenceSnapshot(sessionToken, selectedServerId.value),
      ]);

      snapshot.value = nextSnapshot;
      presenceMembers.value = nextPresenceSnapshot.members;
      inviteLink.value = null;
      loadedServerId.value = selectedServerId.value;
    } catch (error) {
      snapshot.value = null;
      presenceMembers.value = [];
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
   * Применяет live-обновление метаданных уже открытого сервера без повторной загрузки snapshot.
   */
  function applyLiveServerUpdated(payload: ClientServerUpdatedEventPayload): void {
    if (!snapshot.value || snapshot.value.server.id !== payload.serverId) {
      return;
    }

    const nextServer: ClientServerListItem = {
      ...snapshot.value.server,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      isPublic: payload.isPublic,
    };

    replaceSnapshotServer(nextServer);
    useServersStore().applyServerItem(nextServer);
  }

  /**
   * Применяет live-обновление структуры каналов уже открытого сервера.
   */
  function applyLiveChannelsUpdated(payload: ClientChannelsUpdatedEventPayload): void {
    if (!snapshot.value || snapshot.value.server.id !== payload.serverId) {
      return;
    }

    replaceSnapshotChannels(payload.channels);
  }

  /**
   * Применяет live-изменение runtime presence внутри текущего выбранного сервера.
   */
  function applyPresenceUpdated(payload: ClientPresenceUpdatedEventPayload): void {
    const currentUserId = useAuthStore().currentUser?.id;

    if (payload.member.userId === currentUserId) {
      if (payload.action === "left") {
        if (activeVoicePresence.value?.serverId === payload.serverId) {
          activeVoicePresence.value = null;
          currentVoiceState.value = {
            muted: false,
            deafened: false,
          };

          if (selectedServerId.value === payload.serverId) {
            selectedChannelId.value = null;
          }
        }
      } else {
        activeVoicePresence.value = {
          serverId: payload.serverId,
          ...payload.member,
        };

        if (selectedServerId.value === payload.serverId) {
          selectedChannelId.value = payload.member.channelId;
        }
      }
    }

    if (!selectedServerId.value || payload.serverId !== selectedServerId.value) {
      return;
    }

    if (payload.action === "left") {
      presenceMembers.value = presenceMembers.value.filter(
        (member) => member.userId !== payload.member.userId,
      );
      return;
    }

    const nextMembers = presenceMembers.value.filter(
      (member) => member.userId !== payload.member.userId,
    );

    nextMembers.push(payload.member);
    nextMembers.sort((left, right) => left.joinedAt.localeCompare(right.joinedAt));
    presenceMembers.value = nextMembers;
  }

  /**
   * Применяет live-обновление voice state текущего пользователя.
   */
  function applyVoiceStateUpdated(payload: ClientVoiceStateUpdatedEventPayload): void {
    const currentUserId = useAuthStore().currentUser?.id;

    if (!currentUserId || payload.userId !== currentUserId) {
      return;
    }

    currentVoiceState.value = {
      muted: payload.muted,
      deafened: payload.deafened,
    };
  }

  /**
   * Выполняет join или move команду для выбранного голосового канала.
   */
  async function joinOrMoveToChannel(channelId: string): Promise<void> {
    const targetServerId = requireSelectedServerId();
    const sessionToken = requireSessionToken();
    const currentPresence = currentUserPresence.value;

    isChangingPresence.value = true;
    presenceErrorMessage.value = null;

    try {
      if (!currentPresence) {
        await executeJoinVoiceChannelCommand({
          sessionToken,
          serverId: targetServerId,
          channelId,
        });
        applyLocalCurrentUserPresence({
          serverId: targetServerId,
          channelId,
        });
        return;
      }

      if (currentPresence.serverId !== targetServerId) {
        await executeLeaveVoiceChannelCommand({
          sessionToken,
          serverId: currentPresence.serverId,
          channelId: currentPresence.channelId,
        });
        clearCurrentUserPresenceLocally(currentPresence.serverId);

        await executeJoinVoiceChannelCommand({
          sessionToken,
          serverId: targetServerId,
          channelId,
        });
        applyLocalCurrentUserPresence({
          serverId: targetServerId,
          channelId,
        });
        return;
      }

      if (currentPresence.channelId === channelId) {
        return;
      }

      await executeMoveVoiceChannelCommand({
        sessionToken,
        serverId: currentPresence.serverId,
        channelId: currentPresence.channelId,
        targetChannelId: channelId,
      });
      applyLocalCurrentUserPresence({
        serverId: currentPresence.serverId,
        channelId,
      });
    } catch (error) {
      presenceErrorMessage.value = toPresenceErrorMessage(error);
      throw error;
    } finally {
      isChangingPresence.value = false;
    }
  }

  /**
   * Выполняет leave-команду для текущего voice presence пользователя.
   */
  async function leaveCurrentChannel(): Promise<void> {
    const currentPresence = currentUserPresence.value;

    if (!currentPresence) {
      return;
    }

    const sessionToken = requireSessionToken();

    isChangingPresence.value = true;
    presenceErrorMessage.value = null;

    try {
      await executeLeaveVoiceChannelCommand({
        sessionToken,
        serverId: currentPresence.serverId,
        channelId: currentPresence.channelId,
      });
      clearCurrentUserPresenceLocally(currentPresence.serverId);
    } catch (error) {
      presenceErrorMessage.value = toPresenceErrorMessage(error);
      throw error;
    } finally {
      isChangingPresence.value = false;
    }
  }

  /**
   * Выполняет self-mute команду для текущего голосового канала пользователя.
   */
  async function setSelfMuted(muted: boolean): Promise<void> {
    const currentPresence = currentUserPresence.value;

    if (!currentPresence) {
      return;
    }

    const sessionToken = requireSessionToken();

    presenceErrorMessage.value = null;

    try {
      await executeSetSelfMuteCommand({
        sessionToken,
        serverId: currentPresence.serverId,
        channelId: currentPresence.channelId,
        muted,
      });
    } catch (error) {
      presenceErrorMessage.value = toPresenceErrorMessage(error);
      throw error;
    }
  }

  /**
   * Выполняет self-deafen команду для текущего голосового канала пользователя.
   */
  async function setSelfDeafened(deafened: boolean): Promise<void> {
    const currentPresence = currentUserPresence.value;

    if (!currentPresence) {
      return;
    }

    const sessionToken = requireSessionToken();

    presenceErrorMessage.value = null;

    try {
      await executeSetSelfDeafenCommand({
        sessionToken,
        serverId: currentPresence.serverId,
        channelId: currentPresence.channelId,
        deafened,
      });
    } catch (error) {
      presenceErrorMessage.value = toPresenceErrorMessage(error);
      throw error;
    }
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
   * Обновляет выбранный канал только для текущего открытого сервера.
   */
  function selectChannel(channelId: string | null): void {
    selectedChannelId.value = channelId;
  }

  /**
   * Локально применяет изменение присутствия текущего пользователя после успешной voice-команды.
   */
  function applyLocalCurrentUserPresence(input: {
    serverId: string;
    channelId: string;
  }): void {
    const authStore = useAuthStore();
    const currentUser = authStore.currentUser;

    if (!currentUser) {
      return;
    }

    const nextPresence: ClientActiveVoicePresence = {
      serverId: input.serverId,
      userId: currentUser.id,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl ?? null,
      channelId: input.channelId,
      joinedAt: new Date().toISOString(),
    };

    activeVoicePresence.value = nextPresence;

    if (selectedServerId.value === input.serverId) {
      selectedChannelId.value = input.channelId;

      const nextMembers = presenceMembers.value.filter(
        (member) => member.userId !== nextPresence.userId,
      );

      nextMembers.push({
        userId: nextPresence.userId,
        displayName: nextPresence.displayName,
        avatarUrl: nextPresence.avatarUrl,
        channelId: nextPresence.channelId,
        joinedAt: nextPresence.joinedAt,
      });
      nextMembers.sort((left, right) => left.joinedAt.localeCompare(right.joinedAt));
      presenceMembers.value = nextMembers;
    }
  }

  /**
   * Локально очищает присутствие текущего пользователя после успешного leave/disconnect.
   */
  function clearCurrentUserPresenceLocally(serverId: string): void {
    const currentUserId = useAuthStore().currentUser?.id;

    activeVoicePresence.value = null;
    currentVoiceState.value = {
      muted: false,
      deafened: false,
    };

    if (selectedServerId.value === serverId) {
      selectedChannelId.value = null;
    }

    if (currentUserId) {
      presenceMembers.value = presenceMembers.value.filter(
        (member) => member.userId !== currentUserId,
      );
    }
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
    selectedChannelId,
    loadedServerId,
    snapshot,
    inviteLink,
    isLoading,
    isMutatingChannels,
    isUpdatingServer,
    isInviteLinkLoading,
    isInviteLinkRegenerating,
    isDeletingServer,
    isChangingPresence,
    errorMessage,
    channelsErrorMessage,
    serverUpdateErrorMessage,
    inviteLinkErrorMessage,
    deleteServerErrorMessage,
    presenceErrorMessage,
    presenceMembers,
    activeVoicePresence,
    currentVoiceState,
    currentUserPresence,
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
    applyLiveServerUpdated,
    applyLiveChannelsUpdated,
    applyPresenceUpdated,
    applyVoiceStateUpdated,
    joinOrMoveToChannel,
    leaveCurrentChannel,
    setSelfMuted,
    setSelfDeafened,
    selectChannel,
    clearCurrentUserPresenceLocally,
    clearChannelsError,
    clearServerUpdateError,
    clearInviteLinkError,
    clearDeleteServerError,
    clearPresenceError,
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
 * Приводит неизвестную ошибку runtime presence-команд к читаемому сообщению.
 */
function toPresenceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Не удалось изменить присутствие в канале.";
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
