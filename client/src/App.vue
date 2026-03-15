<template>
  <main class="app-shell dbru-root dbru-theme-sketch">
    <section class="app-shell__grid">
      <AppSidebarPanel />

      <section class="app-shell__content dbru-surface">
        <AppHeaderBar />

        <div class="app-shell__body">
          <RouterView />
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import AppHeaderBar from "./components/layout/AppHeaderBar.vue";
import AppSidebarPanel from "./components/layout/AppSidebarPanel.vue";
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding: var(--dbru-space-6);
  background: var(--dbru-color-bg);
  color: var(--dbru-color-text);
}

.app-shell__grid {
  display: grid;
  gap: var(--dbru-space-6);
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}

.app-shell__content {
  overflow: hidden;
  border-radius: var(--dbru-radius-md);
}

.app-shell__body {
  padding: var(--dbru-space-6);
}

@media (max-width: 640px) {
  .app-shell {
    padding: var(--dbru-space-4);
  }

  .app-shell__body {
    padding: var(--dbru-space-4);
  }
}
</style>
