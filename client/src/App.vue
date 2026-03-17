<template>
  <main class="app-shell dbru-root dbru-theme-sketch">
    <div v-if="isGuestRoute" :class="guestShellClassName">
      <RouterView />
    </div>

    <section v-else class="app-shell__content dbru-surface">
      <RouterView />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { RouterView } from 'vue-router';

const route = useRoute();

/**
 * Определяет, находится ли пользователь на гостевой auth-странице.
 */
const isGuestRoute = computed(() => Boolean(route.meta.guestOnly));

/**
 * Вычисляет класс layout-контейнера для текущего гостевого экрана.
 */
const guestShellClassName = computed(() =>
  route.meta.guestLayout === 'landing'
    ? 'guest-shell guest-shell--landing'
    : route.meta.guestLayout === 'register'
      ? 'guest-shell guest-shell--register'
      : 'guest-shell guest-shell--login'
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
}

.guest-shell--login {
  overflow: auto;
  background:
    url('./assets/login_back.png') center / cover no-repeat,
    var(--dbru-color-bg);
}

.guest-shell--register {
  overflow: auto;
  background:
    url('./assets/reg_back.png') center bottom / cover no-repeat,
    var(--dbru-color-bg);
}

.guest-shell--landing {
  overflow: hidden;
  background:
    url('./assets/landing_back.png') center bottom / cover no-repeat,
    var(--dbru-color-bg);
}

:global(html),
:global(body),
:global(#app) {
  min-height: 100%;
  margin: 0;
}

.app-shell__content {
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
}

@media (max-width: 640px) {
  .guest-shell {
    padding: var(--dbru-space-4);
  }
}
</style>
