<template>
  <header class="app-header">
    <div class="app-header__copy">
      <p class="dbru-text-xs dbru-text-muted">Workspace</p>
      <h2 class="dbru-text-lg dbru-text-main">{{ title }}</h2>
    </div>

    <div class="app-header__actions">
      <DbrBadge class="app-header__status dbru-text-sm">{{ statusLabel }}</DbrBadge>

      <DbrButton
        v-if="authStore.isAuthenticated"
        :native-type="'button'"
        @click="handleLogout"
      >
        Выйти
      </DbrButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DbrBadge, DbrButton } from "dobruniaui-vue";
import { DEFAULT_CLIENT_APP_TITLE, LOGIN_ROUTE_PATH } from "../../constants";
import { useAuthStatusLabel } from "../../composables/useAuthStatusLabel";
import { useAuthStore } from "../../stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const statusLabel = useAuthStatusLabel();

/**
 * Заголовок текущего маршрута в шапке приложения.
 */
const title = computed(() => String(route.meta.title ?? DEFAULT_CLIENT_APP_TITLE));

/**
 * Завершает клиентскую сессию и отправляет пользователя на страницу логина.
 */
async function handleLogout(): Promise<void> {
  authStore.logout();
  await router.replace(LOGIN_ROUTE_PATH);
}
</script>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dbru-space-4);
  align-items: center;
  justify-content: space-between;
  padding: var(--dbru-space-5) var(--dbru-space-6);
  border-bottom: 1px solid var(--dbru-color-border);
}

.app-header__copy {
  display: grid;
  gap: var(--dbru-space-1);
}

.app-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dbru-space-3);
  align-items: center;
}

.app-header__status {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 var(--dbru-space-3);
}
</style>
