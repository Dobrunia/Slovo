<template>
  <div class="auth-panel dbru-surface">
    <h1 class="auth-panel__title dbru-text-main">{{ title }}</h1>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Свойства общей auth-панели клиента.
 */
interface AuthFormPanelProps {
  title: string;
}

defineProps<AuthFormPanelProps>();
</script>

<style scoped>
.auth-panel {
  width: min(100%, 34rem);
  max-height: calc(100dvh - (var(--dbru-space-6) * 2));
  display: grid;
  gap: var(--dbru-space-6);
  padding: var(--dbru-space-6);
  margin-inline: auto;
  overflow: auto;
  border-radius: var(--dbru-radius-md);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  box-shadow: var(--dbru-shadow-md);
}

.auth-panel__title {
  margin: 0;
  text-align: center;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
  font-weight: 700;
}

@media (max-width: 640px) {
  .auth-panel {
    width: min(100%, 28rem);
    max-height: calc(100dvh - (var(--dbru-space-4) * 2));
    gap: var(--dbru-space-5);
    padding: var(--dbru-space-5);
  }
}
</style>
