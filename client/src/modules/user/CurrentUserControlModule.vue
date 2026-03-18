<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { DbrAvatar } from "dobruniaui-vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import { buildAppServerRoute } from "../../router/serverRoutes";
import { useAuthStore } from "../../stores/auth";
import { useServerModuleStore } from "../../stores/serverModule";
import headphonesIcon from "../../assets/icons/headphones.svg";
import headphonesOffIcon from "../../assets/icons/headphones-off.svg";
import micIcon from "../../assets/icons/mic.svg";
import micOffIcon from "../../assets/icons/mic-off.svg";
import phoneDownIcon from "../../assets/icons/phone-down.svg";

const router = useRouter();
const authStore = useAuthStore();
const serverModuleStore = useServerModuleStore();
const isMicrophoneMuted = ref(false);
const isHeadphonesMuted = ref(false);

/**
 * Возвращает отображаемое имя текущего пользователя.
 */
const displayName = computed(
  () => authStore.currentUser?.displayName ?? "Пользователь",
);

/**
 * Возвращает username в формате handle.
 */
const handle = computed(() => {
  const username = authStore.currentUser?.username;
  return username ? `@${username}` : "@slovo-user";
});

/**
 * Показывает hangup-кнопку только пока пользователь реально находится в канале.
 */
const hasActiveChannelPresence = computed(() => Boolean(serverModuleStore.currentUserPresence));

/**
 * Выводит пользователя из текущего канала и возвращает URL к самому серверу.
 */
async function handleLeaveChannel(): Promise<void> {
  if (!serverModuleStore.currentUserPresence || !serverModuleStore.selectedServerId) {
    return;
  }

  try {
    await serverModuleStore.leaveCurrentChannel();
    await router.replace(buildAppServerRoute(serverModuleStore.selectedServerId));
  } catch {
    // Ошибка уже отражена в store.
  }
}
</script>

<template>
  <section class="current-user-control-module">
    <div class="current-user-control-module__identity">
      <DbrAvatar
        size="sm"
        :name="displayName"
        :src="authStore.currentUser?.avatarUrl ?? undefined"
      />

      <div class="current-user-control-module__text">
        <p class="current-user-control-module__name dbru-text-base dbru-text-main">
          {{ displayName }}
        </p>
        <p class="current-user-control-module__handle dbru-text-sm dbru-text-muted">
          {{ handle }}
        </p>
      </div>
    </div>

    <div class="current-user-control-module__session-actions">
      <AppIconButton
        v-if="hasActiveChannelPresence"
        :icon-src="phoneDownIcon"
        label="Покинуть канал"
        icon-alt=""
        tone="danger"
        @click="handleLeaveChannel"
      />
    </div>

    <div class="current-user-control-module__controls">
      <AppIconButton
        :icon-src="isMicrophoneMuted ? micOffIcon : micIcon"
        :label="isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон'"
        icon-alt=""
        :tone="isMicrophoneMuted ? 'danger' : 'default'"
        @click="isMicrophoneMuted = !isMicrophoneMuted"
      />

      <AppIconButton
        :icon-src="isHeadphonesMuted ? headphonesOffIcon : headphonesIcon"
        :label="isHeadphonesMuted ? 'Включить звук' : 'Выключить звук'"
        icon-alt=""
        :tone="isHeadphonesMuted ? 'danger' : 'default'"
        @click="isHeadphonesMuted = !isHeadphonesMuted"
      />
    </div>
  </section>
</template>

<style scoped>
.current-user-control-module {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-4);
  background: var(--dbru-color-bg);
  border-top: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.current-user-control-module__identity {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.current-user-control-module__text {
  display: grid;
  gap: var(--dbru-space-1);
  min-width: 0;
}

.current-user-control-module__name,
.current-user-control-module__handle {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.current-user-control-module__session-actions,
.current-user-control-module__controls {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
}

.current-user-control-module__session-actions {
  min-width: 2.5rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .current-user-control-module {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "identity session"
      "controls controls";
  }

  .current-user-control-module__identity {
    grid-area: identity;
  }

  .current-user-control-module__session-actions {
    grid-area: session;
  }

  .current-user-control-module__controls {
    grid-area: controls;
    justify-content: flex-end;
  }
}
</style>
