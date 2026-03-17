<script setup lang="ts">
import AppHeaderActionsModule from "./AppHeaderActionsModule.vue";
import ServerRailModule from "../server/ServerRailModule.vue";

defineProps<{
  selectedServerId?: string | null;
}>();

const emit = defineEmits<{
  addServer: [];
  openSettings: [];
}>();
</script>

<template>
  <header class="app-main-header">
    <div class="app-main-header__rail">
      <ServerRailModule :selected-server-id="selectedServerId" />
    </div>

    <AppHeaderActionsModule
      @add-server="emit('addServer')"
      @open-settings="emit('openSettings')"
    />
  </header>
</template>

<style scoped>
.app-main-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-4);
  align-items: center;
  padding: var(--dbru-space-2) var(--dbru-space-4);
}

.app-main-header__rail {
  min-width: 0;
}

@media (max-width: 640px) {
  .app-main-header {
    grid-template-columns: 1fr;
    padding: var(--dbru-space-2) var(--dbru-space-3) 0;
  }

  .app-main-header :deep(.app-header-actions) {
    justify-content: flex-end;
  }
}
</style>
