<script setup lang="ts">
import { computed } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import { useAuthStore } from "../../stores/auth";
import { useServerModuleStore } from "../../stores/serverModule";
import phoneDownIcon from "../../assets/icons/phone-down.svg";
import screenShareIcon from "../../assets/icons/screen-share.svg";
import screenShareOffIcon from "../../assets/icons/screen-share-off.svg";
import micIcon from "../../assets/icons/mic.svg";
import micOffIcon from "../../assets/icons/mic-off.svg";
import headphonesIcon from "../../assets/icons/headphones.svg";
import headphonesOffIcon from "../../assets/icons/headphones-off.svg";

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
  return currentUser.value?.username ? `@${currentUser.value.username}` : "";
});

/**
 * Выполняет выход из текущего голосового канала.
 */
async function handleLeaveChannel(): Promise<void> {
  try {
    await serverModuleStore.leaveCurrentChannel();
  } catch {
    // Ошибка уже отражается через store/runtime error state.
  }
}

/**
 * Переключает состояние микрофона текущего пользователя.
 */
async function handleToggleMute(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  const nextMuted = !(currentVoiceState.value.muted || currentVoiceState.value.deafened);
  try {
    await serverModuleStore.setSelfMuted(nextMuted);
  } catch {
    // Ошибка уже отражается через store/runtime error state.
  }
}

/**
 * Переключает состояние полного отключения звука текущего пользователя.
 */
async function handleToggleDeafen(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  try {
    await serverModuleStore.setSelfDeafened(!currentVoiceState.value.deafened);
  } catch {
    // Ошибка уже отражается через store/runtime error state.
  }
}

/**
 * Переключает демонстрацию экрана текущего пользователя.
 */
async function handleToggleScreenShare(): Promise<void> {
  if (!currentUserPresence.value) {
    return;
  }

  try {
    await serverModuleStore.setScreenShareActive(!currentUserScreenShareState.value);
  } catch {
    // Ошибка уже отражается через store/runtime error state.
  }
}
</script>

<template>
  <section class="current-user-control-module">
    <template v-if="currentUser">
      <div
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

      <div class="current-user-control-module__spacer" />

      <div class="current-user-control-module__controls">
        <AppIconButton
          :icon-src="currentVoiceState.muted || currentVoiceState.deafened ? micOffIcon : micIcon"
          :label="
            currentVoiceState.muted || currentVoiceState.deafened
              ? 'Включить микрофон'
              : 'Выключить микрофон'
          "
          icon-alt=""
          :tone="currentVoiceState.muted || currentVoiceState.deafened ? 'danger' : 'default'"
          :disabled="!currentUserPresence"
          class="current-user-control-module__action-button"
          @click="handleToggleMute"
        />

        <AppIconButton
          :icon-src="currentVoiceState.deafened ? headphonesOffIcon : headphonesIcon"
          :label="
            currentVoiceState.deafened
              ? 'Включить звук в наушниках'
              : 'Полностью отключить звук'
          "
          icon-alt=""
          :tone="currentVoiceState.deafened ? 'danger' : 'default'"
          :disabled="!currentUserPresence"
          class="current-user-control-module__action-button"
          @click="handleToggleDeafen"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.current-user-control-module {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-height: calc(var(--dbru-control-height-md) + (var(--dbru-space-4) * 2));
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
  background: var(--dbru-color-bg);
}

.current-user-control-module__identity {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.current-user-control-module__identity--speaking {
  color: var(--dbru-color-success);
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

.current-user-control-module__spacer {
  flex: 1 1 auto;
}

.current-user-control-module__action-button {
  flex: 0 0 auto;
}

@media (width <= 640px) {
  .current-user-control-module {
    padding: var(--dbru-space-3) var(--dbru-space-4);
  }
}
</style>
