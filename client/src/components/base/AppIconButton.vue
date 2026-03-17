<script setup lang="ts">
import { computed, useSlots } from "vue";

/**
 * Свойства универсальной прозрачной иконкокнопки.
 */
interface AppIconButtonProps {
  label: string;
  iconSrc?: string;
  iconAlt?: string;
  tone?: "default" | "danger" | "success";
  spinning?: boolean;
}

const props = withDefaults(defineProps<AppIconButtonProps>(), {
  iconSrc: "",
  iconAlt: "",
  tone: "default",
  spinning: false,
});

const slots = useSlots();

/**
 * Возвращает CSS-переменную с источником иконки для mask-рендера.
 */
const iconStyle = computed(() => {
  if (!props.iconSrc) {
    return undefined;
  }

  return {
    "--app-icon-button-icon-src": `url("${props.iconSrc}")`,
  };
});

/**
 * Определяет, передано ли в кнопку текстовое содержимое рядом с иконкой.
 */
const hasContent = computed(() => Boolean(slots.default));
</script>

<template>
  <button
    type="button"
    class="app-icon-button"
    :class="{
      'app-icon-button--danger': tone === 'danger',
      'app-icon-button--success': tone === 'success',
      'app-icon-button--with-content': hasContent,
    }"
    :aria-label="label"
  >
    <slot name="icon">
      <span
        v-if="iconSrc"
        class="app-icon-button__image"
        :class="{
          'app-icon-button__image--spinning': spinning,
        }"
        :style="iconStyle"
        aria-hidden="true"
      />
    </slot>

    <span
      v-if="hasContent"
      class="app-icon-button__content"
    >
      <slot />
    </span>
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
  background-color: color-mix(in srgb, var(--dbru-color-primary) 12%, transparent); /* НЕ МЕНЯТЬ!! */
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

.app-icon-button--success {
  color: var(--dbru-color-success);
}

.app-icon-button--with-content {
  width: auto;
  padding-inline: var(--dbru-space-3);
  gap: var(--dbru-space-2);
}

.app-icon-button__image {
  display: block;
  width: 1.375rem;
  height: 1.375rem;
  background-color: currentColor;
  -webkit-mask-image: var(--app-icon-button-icon-src);
  mask-image: var(--app-icon-button-icon-src);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.app-icon-button__image--spinning {
  animation: app-icon-button-spin 480ms linear infinite;
}

.app-icon-button__content {
  display: inline-flex;
  align-items: center;
}

@keyframes app-icon-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
