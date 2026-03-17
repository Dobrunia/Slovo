<script setup lang="ts">
import { computed, ref } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import rawHeadphonesIcon from "../../assets/icons/headphones.svg?raw";
import rawHeadphonesOffIcon from "../../assets/icons/headphones-off.svg?raw";
import rawMicIcon from "../../assets/icons/mic.svg?raw";
import rawMicOffIcon from "../../assets/icons/mic-off.svg?raw";
import AppHeadingBlock from "../../components/base/AppHeadingBlock.vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import { useAuthStore } from "../../stores/auth";

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
 * Нормализует SVG-иконку для inline-render и переводит цвета в currentColor.
 */
function sanitizeIconMarkup(markup: string): string {
  return markup
    .replace(/<rect[\s\S]*?\/>/gi, "")
    .replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"');
}
</script>

<template>
  <section class="current-user-control-module">
    <div class="current-user-control-module__profile">
      <DbrAvatar
        size="md"
        shape="rounded"
        :name="profileName"
        :src="authStore.currentUser?.avatarUrl ?? undefined"
      />

      <AppHeadingBlock
        class="current-user-control-module__copy"
        :title="profileName"
        :description="profileHandle"
        title-tag="h2"
        title-size="base"
      />
    </div>

    <div class="current-user-control-module__actions">
      <AppIconButton
        :label="isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон'"
        :tone="isMicrophoneMuted ? 'danger' : 'default'"
        @click="toggleMicrophone"
      >
        <template #icon>
          <span
            class="current-user-control-module__icon"
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
            class="current-user-control-module__icon"
            aria-hidden="true"
            v-html="headphonesMarkup"
          />
        </template>
      </AppIconButton>
    </div>
  </section>
</template>

<style scoped>
.current-user-control-module {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dbru-space-4);
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
  background: var(--dbru-color-bg);
}

.current-user-control-module__profile {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.current-user-control-module__copy {
  min-width: 0;
}

.current-user-control-module__copy :deep(.app-heading-block__title),
.current-user-control-module__copy :deep(.app-heading-block__description) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-user-control-module__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
  flex-shrink: 0;
}

.current-user-control-module__icon {
  display: inline-flex;
  width: 1.375rem;
  height: 1.375rem;
}

.current-user-control-module__icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
  stroke: currentColor;
  overflow: visible;
}

@media (max-width: 640px) {
  .current-user-control-module {
    padding: var(--dbru-space-4);
  }
}
</style>
