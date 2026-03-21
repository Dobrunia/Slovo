<script setup lang="ts">
import { computed } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import { useAuthStore } from "../../stores/auth";
import { useServerModuleStore } from "../../stores/serverModule";
import phoneDownIcon from "../../assets/icons/phone-down.svg";
import screenShareIcon from "../../assets/icons/screen-share.svg";
import screenShareOffIcon from "../../assets/icons/screen-share-off.svg";

const authStore = useAuthStore();
const serverModuleStore = useServerModuleStore();

/**
 * Возвращает текущего пользователя из auth store.
 */
const currentUser = computed(() => authStore.currentUser);

/**
 * Возвращает active voice presence текущего пользователя.
 */
const currentUserPresence = computed(() => serverModuleStore.currentUserPresence);

/**
 * Возвращает voice state текущего пользователя.
 */
const currentVoiceState = computed(() => serverModuleStore.currentVoiceState);

/**
 * Возвращает локальное состояние активной демонстрации экрана.
 */
const currentUserScreenShareState = computed(() => serverModuleStore.currentUserScreenShareState);

/**
 * Возвращает подпись под именем пользователя в control panel.
 */
const secondaryLabel = computed(() => {
  if (currentUserPresence.value) {
    return "Подключен к голосовому каналу";
  }

  return currentUser.value?.username ?? "";
});

/**
 * Выполняет выход из текущего голосового канала.
 */
async function handleLeaveChannel(): Promise<void> {
  await serverModuleStore.leaveCurrentChannel();
}

/**
 * Переключает состояние микрофона текущего пользователя.
 */
async function handleToggleMute(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  const nextMuted = !(currentVoiceState.value.muted || currentVoiceState.value.deafened);
  await serverModuleStore.setSelfMuted(nextMuted);
}

/**
 * Переключает состояние полного отключения звука текущего пользователя.
 */
async function handleToggleDeafen(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  await serverModuleStore.setSelfDeafened(!currentVoiceState.value.deafened);
}

/**
 * Переключает демонстрацию экрана текущего пользователя.
 */
async function handleToggleScreenShare(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  await serverModuleStore.setScreenShareActive(!currentUserScreenShareState.value);
}
</script>

<template>
  <section class="current-user-control-module">
    <div
      v-if="currentUser"
      class="current-user-control-module__identity"
      :class="{
        'current-user-control-module__identity--speaking': currentVoiceState.speaking,
      }"
    >
      <DbrAvatar
        size="md"
        :name="currentUser.displayName"
        :src="currentUser.avatarUrl ?? undefined"
      />

      <div class="current-user-control-module__copy">
        <p class="current-user-control-module__display-name dbru-text-sm dbru-text-main">
          {{ currentUser.displayName }}
        </p>
        <p class="current-user-control-module__secondary dbru-text-xs dbru-text-muted">
          {{ secondaryLabel }}
        </p>
      </div>

      <div
        v-if="currentUserPresence"
        class="current-user-control-module__session-actions"
      >
        <AppIconButton
          :icon-src="currentUserScreenShareState ? screenShareOffIcon : screenShareIcon"
          :label="
            currentUserScreenShareState
              ? 'Остановить демонстрацию экрана'
              : 'Начать демонстрацию экрана'
          "
          icon-alt=""
          :tone="currentUserScreenShareState ? 'danger' : 'default'"
          @click="handleToggleScreenShare"
        />

        <AppIconButton
          :icon-src="phoneDownIcon"
          label="Покинуть голосовой канал"
          icon-alt=""
          tone="danger"
          @click="handleLeaveChannel"
        />
      </div>
    </div>

    <div class="current-user-control-module__controls">
      <button
        type="button"
        class="current-user-control-module__toggle dbru-reduced-motion"
        :class="{
          'current-user-control-module__toggle--off':
            currentVoiceState.muted || currentVoiceState.deafened,
        }"
        :disabled="!currentUserPresence"
        aria-label="Переключить микрофон"
        @click="handleToggleMute"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
          <path d="M19 11a7 7 0 0 1-12.02 4.95" />
          <path d="M5 11a7 7 0 0 0 11.66 5.03" />
          <path d="M12 18v3" />
          <path d="M8 21h8" />
          <path
            v-if="currentVoiceState.muted || currentVoiceState.deafened"
            d="M4 4l16 16"
          />
        </svg>
      </button>

      <button
        type="button"
        class="current-user-control-module__toggle dbru-reduced-motion"
        :class="{
          'current-user-control-module__toggle--off': currentVoiceState.deafened,
        }"
        :disabled="!currentUserPresence"
        aria-label="Переключить полное отключение звука"
        @click="handleToggleDeafen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 14v-4a2 2 0 0 1 2-2h3l4-4v16l-4-4H5a2 2 0 0 1-2-2Z" />
          <path d="M14 9a5 5 0 0 1 0 6" />
          <path d="M17 6a9 9 0 0 1 0 12" />
          <path v-if="currentVoiceState.deafened" d="M4 4l16 16" />
        </svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.current-user-control-module {
  display: grid;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-4);
  border-top: var(--dbru-border-size-1) solid var(--dbru-color-border);
  background: var(--dbru-color-bg);
}

.current-user-control-module__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-3);
  border-radius: var(--dbru-radius-lg);
  background: var(--dbru-color-surface);
}

.current-user-control-module__identity--speaking {
  box-shadow: inset 0 0 0 1px var(--dbru-color-success);
}

.current-user-control-module__copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.current-user-control-module__display-name,
.current-user-control-module__secondary {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-user-control-module__session-actions,
.current-user-control-module__controls {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-2);
}

.current-user-control-module__controls {
  justify-content: flex-start;
}

.current-user-control-module__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: var(--dbru-radius-full);
  background: var(--dbru-color-surface);
  color: var(--dbru-color-text);
  cursor: pointer;
  transition:
    background-color var(--dbru-duration-base) var(--dbru-ease-standard),
    color var(--dbru-duration-base) var(--dbru-ease-standard),
    transform var(--dbru-duration-base) var(--dbru-ease-standard);
}

.current-user-control-module__toggle:hover:not(:disabled) {
  background: var(--dbru-color-border);
}

.current-user-control-module__toggle:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 2px;
}

.current-user-control-module__toggle:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.current-user-control-module__toggle--off {
  background: var(--dbru-color-surface);
  color: var(--dbru-color-error);
  box-shadow: inset 0 0 0 1px var(--dbru-color-error);
}

.current-user-control-module__toggle svg {
  display: block;
  width: 18px;
  height: 18px;
}
</style>
