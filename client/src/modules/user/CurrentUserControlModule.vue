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
 * Отображаемое имя текущего пользователя.
 */
const displayName = computed(
  () => authStore.currentUser?.displayName ?? "Пользователь",
);

/**
 * Username текущего пользователя в формате handle.
 */
const handle = computed(() => {
  const username = authStore.currentUser?.username;
  return username ? `@${username}` : "@slovo-user";
});

/**
 * Есть ли у текущего пользователя активное presence в голосовом канале.
 */
const hasActiveChannelPresence = computed(() => Boolean(serverModuleStore.currentUserPresence));

/**
 * Выводит пользователя из текущего канала и возвращает URL к серверу без channel route.
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-4) var(--dbru-space-5);
  background: var(--dbru-color-bg);
  border-bottom: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

.current-user-control-module__identity {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
  flex: 1 1 auto;
}

.current-user-control-module__text {
  display: grid;
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
}

@media (max-width: 768px) {
  .current-user-control-module {
    flex-direction: column;
    align-items: stretch;
  }

  .current-user-control-module__identity,
  .current-user-control-module__controls {
    width: 100%;
  }

  .current-user-control-module__controls {
    justify-content: flex-end;
  }
}
</style>
