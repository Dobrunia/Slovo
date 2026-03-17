<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { DbrAvatar, DbrButton, DbrCard } from "dobruniaui-vue";
import xIcon from "../../assets/icons/x.svg";
import AppHeadingBlock from "../../components/base/AppHeadingBlock.vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
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
  <Teleport to="body">
    <transition name="settings-modal">
      <div v-if="isOpen" class="settings-modal" @click.self="emit('close')">
        <div class="settings-modal__dialog">
          <DbrCard class="settings-modal__card">
            <div class="settings-modal__surface">
              <header class="settings-modal__header">
                <AppHeadingBlock
                  class="settings-modal__heading"
                  eyebrow="Настройки"
                  title="Профиль"
                />

                <AppIconButton
                  :icon-src="xIcon"
                  label="Закрыть настройки"
                  icon-alt=""
                  @click="emit('close')"
                />
              </header>

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
            </div>
          </DbrCard>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.settings-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dbru-space-4);
  backdrop-filter: blur(12px);
}

.settings-modal__dialog {
  width: min(100%, 34rem);
}

.settings-modal__card {
  width: 100%;
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-surface);
  box-shadow: var(--dbru-shadow-md);
}

.settings-modal__surface {
  display: grid;
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-6);
  color: var(--dbru-color-text);
}

.settings-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dbru-space-4);
}

.settings-modal__heading {
  flex: 1 1 auto;
}

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

.settings-modal-enter-active,
.settings-modal-leave-active {
  transition: opacity 180ms ease;
}

.settings-modal-enter-active .settings-modal__dialog,
.settings-modal-leave-active .settings-modal__dialog {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.settings-modal-enter-from,
.settings-modal-leave-to {
  opacity: 0;
}

.settings-modal-enter-from .settings-modal__dialog,
.settings-modal-leave-to .settings-modal__dialog {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}

@media (max-width: 640px) {
  .settings-modal {
    padding: var(--dbru-space-3);
  }

  .settings-modal__surface {
    gap: var(--dbru-space-4);
    padding: var(--dbru-space-5);
  }

  .settings-modal__profile {
    align-items: flex-start;
  }
}
</style>
