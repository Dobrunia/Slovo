<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { DbrAvatar, DbrButton, DbrInput } from "dobruniaui-vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import AppModalLayout from "../../components/base/AppModalLayout.vue";
import { useServerModuleStore } from "../../stores/serverModule";
import type { ServerMembershipRole } from "../../types/server";
import checkIcon from "../../assets/icons/check.svg";
import copyIcon from "../../assets/icons/copy.svg";
import refreshIcon from "../../assets/icons/refresh.svg";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const serverModuleStore = useServerModuleStore();
const draftName = ref("");
const draftAvatarUrl = ref("");
const draftInviteLink = ref("");
const isCopySucceeded = ref(false);
const isRegeneratingInviteLink = ref(false);
const copyResetTimeoutId = ref<number | null>(null);
const regenerateTimeoutId = ref<number | null>(null);

const currentServer = computed(() => serverModuleStore.snapshot?.server ?? null);
const previewName = computed(() => {
  const normalizedValue = draftName.value.trim();
  return normalizedValue.length > 0 ? normalizedValue : currentServer.value?.name ?? "Сервер";
});
const previewAvatarUrl = computed(() => {
  const normalizedValue = normalizeOptionalText(draftAvatarUrl.value);
  return normalizedValue ?? currentServer.value?.avatarUrl ?? undefined;
});
const canManageServer = computed(() =>
  isManagerRole(currentServer.value?.role),
);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      syncDraftWithCurrentServer();
    }
  },
  { immediate: true },
);

watch(currentServer, () => {
  if (props.isOpen) {
    syncDraftWithCurrentServer();
  }
});

onBeforeUnmount(() => {
  clearScheduledStateReset(copyResetTimeoutId.value);
  clearScheduledStateReset(regenerateTimeoutId.value);
});

/**
 * Синхронизирует черновики модального окна с текущим выбранным сервером.
 */
function syncDraftWithCurrentServer(): void {
  draftName.value = currentServer.value?.name ?? "";
  draftAvatarUrl.value = currentServer.value?.avatarUrl ?? "";
  draftInviteLink.value = buildPlaceholderInviteLink(currentServer.value?.id ?? "server");
  isCopySucceeded.value = false;
}

/**
 * Копирует текущую пригласительную ссылку и временно показывает успешное состояние кнопки.
 */
async function handleCopyInviteLink(): Promise<void> {
  if (!draftInviteLink.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(draftInviteLink.value);
    isCopySucceeded.value = true;
    clearScheduledStateReset(copyResetTimeoutId.value);
    copyResetTimeoutId.value = window.setTimeout(() => {
      isCopySucceeded.value = false;
      copyResetTimeoutId.value = null;
    }, 1600);
  } catch {
    isCopySucceeded.value = false;
  }
}

/**
 * Имитирует локальную перегенерацию invite link без серверной логики.
 */
async function handleRegenerateInviteLink(): Promise<void> {
  if (!canManageServer.value || isRegeneratingInviteLink.value) {
    return;
  }

  isRegeneratingInviteLink.value = true;
  clearScheduledStateReset(regenerateTimeoutId.value);

  await new Promise<void>((resolve) => {
    regenerateTimeoutId.value = window.setTimeout(() => {
      draftInviteLink.value = buildPlaceholderInviteLink(currentServer.value?.id ?? "server");
      isRegeneratingInviteLink.value = false;
      regenerateTimeoutId.value = null;
      resolve();
    }, 900);
  });
}

/**
 * Закрывает модальное окно.
 */
function closeModal(): void {
  emit("close");
}

/**
 * Оставляет заглушку сохранения до серверной реализации.
 */
function handleSave(): void {
  // Серверная логика редактирования сервера будет добавлена позже.
}

/**
 * Нормализует необязательный текстовый ввод.
 */
function normalizeOptionalText(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

/**
 * Определяет, есть ли у участника права управления сервером.
 */
function isManagerRole(role: ServerMembershipRole | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Создает локальную placeholder-пригласительную ссылку для визуального сценария.
 */
function buildPlaceholderInviteLink(serverId: string): string {
  const invitePart = `${serverId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return `https://slovo.local/invite/${invitePart}`;
}

/**
 * Сбрасывает ранее запланированный таймер локального UI-состояния.
 */
function clearScheduledStateReset(timeoutId: number | null): void {
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }
}
</script>

<template>
  <AppModalLayout
    :is-open="isOpen"
    title="Настройки сервера"
    @close="closeModal"
  >
    <section class="server-settings-modal__profile">
      <DbrAvatar
        size="lg"
        shape="rounded"
        :name="previewName"
        :src="previewAvatarUrl"
      />

      <div class="server-settings-modal__profile-text">
        <h3 class="dbru-text-base dbru-text-main server-settings-modal__title">
          {{ previewName }}
        </h3>
        <p class="dbru-text-sm dbru-text-muted server-settings-modal__meta">
          Редактирование сервера
        </p>
      </div>
    </section>

    <section class="server-settings-modal__form">
      <DbrInput
        v-model="draftName"
        label="Название сервера"
        name="server-name"
        autocomplete="organization"
      />

      <DbrInput
        v-model="draftAvatarUrl"
        label="Ссылка на аватар"
        name="server-avatar-url"
        autocomplete="url"
      />

      <div class="server-settings-modal__invite-block">
        <div class="server-settings-modal__invite-row">
          <div class="server-settings-modal__invite-input-wrap">
            <DbrInput
              :model-value="draftInviteLink"
              label="Пригласительная ссылка"
              name="server-invite-link"
              disabled
            />
          </div>

          <AppIconButton
            :icon-src="isCopySucceeded ? checkIcon : copyIcon"
            :tone="isCopySucceeded ? 'success' : 'default'"
            label="Скопировать пригласительную ссылку"
            @click="handleCopyInviteLink"
          />
        </div>

        <div class="server-settings-modal__invite-actions">
          <AppIconButton
            v-if="canManageServer"
            :icon-src="refreshIcon"
            :spinning="isRegeneratingInviteLink"
            label="Перегенерировать пригласительную ссылку"
            @click="handleRegenerateInviteLink"
          >
            Перегенерировать
          </AppIconButton>
        </div>
      </div>
    </section>

    <footer class="server-settings-modal__footer">
      <DbrButton disabled @click="handleSave">Сохранить</DbrButton>
    </footer>
  </AppModalLayout>
</template>

<style scoped>
.server-settings-modal__profile {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-4);
}

.server-settings-modal__profile-text {
  display: grid;
  gap: var(--dbru-space-2);
  min-width: 0;
}

.server-settings-modal__title,
.server-settings-modal__meta {
  margin: 0;
}

.server-settings-modal__form {
  display: grid;
  gap: var(--dbru-space-3);
}

.server-settings-modal__invite-block {
  display: grid;
  gap: var(--dbru-space-3);
}

.server-settings-modal__invite-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-3);
  align-items: center;
}

.server-settings-modal__invite-input-wrap {
  min-width: 0;
}

.server-settings-modal__invite-actions {
  display: flex;
  align-items: center;
}

.server-settings-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .server-settings-modal__profile {
    align-items: flex-start;
  }

  .server-settings-modal__invite-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .server-settings-modal__footer :deep(.dbru-button) {
    width: 100%;
  }
}
</style>
