<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { DbrAvatar, DbrButton, DbrInput } from "dobruniaui-vue";
import AppIconButton from "../../components/base/AppIconButton.vue";
import AppHeadingBlock from "../../components/base/AppHeadingBlock.vue";
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
const newChannelName = ref("");
const channelNameDrafts = ref<Record<string, string>>({});
const isCopySucceeded = ref(false);
const copyResetTimeoutId = ref<number | null>(null);

const currentServer = computed(() => serverModuleStore.snapshot?.server ?? null);
const currentChannels = computed(() => serverModuleStore.snapshot?.channels ?? []);
const currentInviteLink = computed(() => serverModuleStore.inviteLink?.inviteLink ?? "");
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

watch(
  currentChannels,
  () => {
    if (!props.isOpen) {
      return;
    }

    syncChannelDrafts();
  },
  {
    deep: true,
  },
);

onBeforeUnmount(() => {
  clearScheduledStateReset(copyResetTimeoutId.value);
});

/**
 * Синхронизирует черновики модального окна с текущим выбранным сервером.
 */
function syncDraftWithCurrentServer(): void {
  draftName.value = currentServer.value?.name ?? "";
  draftAvatarUrl.value = currentServer.value?.avatarUrl ?? "";
  newChannelName.value = "";
  syncChannelDrafts();
  serverModuleStore.clearChannelsError();
  serverModuleStore.clearServerUpdateError();
  serverModuleStore.clearInviteLinkError();
  serverModuleStore.clearDeleteServerError();
  isCopySucceeded.value = false;

  if (canManageServer.value) {
    void serverModuleStore.loadInviteLink().catch(() => undefined);
  }
}

/**
 * Синхронизирует локальные draft-имена каналов с текущим snapshot-ом сервера.
 */
function syncChannelDrafts(): void {
  channelNameDrafts.value = Object.fromEntries(
    currentChannels.value.map((channel) => [channel.id, channel.name]),
  );
}

/**
 * Копирует текущую пригласительную ссылку и временно показывает успешное состояние кнопки.
 */
