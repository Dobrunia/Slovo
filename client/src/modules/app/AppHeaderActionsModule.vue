<script setup lang="ts">
import AppIconButton from "../../components/base/AppIconButton.vue";
import addServerIcon from "../../assets/icons/add-server.svg";
import settingsIcon from "../../assets/icons/settings.svg";

const emit = defineEmits<{
  addServer: [];
  openSettings: [];
}>();
</script>

<template>
  <div class="app-header-actions">
    <AppIconButton
      :icon-src="addServerIcon"
      label="Добавить сервер"
      icon-alt=""
      @click="emit('addServer')"
    />

    <AppIconButton
      :icon-src="settingsIcon"
      label="Открыть настройки"
      icon-alt=""
      @click="emit('openSettings')"
    />
  </div>
</template>

<style scoped>
.app-header-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
}
</style>
