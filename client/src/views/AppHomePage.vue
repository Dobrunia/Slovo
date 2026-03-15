<template>
  <section class="home-page">
    <DbrCard as="section" class="home-page__card">
      <div class="home-page__section">
        <p class="dbru-text-xs dbru-text-muted">Профиль</p>
        <h1 class="dbru-text-lg dbru-text-main">
          {{ authStore.currentUser?.displayName ?? "Гость" }}
        </h1>
        <p class="dbru-text-sm dbru-text-muted">
          @{{ authStore.currentUser?.username ?? "guest" }}
        </p>
        <p class="dbru-text-sm dbru-text-muted">
          {{ authStore.currentUser?.email ?? "Авторизуйтесь, чтобы увидеть профиль." }}
        </p>
      </div>
    </DbrCard>

    <DbrCard as="section" class="home-page__card">
      <div class="home-page__section">
        <p class="dbru-text-xs dbru-text-muted">Endpoints</p>

        <dl class="home-page__endpoints">
          <div class="home-page__endpoint">
            <dt class="dbru-text-sm dbru-text-muted">GraphQL</dt>
            <dd class="dbru-text-sm dbru-text-main">{{ endpoints.graphqlUrl }}</dd>
          </div>

          <div class="home-page__endpoint">
            <dt class="dbru-text-sm dbru-text-muted">Realtime</dt>
            <dd class="dbru-text-sm dbru-text-main">{{ endpoints.realtimeUrl }}</dd>
          </div>
        </dl>
      </div>
    </DbrCard>
  </section>
</template>

<script setup lang="ts">
import { DbrCard } from "dobruniaui-vue";
import { useClientEndpoints } from "../composables/useClientEndpoints";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const endpoints = useClientEndpoints();
</script>

<style scoped>
.home-page {
  display: grid;
  gap: var(--dbru-space-4);
}

.home-page__card {
  padding: var(--dbru-space-6);
  border-radius: var(--dbru-radius-md);
}

.home-page__section {
  display: grid;
  gap: var(--dbru-space-2);
}

.home-page__endpoints {
  display: grid;
  gap: var(--dbru-space-3);
  margin: 0;
}

.home-page__endpoint {
  display: grid;
  gap: var(--dbru-space-1);
}

.home-page__endpoint dd {
  margin: 0;
  word-break: break-word;
}
</style>