async function handleCopyInviteLink(): Promise<void> {
  if (!currentInviteLink.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentInviteLink.value);
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
 * Перевыпускает invite-ссылку текущего сервера через серверный API.
 */
async function handleRegenerateInviteLink(): Promise<void> {
  if (!canManageServer.value || serverModuleStore.isInviteLinkRegenerating) {
    return;
  }

  try {
    await serverModuleStore.regenerateInviteLink();
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
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
  if (!canManageServer.value) {
    return;
  }

  void saveServerProfile();
}

/**
 * Создает новый канал через server module store.
 */
async function handleCreateChannel(): Promise<void> {
  if (!canManageServer.value) {
    return;
  }

  try {
    await serverModuleStore.createChannel(newChannelName.value);
    newChannelName.value = "";
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
}

/**
 * Сохраняет новое имя выбранного канала.
 */
async function handleRenameChannel(channelId: string): Promise<void> {
  if (!canManageServer.value) {
    return;
  }

  try {
    await serverModuleStore.updateChannel(channelId, channelNameDrafts.value[channelId] ?? "");
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
}

/**
 * Удаляет выбранный канал сервера.
 */
async function handleDeleteChannel(channelId: string): Promise<void> {
  if (!canManageServer.value) {
    return;
  }

  try {
    await serverModuleStore.deleteChannel(channelId);
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
}

/**
 * Перемещает канал вверх или вниз и сохраняет новый порядок на сервере.
 */
async function handleMoveChannel(channelId: string, direction: -1 | 1): Promise<void> {
  if (!canManageServer.value) {
    return;
  }

  const nextChannelIds = buildReorderedChannelIds(channelId, direction);

  if (!nextChannelIds) {
    return;
  }

  try {
    await serverModuleStore.reorderChannels(nextChannelIds);
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
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
  return role === "OWNER";
}

/**
 * Сбрасывает ранее запланированный таймер локального UI-состояния.
 */
function clearScheduledStateReset(timeoutId: number | null): void {
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Сохраняет имя и аватар сервера через server module store.
 */
async function saveServerProfile(): Promise<void> {
  try {
    await serverModuleStore.updateServerProfile({
      name: draftName.value,
      avatarUrl: draftAvatarUrl.value,
    });
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
}

/**
 * Удаляет текущий сервер и закрывает модальное окно после успешного ответа.
 */
async function handleDeleteServer(): Promise<void> {
  if (!canManageServer.value) {
    return;
  }

  try {
    await serverModuleStore.deleteSelectedServer();
    closeModal();
  } catch {
    // Ошибка уже нормализована в store и показана в модалке.
  }
}

/**
 * Вычисляет новый порядок id каналов после локального перемещения выбранного элемента.
 */
function buildReorderedChannelIds(channelId: string, direction: -1 | 1): string[] | null {
  const currentIndex = currentChannels.value.findIndex((channel) => channel.id === channelId);

  if (currentIndex < 0) {
    return null;
  }

  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= currentChannels.value.length) {
    return null;
  }

  const nextChannelIds = currentChannels.value.map((channel) => channel.id);
  [nextChannelIds[currentIndex], nextChannelIds[targetIndex]] = [
    nextChannelIds[targetIndex]!,
    nextChannelIds[currentIndex]!,
  ];

  return nextChannelIds;
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

      <p
        v-if="serverModuleStore.serverUpdateErrorMessage"
        class="server-settings-modal__server-error dbru-text-sm"
      >
        {{ serverModuleStore.serverUpdateErrorMessage }}
      </p>

      <p
        v-if="serverModuleStore.inviteLinkErrorMessage"
        class="server-settings-modal__server-error dbru-text-sm"
      >
        {{ serverModuleStore.inviteLinkErrorMessage }}
      </p>

      <div class="server-settings-modal__invite-block">
        <div class="server-settings-modal__invite-row">
          <div class="server-settings-modal__invite-input-wrap">
            <DbrInput
              :model-value="currentInviteLink"
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
            :spinning="serverModuleStore.isInviteLinkRegenerating"
            label="Перегенерировать пригласительную ссылку"
            @click="handleRegenerateInviteLink"
          >
            Перегенерировать
          </AppIconButton>
        </div>
      </div>
    </section>

    <section class="server-settings-modal__channel-section">
      <AppHeadingBlock
        title="Каналы"
        description="Создавайте, переименовывайте, удаляйте и переставляйте каналы текущего сервера."
        title-size="base"
      />

      <form class="server-settings-modal__channel-create" @submit.prevent="handleCreateChannel">
        <div class="server-settings-modal__channel-create-input">
          <DbrInput
            v-model="newChannelName"
            label="Новый канал"
            name="new-server-channel"
            autocomplete="off"
          />
        </div>

        <DbrButton
          :loading="serverModuleStore.isMutatingChannels"
          :disabled="!canManageServer"
          :native-type="'submit'"
        >
          Создать канал
        </DbrButton>
      </form>

      <p
        v-if="serverModuleStore.channelsErrorMessage"
        class="server-settings-modal__channels-error dbru-text-sm"
      >
        {{ serverModuleStore.channelsErrorMessage }}
      </p>

      <div v-if="currentChannels.length > 0" class="server-settings-modal__channel-list">
        <article
          v-for="(channel, index) in currentChannels"
          :key="channel.id"
          class="server-settings-modal__channel-card"
        >
          <div class="server-settings-modal__channel-main">
            <DbrInput
              v-model="channelNameDrafts[channel.id]"
              :label="`Канал ${index + 1}`"
              :name="`server-channel-${channel.id}`"
              autocomplete="off"
              :disabled="!canManageServer"
            />
          </div>

          <div class="server-settings-modal__channel-actions">
            <DbrButton
              :disabled="!canManageServer || serverModuleStore.isMutatingChannels"
              :loading="serverModuleStore.isMutatingChannels"
              :native-type="'button'"
              @click="handleRenameChannel(channel.id)"
            >
              Сохранить
            </DbrButton>

            <DbrButton
              :disabled="!canManageServer || serverModuleStore.isMutatingChannels || index === 0"
              :native-type="'button'"
              @click="handleMoveChannel(channel.id, -1)"
            >
              Вверх
            </DbrButton>

            <DbrButton
              :disabled="
                !canManageServer ||
                serverModuleStore.isMutatingChannels ||
                index === currentChannels.length - 1
              "
              :native-type="'button'"
              @click="handleMoveChannel(channel.id, 1)"
            >
              Вниз
            </DbrButton>

            <DbrButton
              :disabled="!canManageServer || serverModuleStore.isMutatingChannels"
              :native-type="'button'"
              variant="danger"
              @click="handleDeleteChannel(channel.id)"
            >
              Удалить
            </DbrButton>
          </div>
        </article>
      </div>

      <p
        v-else
        class="server-settings-modal__channels-empty dbru-text-sm dbru-text-muted"
      >
        Каналов пока нет.
      </p>
    </section>

    <footer class="server-settings-modal__footer">
      <p
        v-if="serverModuleStore.deleteServerErrorMessage"
        class="server-settings-modal__server-error dbru-text-sm"
      >
        {{ serverModuleStore.deleteServerErrorMessage }}
      </p>

      <DbrButton
        :loading="serverModuleStore.isDeletingServer"
        :disabled="!canManageServer"
        :native-type="'button'"
        variant="danger"
        @click="handleDeleteServer"
      >
        Удалить сервер
      </DbrButton>

      <DbrButton
        :loading="serverModuleStore.isUpdatingServer"
        :disabled="!canManageServer"
        :native-type="'button'"
        @click="handleSave"
      >
        Сохранить
      </DbrButton>
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

.server-settings-modal__channel-section {
  display: grid;
  gap: var(--dbru-space-4);
}

.server-settings-modal__channel-create {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-3);
  align-items: end;
}

.server-settings-modal__channel-create-input {
  min-width: 0;
}

.server-settings-modal__channel-list {
  display: grid;
  gap: var(--dbru-space-3);
}

.server-settings-modal__channel-card {
  display: grid;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-4);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-bg);
}

.server-settings-modal__channel-main {
  min-width: 0;
}

.server-settings-modal__channel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dbru-space-2);
}

.server-settings-modal__channels-error {
  margin: 0;
  color: var(--dbru-color-error);
}

.server-settings-modal__server-error {
  margin: 0;
  color: var(--dbru-color-error);
}

.server-settings-modal__channels-empty {
  margin: 0;
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
  flex-wrap: wrap;
  gap: var(--dbru-space-3);
  justify-content: space-between;
}

@media (max-width: 640px) {
  .server-settings-modal__profile {
    align-items: flex-start;
  }

  .server-settings-modal__invite-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .server-settings-modal__channel-create {
    grid-template-columns: minmax(0, 1fr);
  }

  .server-settings-modal__footer :deep(.dbru-button) {
    width: 100%;
  }
}
</style>
