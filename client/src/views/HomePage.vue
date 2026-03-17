<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppHeaderLayout from "../layouts/AppHeaderLayout.vue";
import AuthenticatedLayout from "../layouts/AuthenticatedLayout.vue";
import AppHeaderActionsModule from "../modules/app/AppHeaderActionsModule.vue";
import ServerRailModule from "../modules/server/ServerRailModule.vue";
import ServerChannelListModule from "../modules/server/channels/ServerChannelListModule.vue";
import ChannelViewModule from "../modules/server/channels/ChannelViewModule.vue";
import UserSettingsModal from "../modules/settings/UserSettingsModal.vue";
import CreateServerModal from "../modules/server/CreateServerModal.vue";
import CurrentUserControlModule from "../modules/user/CurrentUserControlModule.vue";
import { APP_HOME_ROUTE_PATH } from "../constants";
import { APP_HOME_ROUTE_NAME } from "../router/serverRoutes";
import {
  buildAppServerChannelRoute,
  buildAppServerRoute,
  readSelectedChannelIdFromRouteParams,
  readSelectedServerIdFromRouteParams,
} from "../router/serverRoutes";
import { useServersStore } from "../stores/servers";
import { useServerModuleStore } from "../stores/serverModule";

const route = useRoute();
const router = useRouter();
const isSettingsOpen = ref(false);
const isCreateServerOpen = ref(false);
const serversStore = useServersStore();
const serverModuleStore = useServerModuleStore();
const availableServerIds = computed(() => serversStore.items.map((server) => server.id));
const selectedServerId = computed(() => readSelectedServerIdFromRouteParams(route.params));
const selectedChannelId = computed(() => readSelectedChannelIdFromRouteParams(route.params));

watch(
  [availableServerIds, selectedServerId],
  ([serverIds, currentSelectedServerId]) => {
    void syncRouteSelection(serverIds, currentSelectedServerId);
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
 * Закрывает модальное окно создания нового сервера.
 */
function closeCreateServer(): void {
  isCreateServerOpen.value = false;
}

/**
 * Открывает выбранный канал в URL внутри текущего сервера.
 */
function handleSelectChannel(channelId: string): void {
  if (!selectedServerId.value) {
    return;
  }

  void router.replace(buildAppServerChannelRoute(selectedServerId.value, channelId));
}

/**
 * После создания сервера сразу открывает его в основном модуле.
 */
function handleServerCreated(serverId: string): void {
  void router.replace(buildAppServerRoute(serverId));
}

/**
 * Синхронизирует route selection и initial load модуля сервера.
 */
async function syncRouteSelection(
  serverIds: string[],
  currentSelectedServerId: string | null,
): Promise<void> {
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
        <ChannelViewModule :selected-channel-id="selectedChannelId" />
      </template>
    </AuthenticatedLayout>

    <UserSettingsModal :is-open="isSettingsOpen" @close="closeSettings" />
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
