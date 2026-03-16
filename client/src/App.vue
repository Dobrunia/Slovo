<template>
  <main class="app-shell dbru-root dbru-theme-sketch">
    <div
      v-if="isGuestRoute"
      :class="guestShellClassName"
    >
      <RouterView />
    </div>

    <section v-else class="app-shell__content dbru-surface">
      <AppHeaderBar />

      <div class="app-shell__body">
        <RouterView />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { RouterView } from "vue-router";
import AppHeaderBar from "./components/layout/AppHeaderBar.vue";

const route = useRoute();

/**
 * Определяет, находится ли пользователь на гостевой auth-странице.
 */
const isGuestRoute = computed(() => Boolean(route.meta.guestOnly));

/**
 * Вычисляет класс layout-контейнера для текущего гостевого экрана.
 */
const guestShellClassName = computed(() =>
  route.meta.guestLayout === "landing"
    ? "guest-shell guest-shell--landing"
    : "guest-shell guest-shell--auth",
);
</script>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background: var(--dbru-color-bg);
  color: var(--dbru-color-text);
}

.guest-shell {
  height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--dbru-space-6);
  box-sizing: border-box;
}

.guest-shell--auth {
  overflow: auto;
  background:
    url("./assets/auth_back.png") center center / cover no-repeat,
    var(--dbru-color-bg);
}

.guest-shell--landing {
  overflow: hidden;
  background:
    url("./assets/init_bg.png") center center / cover no-repeat,
    var(--dbru-color-bg);
}

:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}

.app-shell__content {
  min-height: 100vh;
  overflow: hidden;
  border-radius: var(--dbru-radius-md);
  margin: 0 auto;
  width: min(100%, 72rem);
}

.app-shell__body {
  padding: var(--dbru-space-6);
}

@media (max-width: 640px) {
  .guest-shell {
    padding: var(--dbru-space-4);
  }

  .app-shell__body {
    padding: var(--dbru-space-4);
  }
}
</style>
