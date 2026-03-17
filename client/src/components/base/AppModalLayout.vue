<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { DbrCard } from "dobruniaui-vue";
import xIcon from "../../assets/icons/x.svg";
import AppIconButton from "./AppIconButton.vue";

/**
 * Свойства общей оболочки модального окна.
 */
interface AppModalLayoutProps {
  isOpen: boolean;
  title: string;
  maxWidth?: string;
}

const props = withDefaults(defineProps<AppModalLayoutProps>(), {
  maxWidth: "34rem",
});

const emit = defineEmits<{
  close: [];
}>();

/**
 * Вычисляет управляемую ширину диалога.
 */
const dialogStyle = computed(() => ({
  "--app-modal-max-width": props.maxWidth,
}));

let isEscapeListenerAttached = false;

/**
 * Закрывает модальное окно по клавише Escape.
 */
function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !props.isOpen) {
    return;
  }

  emit("close");
}

/**
 * Подключает глобальный keydown-listener только на время открытого модального окна.
 */
function attachEscapeListener(): void {
  if (isEscapeListenerAttached || typeof window === "undefined") {
    return;
  }

  window.addEventListener("keydown", handleWindowKeydown);
  isEscapeListenerAttached = true;
}

/**
 * Удаляет глобальный keydown-listener при закрытии или размонтировании модального окна.
 */
function detachEscapeListener(): void {
  if (!isEscapeListenerAttached || typeof window === "undefined") {
    return;
  }

  window.removeEventListener("keydown", handleWindowKeydown);
  isEscapeListenerAttached = false;
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      attachEscapeListener();
      return;
    }

    detachEscapeListener();
  },
  {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  detachEscapeListener();
});
</script>

<template>
  <Teleport to="body">
    <transition name="app-modal">
      <div v-if="isOpen" class="app-modal" @click.self="emit('close')">
        <DbrCard class="app-modal__card" :style="dialogStyle">
          <header class="app-modal__header">
            <span class="app-modal__header-spacer" aria-hidden="true"></span>

            <h2 class="app-modal__title dbru-text-lg dbru-text-main">
              {{ title }}
            </h2>

            <AppIconButton
              :icon-src="xIcon"
              label="Закрыть модальное окно"
              icon-alt=""
              @click="emit('close')"
            />
          </header>

          <div class="app-modal__body">
            <slot />
          </div>
        </DbrCard>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.app-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dbru-space-4);
  backdrop-filter: blur(12px);
}

.app-modal__card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(100%, var(--app-modal-max-width));
  max-height: calc(100dvh - (var(--dbru-space-4) * 2));
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-surface);
  box-shadow: var(--dbru-shadow-md);
  overflow: hidden;
}

.app-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--dbru-space-4);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.app-modal__header-spacer {
  display: block;
  width: var(--dbru-control-height-md);
  height: var(--dbru-control-height-md);
}

.app-modal__title {
  margin: 0;
  text-align: center;
}

.app-modal__body {
  display: grid;
  gap: var(--dbru-space-4);
  min-height: 0;
  padding: var(--dbru-space-5) var(--dbru-space-6) var(--dbru-space-6);
  overflow: auto;
  min-width: 0;
}

.app-modal__body :deep(form),
.app-modal__body :deep(.dbru-input) {
  width: 100%;
  min-width: 0;
}

.app-modal__body :deep(.dbru-input__field) {
  box-sizing: border-box;
}

.app-modal-enter-active,
.app-modal-leave-active {
  transition: opacity 180ms ease;
}

.app-modal-enter-active .app-modal__card,
.app-modal-leave-active .app-modal__card {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-from .app-modal__card,
.app-modal-leave-to .app-modal__card {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}

@media (max-width: 640px) {
  .app-modal {
    padding: var(--dbru-space-3);
  }

  .app-modal__card {
    max-height: calc(100dvh - (var(--dbru-space-3) * 2));
  }

  .app-modal__header {
    padding: var(--dbru-space-5) var(--dbru-space-5) var(--dbru-space-4);
  }

  .app-modal__body {
    padding: var(--dbru-space-4) var(--dbru-space-5) var(--dbru-space-5);
  }
}
</style>
