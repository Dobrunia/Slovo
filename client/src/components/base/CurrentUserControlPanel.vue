<script setup lang="ts">
import { computed, ref } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import rawHeadphonesIcon from "../../assets/icons/headphones.svg?raw";
import rawHeadphonesOffIcon from "../../assets/icons/headphones-off.svg?raw";
import rawMicIcon from "../../assets/icons/mic.svg?raw";
import rawMicOffIcon from "../../assets/icons/mic-off.svg?raw";
import { useAuthStore } from "../../stores/auth";
import AppHeadingBlock from "./AppHeadingBlock.vue";
import AppIconButton from "./AppIconButton.vue";

const authStore = useAuthStore();
const isMicrophoneMuted = ref(false);
const isHeadphonesMuted = ref(false);

const profileName = computed(() => authStore.currentUser?.displayName ?? "Пользователь");
const profileHandle = computed(() =>
  authStore.currentUser?.username ? `@${authStore.currentUser.username}` : "@slovo-user",
);

const microphoneMarkup = computed(() =>
  isMicrophoneMuted.value ? sanitizeIconMarkup(rawMicOffIcon) : sanitizeIconMarkup(rawMicIcon),
);
const headphonesMarkup = computed(() =>
  isHeadphonesMuted.value
    ? sanitizeIconMarkup(rawHeadphonesOffIcon)
    : sanitizeIconMarkup(rawHeadphonesIcon),
);

/**
 * Переключает локальное визуальное состояние микрофона.
 */
function toggleMicrophone(): void {
  isMicrophoneMuted.value = !isMicrophoneMuted.value;
}

/**
 * Переключает локальное визуальное состояние наушников.
 */
function toggleHeadphones(): void {
  isHeadphonesMuted.value = !isHeadphonesMuted.value;
}

/**
 * Нормализует SVG-иконку для inline-render: убирает фоновые rect-элементы
 * и переводит основные stroke/fill-цвета в currentColor.
 */
function sanitizeIconMarkup(markup: string): string {
  return markup
    .replace(/<rect[\s\S]*?\/>/gi, "")
    .replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
}
</script>

<template>
  <section class="current-user-control-panel">
    <div class="current-user-control-panel__profile">
      <DbrAvatar
        size="md"
        shape="rounded"
        :name="profileName"
        :src="authStore.currentUser?.avatarUrl ?? undefined"
      />

      <AppHeadingBlock
        class="current-user-control-panel__copy"
        :title="profileName"
        :description="profileHandle"
        title-tag="h2"
        title-size="base"
      />
    </div>

    <div class="current-user-control-panel__actions">
      <AppIconButton
        :label="isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон'"
        :tone="isMicrophoneMuted ? 'danger' : 'default'"
        @click="toggleMicrophone"
      >
        <template #icon>
          <span
            class="current-user-control-panel__icon"
            aria-hidden="true"
            v-html="microphoneMarkup"
          />
        </template>
      </AppIconButton>

      <AppIconButton
        :label="isHeadphonesMuted ? 'Включить наушники' : 'Выключить наушники'"
        :tone="isHeadphonesMuted ? 'danger' : 'default'"
        @click="toggleHeadphones"
      >
        <template #icon>
          <span
            class="current-user-control-panel__icon"
            aria-hidden="true"
            v-html="headphonesMarkup"
          />
        </template>
      </AppIconButton>
    </div>
  </section>
</template>

<style scoped>
.current-user-control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dbru-space-4);
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.current-user-control-panel__profile {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.current-user-control-panel__copy {
  display: grid;
  gap: var(--dbru-space-1);
  min-width: 0;
}

.current-user-control-panel__copy :deep(.app-heading-block__title),
.current-user-control-panel__copy :deep(.app-heading-block__description) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-user-control-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
  flex-shrink: 0;
}

.current-user-control-panel__icon {
  display: inline-flex;
  width: 1.375rem;
  height: 1.375rem;
}

.current-user-control-panel__icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
  stroke: currentColor;
  overflow: visible;
}

@media (max-width: 640px) {
  .current-user-control-panel {
    padding: var(--dbru-space-4);
  }
}
</style>
