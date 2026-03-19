<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { DbrAvatar, DbrButton, DbrToggle, DbrInput } from "dobruniaui-vue";
import AppModalLayout from "../../components/base/AppModalLayout.vue";
import { useUserPreferences } from "../../composables/useUserPreferences";
import { useAuthStore } from "../../stores/auth";
import { useServersStore } from "../../stores/servers";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();
const authStore = useAuthStore();
const serversStore = useServersStore();
const { isSoundEnabled } = useUserPreferences();

const profileName = computed(() => authStore.currentUser?.displayName ?? "Пользователь");
const profileHandle = computed(() =>
  authStore.currentUser?.username ? `@${authStore.currentUser.username}` : "@slovo-user",
);
const profileEmail = computed(() => authStore.currentUser?.email ?? "Email не указан");
const draftDisplayName = ref("");
const draftAvatarUrl = ref("");

const previewName = computed(() => {
  const normalizedName = draftDisplayName.value.trim();
  return normalizedName.length > 0 ? normalizedName : profileName.value;
});

const previewAvatarUrl = computed(() => {
  const normalizedAvatarUrl = normalizeDraftAvatarUrl(draftAvatarUrl.value);
  return normalizedAvatarUrl ?? undefined;
});

/**
 * Синхронизирует состояние формы с текущим пользователем при открытии модального окна.
 */
function syncDraftWithCurrentUser(): void {
  draftDisplayName.value = authStore.currentUser?.displayName ?? "";
  draftAvatarUrl.value = authStore.currentUser?.avatarUrl ?? "";
  authStore.clearProfileError();
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      syncDraftWithCurrentUser();
    }
  },
  { immediate: true },
);

/**
 * Сохраняет изменения профиля и закрывает модальное окно при успехе.
 */
async function handleSaveProfile(): Promise<void> {
  try {
    await authStore.updateProfile({
      displayName: draftDisplayName.value,
      avatarUrl: draftAvatarUrl.value,
    });
    emit("close");
  } catch {
    // Ошибка уже отражена в store и показана в модальном окне.
  }
}

/**
 * Завершает текущую сессию и возвращает пользователя к экрану входа.
 */
async function handleLogout(): Promise<void> {
  authStore.logout();
  serversStore.reset();
  emit("close");
  await router.replace("/login");
}

/**
 * Нормализует черновое значение avatar URL для превью.
 */
function normalizeDraftAvatarUrl(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
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
        :name="previewName"
        :src="previewAvatarUrl"
      />

      <div class="settings-modal__info">
        <h3 class="settings-modal__name dbru-text-base dbru-text-main">
          {{ previewName }}
        </h3>
        <p class="settings-modal__meta dbru-text-sm dbru-text-muted">
          {{ profileHandle }}
        </p>
        <p class="settings-modal__meta dbru-text-sm dbru-text-muted">
          {{ profileEmail }}
        </p>
      </div>
    </section>

    <section class="settings-modal__form">
      <DbrInput
        v-model="draftDisplayName"
        label="Отображаемое имя"
        name="display-name"
        autocomplete="nickname"
      />

      <DbrInput
        v-model="draftAvatarUrl"
        label="Ссылка на аватар"
        name="avatar-url"
        autocomplete="url"
      />

      <DbrToggle
        size="sm"
        v-model="isSoundEnabled"
        label="Включить звуки"
      />

      <p
        v-if="authStore.profileErrorMessage"
        class="settings-modal__error dbru-text-sm dbru-text-main"
      >
        {{ authStore.profileErrorMessage }}
      </p>
    </section>

    <footer class="settings-modal__footer">
      <div class="settings-modal__actions">
        <DbrButton
          :loading="authStore.isProfileUpdating"
          @click="handleSaveProfile"
        >
          Сохранить
        </DbrButton>
        <DbrButton variant="danger" @click="handleLogout">Выйти из аккаунта</DbrButton>
      </div>
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
  min-width: 0;
}

.settings-modal__name {
  margin: 0;
}

.settings-modal__meta {
  margin: 0;
}

.settings-modal__form {
  display: grid;
  gap: var(--dbru-space-3);
}

.settings-modal__error {
  margin: 0;
  color: var(--dbru-color-error);
}

.settings-modal__footer {
  display: flex;
  justify-content: flex-end;
}

.settings-modal__actions {
  display: flex;
  gap: var(--dbru-space-3);
}

@media (max-width: 640px) {
  .settings-modal__profile {
    align-items: flex-start;
  }

  .settings-modal__actions {
    width: 100%;
    flex-direction: column;
  }
}
</style>
