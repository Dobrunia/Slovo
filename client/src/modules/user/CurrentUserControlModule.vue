<script setup lang="ts">
import { computed, ref } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import headphonesIcon from "../../assets/icons/headphones.svg";
import headphonesOffIcon from "../../assets/icons/headphones-off.svg";
import micIcon from "../../assets/icons/mic.svg";
import micOffIcon from "../../assets/icons/mic-off.svg";
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
        :icon-src="isMicrophoneMuted ? micOffIcon : micIcon"
        :label="isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон'"
        :tone="isMicrophoneMuted ? 'danger' : 'default'"
        icon-alt=""
        @click="toggleMicrophone"
      />

      <AppIconButton
        :icon-src="isHeadphonesMuted ? headphonesOffIcon : headphonesIcon"
        :label="isHeadphonesMuted ? 'Включить наушники' : 'Выключить наушники'"
        :tone="isHeadphonesMuted ? 'danger' : 'default'"
        icon-alt=""
        @click="toggleHeadphones"
      />
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

@media (max-width: 640px) {
  .current-user-control-module {
    padding: var(--dbru-space-4);
  }
}
</style>
