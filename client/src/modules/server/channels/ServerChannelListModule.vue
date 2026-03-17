<script setup lang="ts">
import { computed, ref } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import AppIconButton from "../../../components/base/AppIconButton.vue";
import ServerSettingsModal from "../ServerSettingsModal.vue";
import ServerChannelListItem from "./ServerChannelListItem.vue";
import settingsIcon from "../../../assets/icons/settings.svg";
import { useServerModuleStore } from "../../../stores/serverModule";

interface ServerChannelListModuleProps {
  selectedChannelId: string | null;
}

const props = defineProps<ServerChannelListModuleProps>();

const emit = defineEmits<{
  selectChannel: [channelId: string];
}>();

const serverModuleStore = useServerModuleStore();
const isServerSettingsOpen = ref(false);

/**
 * Возвращает текущий initial snapshot выбранного сервера.
 */
const snapshot = computed(() => serverModuleStore.snapshot);

/**
 * Возвращает данные выбранного сервера.
 */
const selectedServer = computed(() => snapshot.value?.server ?? null);
const canManageServer = computed(() => selectedServer.value?.role === "OWNER");

/**
 * Возвращает список каналов выбранного сервера.
 */
const channels = computed(() => snapshot.value?.channels ?? []);

/**
 * Открывает модальное окно редактирования текущего сервера.
 */
function openServerSettings(): void {
  if (!selectedServer.value) {
    return;
  }

  isServerSettingsOpen.value = true;
}

/**
 * Закрывает модальное окно редактирования сервера.
 */
function closeServerSettings(): void {
  isServerSettingsOpen.value = false;
}

/**
 * Сообщает родителю о выборе канала в списке.
 */
function handleSelectChannel(channelId: string): void {
  emit("selectChannel", channelId);
}
</script>

<template>
  <aside class="server-channel-list-module">
    <header
      v-if="selectedServer"
      class="server-channel-list-module__header"
    >
      <div class="server-channel-list-module__server">
        <DbrAvatar
          size="md"
          shape="rounded"
          :name="selectedServer.name"
          :src="selectedServer.avatarUrl ?? undefined"
        />
        <span class="server-channel-list-module__server-name dbru-text-base dbru-text-main">
          {{ selectedServer.name }}
        </span>
      </div>

      <AppIconButton
        v-if="canManageServer"
        :icon-src="settingsIcon"
        label="Открыть настройки сервера"
        icon-alt=""
        @click="openServerSettings"
      />
    </header>

    <div
      v-if="channels.length > 0"
      class="server-channel-list-module__channels"
    >
      <ServerChannelListItem
        v-for="channel in channels"
        :key="channel.id"
        :channel-id="channel.id"
        :name="channel.name"
        :is-selected="channel.id === props.selectedChannelId"
        @select="handleSelectChannel"
      />
    </div>

    <div
      v-else
      class="server-channel-list-module__empty"
    >
      <p class="server-channel-list-module__empty-copy dbru-text-sm dbru-text-muted">
        В этом сервере пока нет каналов.
      </p>
    </div>

    <ServerSettingsModal
      :is-open="isServerSettingsOpen"
      @close="closeServerSettings"
    />
  </aside>
</template>

<style scoped>
.server-channel-list-module {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--dbru-color-bg);
  border-right: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.server-channel-list-module__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.server-channel-list-module__server {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.server-channel-list-module__server-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-channel-list-module__channels {
  display: grid;
  align-content: start;
  gap: var(--dbru-space-2);
  min-height: 0;
  padding: var(--dbru-space-4);
  overflow: auto;
}

.server-channel-list-module__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: var(--dbru-space-5);
}

.server-channel-list-module__empty-copy {
  margin: 0;
  text-align: center;
}
</style>
