<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { DbrAvatar, DbrButton } from "dobruniaui-vue";
import AppModalLayout from "../../components/base/AppModalLayout.vue";
import { useAuthStore } from "../../stores/auth";
import { useServersStore } from "../../stores/servers";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();
const authStore = useAuthStore();
const serversStore = useServersStore();

const profileName = computed(() => authStore.currentUser?.displayName ?? "Пользователь");
const profileHandle = computed(() =>
  authStore.currentUser?.username ? `@${authStore.currentUser.username}` : "@slovo-user",
);
const profileEmail = computed(() => authStore.currentUser?.email ?? "Email не указан");

/**
 * Завершает текущую сессию и возвращает пользователя к экрану входа.
 */
async function handleLogout(): Promise<void> {
  authStore.logout();
  serversStore.reset();
  emit("close");
  await router.replace("/login");
}
</script>

<template>
  <AppModalLayout
    :is-open="isOpen"
    title="Профиль"
    @close="emit('close')"
  >
    <section class="settings-modal__profile">
      <DbrAvatar
        size="lg"
        :name="profileName"
        :src="authStore.currentUser?.avatarUrl ?? undefined"
      />

      <div class="settings-modal__info">
        <h3 class="settings-modal__name dbru-text-base dbru-text-main">
          {{ profileName }}
        </h3>
        <p class="settings-modal__meta dbru-text-sm dbru-text-muted">
          {{ profileHandle }}
        </p>
        <p class="settings-modal__meta dbru-text-sm dbru-text-muted">
          {{ profileEmail }}
        </p>
      </div>
    </section>

    <section class="settings-modal__body">
      <p class="settings-modal__copy dbru-text-sm dbru-text-muted">
        Здесь позже появятся настройки имени, аватара и персональных параметров.
      </p>
    </section>

    <footer class="settings-modal__footer">
      <DbrButton variant="danger" @click="handleLogout">Выйти из аккаунта</DbrButton>
    </footer>
  </AppModalLayout>
</template>

<style scoped>
.settings-modal__profile {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-4);
}

.settings-modal__info {
  display: grid;
  gap: var(--dbru-space-2);
}

.settings-modal__name {
  margin: 0;
}

.settings-modal__meta {
  margin: 0;
}

.settings-modal__body {
  display: grid;
  gap: var(--dbru-space-3);
}

.settings-modal__copy {
  margin: 0;
}

.settings-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .settings-modal__profile {
    align-items: flex-start;
  }
}
</style>
