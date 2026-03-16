<script setup lang="ts">
/**
 * Прозрачная кнопка для иконок в shell-интерфейсе.
 * Используется для действий без визуального бордера: settings, close, add.
 */
interface Props {
  /**
   * Текст для screen readers.
   */
  label: string;
  /**
   * Путь до иконки, если используется svg/image-asset.
   */
  iconSrc?: string;
  /**
   * Альтернативный текст для изображения иконки.
   */
  iconAlt?: string;
  /**
   * Тип нативной кнопки.
   */
  type?: "button" | "submit" | "reset";
  /**
   * Блокирует кнопку, если действие пока недоступно.
   */
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  iconSrc: undefined,
  iconAlt: "",
  type: "button",
  disabled: false,
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    :type="type"
    class="app-icon-button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <img
      v-if="iconSrc"
      :src="iconSrc"
      :alt="iconAlt"
      class="app-icon-button__icon"
      aria-hidden="true"
    />
    <span v-else class="app-icon-button__content" aria-hidden="true">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.app-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  color: var(--dbru-color-text);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease,
    opacity 160ms ease;
}

.app-icon-button:hover {
  background: color-mix(in srgb, var(--dbru-color-border) 24%, transparent);
}

.app-icon-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--dbru-color-primary) 44%, transparent);
  outline-offset: 2px;
}

.app-icon-button:active:not(:disabled) {
  transform: scale(0.96);
}

.app-icon-button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.app-icon-button__icon {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  object-fit: contain;
}

.app-icon-button__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  line-height: 1;
  font-weight: 600;
}
</style>
