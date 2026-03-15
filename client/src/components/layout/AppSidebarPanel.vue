<template>
  <section class="sidebar-panel">
    <DbrCard as="section" class="sidebar-panel__card">
      <div class="sidebar-panel__section">
        <p class="dbru-text-xs dbru-text-muted">Slovo</p>
        <h1 class="dbru-text-lg dbru-text-main">Voice workspace</h1>
        <p class="dbru-text-sm dbru-text-muted">
          Базовая авторизация клиента работает через Pinia store и GraphQL session flow.
        </p>
      </div>

      <div class="sidebar-panel__section">
        <span class="dbru-text-xs dbru-text-muted">Статус</span>
        <strong class="dbru-text-base dbru-text-main">{{ statusLabel }}</strong>
        <p v-if="authStore.currentUser" class="dbru-text-sm dbru-text-muted">
          {{ authStore.currentUser.displayName }} · @{{ authStore.currentUser.username }}
        </p>
      </div>

      <nav class="sidebar-panel__section" aria-label="Навигация клиента">
        <span class="dbru-text-xs dbru-text-muted">Маршруты</span>
        <RouterLink class="sidebar-panel__link dbru-text-sm dbru-text-main" to="/login">
          /login
        </RouterLink>
        <RouterLink class="sidebar-panel__link dbru-text-sm dbru-text-main" to="/register">
          /register
        </RouterLink>
        <RouterLink class="sidebar-panel__link dbru-text-sm dbru-text-main" to="/app">
          /app
        </RouterLink>
      </nav>
    </DbrCard>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import { DbrCard } from "dobruniaui-vue";
import { useAuthStatusLabel } from "../../composables/useAuthStatusLabel";
import { useAuthStore } from "../../stores/auth";

const authStore = useAuthStore();
const statusLabel = useAuthStatusLabel();
</script>

<style scoped>
.sidebar-panel__card {
  display: grid;
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-6);
  border-radius: var(--dbru-radius-md);
}

.sidebar-panel__section {
  display: grid;
  gap: var(--dbru-space-2);
}

.sidebar-panel__link {
  text-decoration: none;
}

.sidebar-panel__link:hover {
  text-decoration: underline;
}
</style>
