<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DbrAvatar, DbrButton, DbrInput } from "dobruniaui-vue";
import AppHeadingBlock from "../../components/base/AppHeadingBlock.vue";
import AppModalLayout from "../../components/base/AppModalLayout.vue";
import { useServersStore } from "../../stores/servers";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  joined: [serverId: string];
}>();

const serversStore = useServersStore();
const searchQuery = ref("");

const hasSearchResults = computed(() => serversStore.searchResults.length > 0);
const hasRecommendedServers = computed(() => serversStore.recommendedItems.length > 0);
const searchEmptyMessage = computed(() => {
  if (serversStore.isSearching || searchQuery.value.trim().length === 0) {
    return "";
  }

  if (serversStore.searchErrorMessage) {
    return serversStore.searchErrorMessage;
  }

  return "По вашему запросу пока ничего не найдено.";
});
const discoveryErrorMessage = computed(() => serversStore.joinErrorMessage ?? serversStore.searchErrorMessage);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    searchQuery.value = "";
    void serversStore.loadRecommendedServers().catch(() => undefined);
  },
  { immediate: true },
);

/**
 * Выполняет поиск публичных серверов по текущему текстовому запросу.
 */
async function handleSearch(): Promise<void> {
  await serversStore.searchPublicServers(searchQuery.value);
}

/**
 * Вступает в выбранный публичный сервер из discovery-списка.
 */
async function handleJoinPublicServer(serverId: string): Promise<void> {
  const joinedServer = await serversStore.joinServer({
    serverId,
  });

  emit("joined", joinedServer.id);
}
</script>

<template>
  <AppModalLayout
    :is-open="isOpen"
    title="Поиск серверов"
    max-width="42rem"
    @close="emit('close')"
  >
    <p
      v-if="discoveryErrorMessage"
      class="server-discovery-modal__error dbru-text-sm"
    >
      {{ discoveryErrorMessage }}
    </p>

    <section class="server-discovery-modal__section">
      <AppHeadingBlock
        title="Найти публичный сервер"
        description="Введите название сервера и вступите в него сразу из списка."
        title-size="base"
      />

      <form class="server-discovery-modal__search-form" @submit.prevent="handleSearch">
        <div class="server-discovery-modal__search-input">
          <DbrInput
            v-model="searchQuery"
            label="Название сервера"
            name="public-server-query"
            autocomplete="off"
          />
        </div>

        <DbrButton
          :loading="serversStore.isSearching"
          :native-type="'submit'"
        >
          Найти
        </DbrButton>
      </form>

      <div v-if="hasSearchResults" class="server-discovery-modal__results">
        <article
          v-for="server in serversStore.searchResults"
          :key="server.id"
          class="server-discovery-modal__result"
        >
          <div class="server-discovery-modal__result-main">
            <DbrAvatar
              size="md"
              shape="rounded"
              :name="server.name"
              :src="server.avatarUrl ?? undefined"
            />

            <div class="server-discovery-modal__result-copy">
              <h3 class="server-discovery-modal__result-title dbru-text-base dbru-text-main">
                {{ server.name }}
              </h3>
              <p class="server-discovery-modal__result-meta dbru-text-sm dbru-text-muted">
                Публичный сервер
              </p>
            </div>
          </div>

          <DbrButton
            :loading="serversStore.isJoining"
            :native-type="'button'"
            @click="handleJoinPublicServer(server.id)"
          >
            Вступить
          </DbrButton>
        </article>
      </div>

      <p
        v-else-if="searchEmptyMessage"
        class="server-discovery-modal__message dbru-text-sm dbru-text-muted"
      >
        {{ searchEmptyMessage }}
      </p>
    </section>

    <section
      v-if="hasRecommendedServers"
      class="server-discovery-modal__section"
    >
      <AppHeadingBlock
        title="Рекомендуем"
        description="Два самых популярных публичных сервера, к которым можно присоединиться сразу."
        title-size="base"
      />

      <div class="server-discovery-modal__results">
        <article
          v-for="server in serversStore.recommendedItems"
          :key="server.id"
          class="server-discovery-modal__result"
        >
          <div class="server-discovery-modal__result-main">
            <DbrAvatar
              size="md"
              shape="rounded"
              :name="server.name"
              :src="server.avatarUrl ?? undefined"
            />

            <div class="server-discovery-modal__result-copy">
              <h3 class="server-discovery-modal__result-title dbru-text-base dbru-text-main">
                {{ server.name }}
              </h3>
              <p class="server-discovery-modal__result-meta dbru-text-sm dbru-text-muted">
                Рекомендуемый публичный сервер
              </p>
            </div>
          </div>

          <DbrButton
            :loading="serversStore.isJoining"
            :native-type="'button'"
            @click="handleJoinPublicServer(server.id)"
          >
            Вступить
          </DbrButton>
        </article>
      </div>
    </section>
  </AppModalLayout>
</template>

<style scoped>
.server-discovery-modal__section {
  display: grid;
  gap: var(--dbru-space-4);
}

.server-discovery-modal__search-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-3);
  align-items: end;
}

.server-discovery-modal__search-input {
  min-width: 0;
}

.server-discovery-modal__results {
  display: grid;
  gap: var(--dbru-space-3);
}

.server-discovery-modal__result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dbru-space-4);
  padding: var(--dbru-space-4);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-bg);
}

.server-discovery-modal__result-main {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.server-discovery-modal__result-copy {
  display: grid;
  gap: var(--dbru-space-1);
  min-width: 0;
}

.server-discovery-modal__result-title,
.server-discovery-modal__result-meta,
.server-discovery-modal__message,
.server-discovery-modal__error {
  margin: 0;
}

.server-discovery-modal__result-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-discovery-modal__error {
  color: var(--dbru-color-error);
}

@media (max-width: 640px) {
  .server-discovery-modal__search-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .server-discovery-modal__result {
    flex-direction: column;
    align-items: stretch;
  }

  .server-discovery-modal__result :deep(.dbru-button) {
    width: 100%;
  }
}
</style>
