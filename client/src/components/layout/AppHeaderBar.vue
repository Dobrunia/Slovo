<template>
  <header class="app-header">
    <div class="app-header__copy">
      <p class="dbru-text-xs dbru-text-muted">Slovo</p>
      <h2 class="dbru-text-lg dbru-text-main">{{ title }}</h2>
    </div>

    <div v-if="authStore.isAuthenticated" class="app-header__actions">
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
import { DbrButton } from "dobruniaui-vue";
import { DEFAULT_CLIENT_APP_TITLE, LOGIN_ROUTE_PATH } from "../../constants";
import { useAuthStore } from "../../stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

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
</style>
