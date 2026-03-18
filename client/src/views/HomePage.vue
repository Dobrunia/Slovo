<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ServerDiscoveryModal from "../modules/app/ServerDiscoveryModal.vue";
import AppHeaderLayout from "../layouts/AppHeaderLayout.vue";
import AuthenticatedLayout from "../layouts/AuthenticatedLayout.vue";
import AppHeaderActionsModule from "../modules/app/AppHeaderActionsModule.vue";
import ServerRailModule from "../modules/server/ServerRailModule.vue";
import ServerChannelListModule from "../modules/server/channels/ServerChannelListModule.vue";
import ChannelPresenceViewModule from "../modules/server/channels/ChannelPresenceViewModule.vue";
import UserSettingsModal from "../modules/settings/UserSettingsModal.vue";
import CreateServerModal from "../modules/server/CreateServerModal.vue";
import CurrentUserControlModule from "../modules/user/CurrentUserControlModule.vue";
import { APP_HOME_ROUTE_PATH } from "../constants";
import { APP_HOME_ROUTE_NAME } from "../router/serverRoutes";
import {
  buildAppServerChannelRoute,
  buildAppServerRoute,
  readInviteTokenFromRouteParams,
  readSelectedChannelIdFromRouteParams,
  readSelectedServerIdFromRouteParams,
} from "../router/serverRoutes";
import { useHomePageRealtime } from "../composables/useHomePageRealtime";
import { useAuthStore } from "../stores/auth";
import { useServersStore } from "../stores/servers";
import { useServerModuleStore } from "../stores/serverModule";

const route = useRoute();
const router = useRouter();
const isSettingsOpen = ref(false);
const isCreateServerOpen = ref(false);
const isDiscoveryOpen = ref(false);
const isJoiningInvite = ref(false);
const authStore = useAuthStore();
const serversStore = useServersStore();
const serverModuleStore = useServerModuleStore();
const availableServerIds = computed(() => serversStore.items.map((server) => server.id));
const selectedServerId = computed(() => readSelectedServerIdFromRouteParams(route.params));
const selectedChannelId = computed(() => readSelectedChannelIdFromRouteParams(route.params));
const selectedInviteToken = computed(() => readInviteTokenFromRouteParams(route.params));

watch(
  [availableServerIds, selectedServerId, selectedInviteToken, isJoiningInvite],
  ([serverIds, currentSelectedServerId, currentInviteToken, isInviteJoinPending]) => {
    void syncRouteSelection(
      serverIds,
      currentSelectedServerId,
      currentInviteToken,
      isInviteJoinPending,
    );
  },
  {
    immediate: true,
  },
);

watch(
  [selectedServerId, selectedChannelId, () => serverModuleStore.snapshot],
  ([currentSelectedServerId, currentSelectedChannelId, snapshot]) => {
    if (!currentSelectedServerId || !currentSelectedChannelId || !snapshot) {
      return;
    }

    const hasSelectedChannel = snapshot.channels.some(
      (channel) => channel.id === currentSelectedChannelId,
    );

    if (!hasSelectedChannel) {
      void router.replace(buildAppServerRoute(currentSelectedServerId));
    }
  },
);

watch(
  selectedInviteToken,
  (inviteToken) => {
    if (!inviteToken) {
      return;
    }

    void handleInviteRoute(inviteToken);
  },
  {
    immediate: true,
  },
);

useHomePageRealtime({
  selectedServerId,
  selectedChannelId,
  authStore,
  serverModuleStore,
  router,
});

/**
 * Переключает видимость модального окна с настройками пользователя.
 */
function toggleSettings(): void {
  isSettingsOpen.value = !isSettingsOpen.value;
}

/**
 * Закрывает модальное окно с настройками.
 */
function closeSettings(): void {
  isSettingsOpen.value = false;
}

/**
 * Открывает модальное окно создания нового сервера.
 */
function handleAddServer(): void {
  isCreateServerOpen.value = true;
}

/**
 * Открывает discovery-модалку поиска и вступления в серверы.
 */
function handleOpenDiscovery(): void {
  serversStore.clearDiscoveryState();
  isDiscoveryOpen.value = true;
}

/**
 * Закрывает модальное окно создания нового сервера.
 */
