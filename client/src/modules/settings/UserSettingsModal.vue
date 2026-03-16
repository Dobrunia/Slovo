<template>
  <div
    v-if="isOpen"
    class="user-settings-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="user-settings-modal-title"
    @click.self="$emit('close')"
  >
    <DbrCard as="section" class="user-settings-modal__card">
      <div class="user-settings-modal__header">
        <div class="user-settings-modal__title-block">
          <p class="dbru-text-xs dbru-text-muted">Настройки пользователя</p>
          <h2 id="user-settings-modal-title" class="dbru-text-lg dbru-text-main">
            Профиль
          </h2>
        </div>

        <DbrButton
          variant="ghost"
          :native-type="'button'"
          @click="$emit('close')"
        >
          Закрыть
        </DbrButton>
      </div>

      <div class="user-settings-modal__intro">
        <DbrAvatar
          :src="authStore.currentUser?.avatarUrl ?? undefined"
          :name="authStore.currentUser?.displayName ?? authStore.currentUser?.username ?? 'Пользователь'"
          size="lg"
        />

        <div class="user-settings-modal__intro-copy">
          <h3 class="dbru-text-base dbru-text-main">
            {{ authStore.currentUser?.displayName ?? "Пользователь" }}
          </h3>
          <p class="dbru-text-sm dbru-text-muted">
            @{{ authStore.currentUser?.username ?? "guest" }}
          </p>
        </div>
      </div>

      <dl class="user-settings-modal__details">
        <div class="user-settings-modal__detail">
          <dt class="dbru-text-xs dbru-text-muted">Email</dt>
          <dd class="dbru-text-sm dbru-text-main">
            {{ authStore.currentUser?.email ?? "Неизвестно" }}
          </dd>
        </div>

        <div class="user-settings-modal__detail">
          <dt class="dbru-text-xs dbru-text-muted">Display name</dt>
          <dd class="dbru-text-sm dbru-text-main">
            {{ authStore.currentUser?.displayName ?? "Не задано" }}
          </dd>
        </div>

        <div class="user-settings-modal__detail">
          <dt class="dbru-text-xs dbru-text-muted">Username</dt>
          <dd class="dbru-text-sm dbru-text-main">
            @{{ authStore.currentUser?.username ?? "guest" }}
          </dd>
        </div>
      </dl>

      <div class="user-settings-modal__actions">
        <DbrButton
          variant="ghost"
          :native-type="'button'"
          @click="handleLogout"
        >
          Выйти
        </DbrButton>
      </div>
    </DbrCard>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { DbrAvatar, DbrButton, DbrCard } from "dobruniaui-vue";
import { LOGIN_ROUTE_PATH } from "../../constants";
import { useAuthStore } from "../../stores/auth";
import { useServersStore } from "../../stores/servers";

/**
 * Свойства модального окна пользовательских настроек.
 */
interface UserSettingsModalProps {
  isOpen: boolean;
}

defineProps<UserSettingsModalProps>();

const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();
const authStore = useAuthStore();
const serversStore = useServersStore();

/**
 * Завершает клиентскую сессию, очищает список серверов и закрывает модальное окно.
 */
async function handleLogout(): Promise<void> {
  authStore.logout();
  serversStore.reset();
  emit("close");
  await router.replace(LOGIN_ROUTE_PATH);
}
</script>

<style scoped>
.user-settings-modal {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: var(--dbru-space-6);
  background: color-mix(in srgb, var(--dbru-color-bg) 54%, transparent);
  backdrop-filter: blur(10px);
}

.user-settings-modal__card {
  width: min(100%, 34rem);
  display: grid;
  gap: var(--dbru-space-6);
  padding: var(--dbru-space-6);
  border-radius: var(--dbru-radius-md);
}

.user-settings-modal__header {
  display: flex;
  gap: var(--dbru-space-4);
  align-items: flex-start;
  justify-content: space-between;
}

.user-settings-modal__title-block,
.user-settings-modal__intro-copy {
  display: grid;
  gap: var(--dbru-space-1);
}

.user-settings-modal__title-block p,
.user-settings-modal__title-block h2,
.user-settings-modal__intro-copy h3,
.user-settings-modal__intro-copy p,
.user-settings-modal__detail dt,
.user-settings-modal__detail dd {
  margin: 0;
}

.user-settings-modal__intro {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dbru-space-4);
  align-items: center;
}

.user-settings-modal__details {
  display: grid;
  gap: var(--dbru-space-4);
  margin: 0;
}

.user-settings-modal__detail {
  display: grid;
  gap: var(--dbru-space-1);
  padding: var(--dbru-space-4);
  border-radius: var(--dbru-radius-md);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  background: color-mix(in srgb, var(--dbru-color-bg) 72%, transparent);
}

.user-settings-modal__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .user-settings-modal {
    padding: var(--dbru-space-4);
  }

  .user-settings-modal__card {
    gap: var(--dbru-space-5);
    padding: var(--dbru-space-5);
  }

  .user-settings-modal__intro {
    grid-template-columns: 1fr;
    justify-items: start;
  }
}
</style>
