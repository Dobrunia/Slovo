<script setup lang="ts">
/**
 * Свойства универсальной прозрачной иконкокнопки.
 */
interface AppIconButtonProps {
  label: string;
  iconSrc?: string;
  iconAlt?: string;
  tone?: "default" | "danger";
}

withDefaults(defineProps<AppIconButtonProps>(), {
  iconSrc: "",
  iconAlt: "",
  tone: "default",
});
</script>

<template>
  <button
    type="button"
    class="app-icon-button"
    :class="{
      'app-icon-button--danger': tone === 'danger',
    }"
    :aria-label="label"
  >
    <slot name="icon">
      <img
        v-if="iconSrc"
        class="app-icon-button__image"
        :src="iconSrc"
        :alt="iconAlt"
      />
    </slot>
  </button>
</template>

<style scoped>
.app-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dbru-control-height-md);
  height: var(--dbru-control-height-md);
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dbru-color-text);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    color 160ms ease;
}

.app-icon-button:hover {
  background-color: color-mix(in srgb, var(--dbru-color-primary) 12%, transparent);
}

.app-icon-button:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 2px;
}

.app-icon-button:active {
  transform: scale(0.96);
}

.app-icon-button--danger {
  color: var(--dbru-color-error);
}

.app-icon-button__image {
  display: block;
  width: 1.375rem;
  height: 1.375rem;
}
</style>