function closeCreateServer(): void {
  isCreateServerOpen.value = false;
}

/**
 * Закрывает discovery-модалку и очищает временное состояние flow.
 */
function closeDiscovery(): void {
  isDiscoveryOpen.value = false;
  serversStore.clearDiscoveryState();
}

/**
 * Открывает выбранный канал в URL внутри текущего сервера.
 */
async function handleSelectChannel(channelId: string): Promise<void> {
  if (!selectedServerId.value) {
    return;
  }

  try {
    if (serverModuleStore.currentUserPresence?.channelId === channelId) {
      return;
    }

    await serverModuleStore.joinOrMoveToChannel(channelId);
    await router.replace(buildAppServerChannelRoute(selectedServerId.value, channelId));
  } catch {
    // Ошибка уже отражена в store и не должна всплывать как unhandled event error.
  }
}

/**
 * После создания сервера сразу открывает его в основном модуле.
 */
function handleServerCreated(serverId: string): void {
  void router.replace(buildAppServerRoute(serverId));
}

/**
 * Закрывает discovery-модалку и открывает сервер, в который пользователь только что вступил.
 */
function handleServerJoined(serverId: string): void {
  closeDiscovery();
  void router.replace(buildAppServerRoute(serverId));
}

/**
 * Обрабатывает прямой переход по invite-ссылке и при ошибке открывает discovery-модалку.
 */
async function handleInviteRoute(inviteToken: string): Promise<void> {
  if (isJoiningInvite.value) {
    return;
  }

  isJoiningInvite.value = true;
  serversStore.clearDiscoveryState();

  try {
    const joinedServer = await serversStore.joinServer({
      inviteToken,
    });

    isDiscoveryOpen.value = false;
    await router.replace(buildAppServerRoute(joinedServer.id));
  } catch {
    isDiscoveryOpen.value = true;
    await router.replace(APP_HOME_ROUTE_PATH);
  } finally {
    isJoiningInvite.value = false;
  }
}

/**
 * Синхронизирует route selection и initial load модуля сервера.
 */
async function syncRouteSelection(
  serverIds: string[],
  currentSelectedServerId: string | null,
  currentInviteToken: string | null,
  isInviteJoinPending: boolean,
): Promise<void> {
  if (currentInviteToken || isInviteJoinPending) {
    return;
  }

  if (serverIds.length === 0) {
    serverModuleStore.reset();

    if (route.name !== APP_HOME_ROUTE_NAME) {
      await router.replace(APP_HOME_ROUTE_PATH);
    }

    return;
  }

  const nextSelectedServerId =
    currentSelectedServerId && serverIds.includes(currentSelectedServerId)
      ? currentSelectedServerId
      : serverIds[0];

  if (currentSelectedServerId !== nextSelectedServerId) {
    await router.replace(buildAppServerRoute(nextSelectedServerId));
    return;
  }

  await serverModuleStore.openServer(nextSelectedServerId);
}

</script>

<template>
  <div class="home-page">
    <AuthenticatedLayout>
      <template #header>
        <AppHeaderLayout>
          <template #primary>
            <ServerRailModule :selected-server-id="selectedServerId" />
          </template>

          <template #secondary>
            <AppHeaderActionsModule
              @add-server="handleAddServer"
              @open-discovery="handleOpenDiscovery"
              @open-settings="toggleSettings"
            />
          </template>
        </AppHeaderLayout>
      </template>

      <template #sidebar>
        <ServerChannelListModule
          :selected-channel-id="selectedChannelId"
          @select-channel="handleSelectChannel"
        />
      </template>

      <template #user-control>
        <CurrentUserControlModule />
      </template>

      <template #content>
        <ChannelPresenceViewModule :selected-channel-id="selectedChannelId" />
      </template>
    </AuthenticatedLayout>

    <UserSettingsModal :is-open="isSettingsOpen" @close="closeSettings" />
    <ServerDiscoveryModal
      :is-open="isDiscoveryOpen"
      @close="closeDiscovery"
      @joined="handleServerJoined"
    />
    <CreateServerModal
      :is-open="isCreateServerOpen"
      @close="closeCreateServer"
      @created="handleServerCreated"
    />
  </div>
</template>

<style scoped>
.home-page {
  height: 100dvh;
  min-height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
}
</style>
