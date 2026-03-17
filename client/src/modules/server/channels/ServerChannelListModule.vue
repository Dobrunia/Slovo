<script setup lang="ts">
import { computed } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import AppHeadingBlock from "../../../components/base/AppHeadingBlock.vue";
import { useServersStore } from "../../../stores/servers";
import { useServerModuleStore } from "../../../stores/serverModule";

defineProps<{
  selectedChannelId?: string | null;
}>();

const emit = defineEmits<{
  selectChannel: [channelId: string];
}>();

const serversStore = useServersStore();
const serverModuleStore = useServerModuleStore();

const hasServers = computed(() => serversStore.items.length > 0);
const serverSnapshot = computed(() => serverModuleStore.snapshot);
const visibleChannels = computed(() => serverSnapshot.value?.channels ?? []);

/**
 * Переводит пользователя на выбранный канал внутри уже открытого сервера.
 */
function handleSelectChannel(channelId: string): void {
  emit("selectChannel", channelId);
}
</script>

<template>
  <section class="server-channel-list-module">
    <template v-if="serverSnapshot">
      <header class="server-channel-list-module__server-header">
        <DbrAvatar
          size="md"
          shape="rounded"
          :name="serverSnapshot.server.name"
          :src="serverSnapshot.server.avatarUrl ?? undefined"
        />

        <AppHeadingBlock
          class="server-channel-list-module__server-meta"
          :title="serverSnapshot.server.name"
          title-tag="h2"
          title-size="base"
        />
      </header>

      <ul v-if="visibleChannels.length > 0" class="server-channel-list-module__list">
        <li
          v-for="channel in visibleChannels"
          :key="channel.id"
          class="server-channel-list-module__item"
        >
          <button
            type="button"
            class="server-channel-list-module__button"
            :class="{
              'server-channel-list-module__button--selected': channel.id === selectedChannelId,
            }"
            @click="handleSelectChannel(channel.id)"
          >
            <span
              class="server-channel-list-module__mark dbru-text-sm dbru-text-muted"
              aria-hidden="true"
            >
              #
            </span>
            <span class="server-channel-list-module__name dbru-text-base dbru-text-main">
              {{ channel.name }}
            </span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else-if="serverModuleStore.isLoading">
      <AppHeadingBlock
        title="Загружаем..."
        description="Подготавливаем initial snapshot выбранного сервера."
        title-tag="h2"
        title-size="base"
      />
    </template>

    <template v-else-if="serverModuleStore.errorMessage">
      <AppHeadingBlock
        class="server-channel-list-module__status server-channel-list-module__status--error"
        title="Сервер недоступен"
        :description="serverModuleStore.errorMessage"
        title-tag="h2"
        title-size="base"
      />
    </template>

    <template v-else-if="hasServers">
      <AppHeadingBlock
        title="Выберите сервер"
        description="После выбора сервера его каналы откроются в этой колонке."
        title-tag="h2"
        title-size="base"
      />
    </template>

    <template v-else>
      <AppHeadingBlock
        title="Пока пусто"
        description="Создайте первый сервер, чтобы открыть основной экран приложения."
        title-tag="h2"
        title-size="base"
      />
    </template>
  </section>
</template>

<style scoped>
.server-channel-list-module {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--dbru-space-4);
  height: 100%;
  min-height: 0;
  padding: var(--dbru-space-5);
  overflow: hidden;
  background-color: var(--dbru-color-bg);
  border-right: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.server-channel-list-module__server-header {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-4);
}

.server-channel-list-module__status--error :deep(.app-heading-block__description) {
  color: var(--dbru-color-error);
}

.server-channel-list-module__list {
  display: grid;
  gap: var(--dbru-space-2);
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  align-content: start;
  overflow: auto;
}

.server-channel-list-module__item {
  min-width: 0;
}

.server-channel-list-module__button {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-2);
  width: 100%;
  padding: var(--dbru-space-3);
  border: 0;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  color: var(--dbru-color-text);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.server-channel-list-module__button:hover {
  background: var(--dbru-color-bg);
}

.server-channel-list-module__button--selected {
  background: var(--dbru-color-surface);
  box-shadow: inset 0 0 0 var(--dbru-border-size-1) var(--dbru-color-primary);
}

.server-channel-list-module__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .server-channel-list-module {
    border-right: var(--dbru-border-size-1) solid var(--dbru-color-border);
    border-top-right-radius: var(--dbru-radius-md);
    border-bottom-left-radius: 0;
  }
}

@media (max-width: 640px) {
  .server-channel-list-module {
    padding: var(--dbru-space-4);
  }

  .server-channel-list-module__server-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
