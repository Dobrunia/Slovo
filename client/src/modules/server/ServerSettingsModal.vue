<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { DbrAvatar, DbrButton, DbrInput } from "dobruniaui-vue";
import AppModalLayout from "../../components/base/AppModalLayout.vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import copyIcon from "../../assets/icons/copy.svg";
import checkIcon from "../../assets/icons/check.svg";
import refreshIcon from "../../assets/icons/refresh.svg";
import type { ClientServerListItem } from "../../types/server";

interface ServerSettingsModalProps {
  isOpen: boolean;
  server: ClientServerListItem | null;
}

const props = defineProps<ServerSettingsModalProps>();

const emit = defineEmits<{
  close: [];
}>();

const draftServerName = ref("");
const draftAvatarUrl = ref("");
const draftInviteLink = ref("");
const isCopySuccess = ref(false);
const isRegeneratingInviteLink = ref(false);
let copySuccessTimeoutId: number | null = null;

/**
 * Возвращает отображаемое имя сервера для превью модального окна.
 */
const previewServerName = computed(() => {
  const normalizedValue = draftServerName.value.trim();
  return normalizedValue.length > 0 ? normalizedValue : props.server?.name ?? "Сервер";
});

/**
 * Возвращает отображаемый avatar URL для превью модального окна.
 */
const previewAvatarUrl = computed(() => {
  const normalizedValue = draftAvatarUrl.value.trim();
  return normalizedValue.length > 0 ? normalizedValue : props.server?.avatarUrl ?? undefined;
});

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      clearCopySuccessState();
      isRegeneratingInviteLink.value = false;
      return;
    }

    syncDraftWithServer();
  },
  {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  clearCopySuccessState();
});

/**
 * Синхронизирует локальные поля формы с выбранным сервером.
 */
function syncDraftWithServer(): void {
  draftServerName.value = props.server?.name ?? "";
  draftAvatarUrl.value = props.server?.avatarUrl ?? "";
  draftInviteLink.value = createInviteLinkPlaceholder(props.server);
  isRegeneratingInviteLink.value = false;
  clearCopySuccessState();
}

/**
 * Генерирует новое локальное placeholder-значение пригласительной ссылки
 * и крутит иконку до завершения операции, как это будет работать с реальным API позже.
 */
async function regenerateInviteLink(): Promise<void> {
  if (isRegeneratingInviteLink.value) {
    return;
  }

  isRegeneratingInviteLink.value = true;
  clearCopySuccessState();

  try {
    await wait(960);
    draftInviteLink.value = createInviteLinkPlaceholder(props.server);
  } finally {
    isRegeneratingInviteLink.value = false;
  }
}

/**
 * Копирует текущую пригласительную ссылку в буфер обмена, если API доступен,
 * и переводит кнопку в success-состояние для визуальной обратной связи.
 */
async function copyInviteLink(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(draftInviteLink.value);
    }
  } catch {
    // UI-заглушка не должна падать из-за недоступного clipboard API.
  }

  setCopySuccessState();
}

/**
 * Переводит кнопку копирования во временное success-состояние.
 */
function setCopySuccessState(): void {
  clearCopySuccessState();
  isCopySuccess.value = true;
  copySuccessTimeoutId = window.setTimeout(() => {
    isCopySuccess.value = false;
    copySuccessTimeoutId = null;
  }, 1600);
}

/**
 * Сбрасывает success-состояние кнопки копирования и очищает таймер.
 */
function clearCopySuccessState(): void {
  isCopySuccess.value = false;

  if (copySuccessTimeoutId !== null) {
    window.clearTimeout(copySuccessTimeoutId);
    copySuccessTimeoutId = null;
  }
}

/**
 * Создает локальную placeholder-ссылку приглашения для визуального состояния формы.
 */
function createInviteLinkPlaceholder(server: ClientServerListItem | null): string {
  const serverKey = server?.id ?? "slovo";
  const suffix = Math.random().toString(36).slice(2, 10);
  return `https://slovo.app/invite/${serverKey}-${suffix}`;
}

/**
 * Создает асинхронную задержку для имитации будущей серверной перегенерации.
 */
function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
</script>

<template>
  <AppModalLayout
    :is-open="isOpen"
    title="Настройки сервера"
    @close="emit('close')"
  >
    <section class="server-settings-modal__profile">
      <DbrAvatar
        size="lg"
        shape="rounded"
        :name="previewServerName"
        :src="previewAvatarUrl"
      />

      <div class="server-settings-modal__info">
        <h3 class="server-settings-modal__name dbru-text-base dbru-text-main">
          {{ previewServerName }}
        </h3>
        <p class="server-settings-modal__copy dbru-text-sm dbru-text-muted">
          Здесь позже появится серверная логика сохранения.
        </p>
      </div>
    </section>

    <section class="server-settings-modal__form">
      <DbrInput
        v-model="draftServerName"
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

      <div class="server-settings-modal__invite">
        <div class="server-settings-modal__invite-row">
          <div class="server-settings-modal__invite-input">
            <DbrInput
              v-model="draftInviteLink"
              label="Пригласительная ссылка"
              name="invite-link"
              autocomplete="off"
            />
          </div>

          <AppIconButton
            :icon-src="isCopySuccess ? checkIcon : copyIcon"
            :tone="isCopySuccess ? 'success' : 'default'"
            :label="isCopySuccess ? 'Ссылка скопирована' : 'Скопировать ссылку'"
            icon-alt=""
            @click="copyInviteLink"
          />
        </div>

        <div class="server-settings-modal__invite-actions">
          <AppIconButton
            :icon-src="refreshIcon"
            :spinning="isRegeneratingInviteLink"
            label="Перегенерировать ссылку"
            icon-alt=""
            @click="regenerateInviteLink"
          >
            <span class="dbru-text-sm dbru-text-main">Перегенерировать</span>
          </AppIconButton>
        </div>
      </div>
    </section>

    <footer class="server-settings-modal__footer">
      <DbrButton disabled>Сохранить</DbrButton>
    </footer>
  </AppModalLayout>
</template>

<style scoped>
.server-settings-modal__profile {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-4);
}

.server-settings-modal__info {
  display: grid;
  gap: var(--dbru-space-2);
  min-width: 0;
}

.server-settings-modal__name,
.server-settings-modal__copy {
  margin: 0;
}

.server-settings-modal__form {
  display: grid;
  gap: var(--dbru-space-4);
}

.server-settings-modal__invite {
  display: grid;
  gap: var(--dbru-space-3);
}

.server-settings-modal__invite-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--dbru-space-3);
}

.server-settings-modal__invite-input {
  min-width: 0;
}

.server-settings-modal__invite-actions {
  display: flex;
  justify-content: flex-start;
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
    align-items: stretch;
  }

  .server-settings-modal__footer {
    justify-content: stretch;
  }

  .server-settings-modal__footer :deep(.dbru-btn) {
    width: 100%;
  }
}
</style>
