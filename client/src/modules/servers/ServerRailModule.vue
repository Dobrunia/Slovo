<template>
  <section class="server-rail">
    <p class="server-rail__label dbru-text-xs dbru-text-muted">Серверы</p>

    <p v-if="serversStore.isLoading" class="server-rail__state dbru-text-sm dbru-text-muted">
      Загружаем серверы...
    </p>

    <p
      v-else-if="serversStore.errorMessage"
      class="server-rail__state server-rail__state--error dbru-text-sm"
    >
      {{ serversStore.errorMessage }}
    </p>

    <p v-else-if="serversStore.items.length === 0" class="server-rail__state dbru-text-sm dbru-text-muted">
      Пока нет серверов.
    </p>

    <ul v-else class="server-rail__list">
      <li
        v-for="server in serversStore.items"
        :key="server.id"
        class="server-rail__item"
      >
        <button
          type="button"
          class="server-rail__server-button"
          :aria-label="server.name"
        >
          <DbrAvatar
            :src="server.avatarUrl ?? undefined"
            :name="server.name"
            size="md"
          />
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import { useAuthStore } from "../../stores/auth";
import { useServersStore } from "../../stores/servers";

const authStore = useAuthStore();
const serversStore = useServersStore();

watch(
  () => authStore.sessionToken,
  (sessionToken) => {
    if (!sessionToken) {
      serversStore.reset();
      return;
    }

    if (
      !serversStore.isLoading &&
      serversStore.loadedForSessionToken !== sessionToken
    ) {
      void serversStore.loadServers().catch(() => undefined);
    }
  },
  {
    immediate: true,
  },
);
</script>

<style scoped>
.server-rail {
  min-width: 0;
  display: flex;
  gap: var(--dbru-space-4);
  align-items: center;
}

.server-rail__label,
.server-rail__state {
  margin: 0;
  flex-shrink: 0;
}

.server-rail__list {
  list-style: none;
  min-width: 0;
  display: flex;
  gap: var(--dbru-space-3);
  align-items: center;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.server-rail__item {
  flex: 0 0 auto;
}

.server-rail__server-button {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.server-rail__state--error {
  color: var(--dbru-color-error);
}

@media (max-width: 640px) {
  .server-rail {
    gap: var(--dbru-space-3);
  }
}
</style>
