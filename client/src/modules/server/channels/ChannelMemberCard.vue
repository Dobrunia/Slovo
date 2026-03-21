<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { DbrAvatar, DbrCard, DbrChip } from "dobruniaui-vue";
import AppIconButton from "../../../components/base/AppIconButton.vue";
import ConnectionQualityIndicator from "../../../components/base/ConnectionQualityIndicator.vue";
import VoiceStateIndicators from "../../../components/base/VoiceStateIndicators.vue";
import { useVoiceLevelPreferences } from "../../../composables/useVoiceLevelPreferences";
import type { ClientRuntimePresenceMember } from "../../../types/server";
import expandIcon from "../../../assets/icons/expand.svg";
import minimizeIcon from "../../../assets/icons/minimize.svg";
import stopWatchIcon from "../../../assets/icons/stop-watch.svg";
import volumeMinIcon from "../../../assets/icons/volume-min.svg";
import volumeMaxIcon from "../../../assets/icons/volume-max.svg";

interface ChannelMemberCardProps {
  participant: ClientRuntimePresenceMember;
  username: string | null;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  connectionQuality: "low" | "med" | "good" | null;
  screenShareStream: MediaStream | null;
  isCurrentUser?: boolean;
}

const props = withDefaults(defineProps<ChannelMemberCardProps>(), {
  isCurrentUser: false,
});
const voiceLevelPreferences = useVoiceLevelPreferences();
const playbackVolume = computed({
  get: () => voiceLevelPreferences.getPlaybackVolume(props.participant.userId),
  set: (value: number) => {
    voiceLevelPreferences.setPlaybackVolume(props.participant.userId, value);
  },
});
const microphoneGain = computed({
  get: () => voiceLevelPreferences.microphoneGain.value,
  set: (value: number) => {
    voiceLevelPreferences.setMicrophoneGain(value);
  },
});
const isScreenShareVisible = ref(false);
const isScreenShareFullscreen = ref(false);
const screenSharePosterUrl = ref<string | null>(null);
const previewVideoElement = ref<HTMLVideoElement | null>(null);

/**
 * Возвращает вторичную подпись карточки участника.
 */
const secondaryLabel = computed(() => {
  if (props.speaking) {
    return "Сейчас говорит";
  }

  if (props.isCurrentUser) {
    return "Это вы";
  }

  return "В канале";
});

/**
 * Возвращает строку username для подписи под displayName.
 */
const usernameLabel = computed(() => {
  if (props.username) {
    return `@${props.username}`;
  }

  return `@${toUsernameFallback(props.participant.displayName)}`;
});

watch(
  [previewVideoElement, () => props.screenShareStream, isScreenShareVisible],
  ([videoElement, screenShareStream, visible]) => {
    if (!videoElement) {
      return;
    }

    videoElement.srcObject = visible ? screenShareStream : null;
  },
  {
    immediate: true,
  },
);

watch(
  () => props.screenShareStream,
  (screenShareStream) => {
    if (!screenShareStream || props.isCurrentUser) {
      screenSharePosterUrl.value = null;
      return;
    }

    void captureScreenSharePoster(screenShareStream);
  },
  {
    immediate: true,
  },
);

watch(isScreenShareVisible, (visible) => {
  if (!visible) {
    isScreenShareFullscreen.value = false;
  }
});

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", handleFullscreenChange);
}

onBeforeUnmount(() => {
  if (previewVideoElement.value) {
    previewVideoElement.value.srcObject = null;
  }

  if (typeof document !== "undefined") {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }
});

/**
 * Переключает видимость preview демонстрации экрана внутри карточки.
 */
function toggleScreenSharePreview(): void {
  if (!props.screenShareStream || props.isCurrentUser) {
    return;
  }

  isScreenShareVisible.value = !isScreenShareVisible.value;
}

/**
 * Переводит preview демонстрации экрана в fullscreen, если браузер поддерживает API.
 */
async function openScreenSharePreviewFullscreen(): Promise<void> {
  if (!previewVideoElement.value || !document.fullscreenEnabled) {
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await previewVideoElement.value.requestFullscreen();
}

/**
 * Возвращает подпись для slider-а громкости.
 */
function formatVoiceLevelLabel(value: number): string {
  return `${value}%`;
}

/**
 * Нормализует display name в понятный fallback username для UI.
 */
function toUsernameFallback(displayName: string): string {
  const normalizedValue = displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");

  return normalizedValue.length > 0 ? normalizedValue : "user";
}

/**
 * Синхронизирует локальный fullscreen-state просмотра стрима с браузерным API.
 */
function handleFullscreenChange(): void {
  isScreenShareFullscreen.value = Boolean(document.fullscreenElement);
}

/**
 * Создает условный poster-кадр из текущего screen-share stream для blurred preview.
 */
async function captureScreenSharePoster(stream: MediaStream): Promise<void> {
  const [videoTrack] = stream.getVideoTracks();

  if (!videoTrack) {
    screenSharePosterUrl.value = null;
    return;
  }

  const tempVideoElement = document.createElement("video");
  tempVideoElement.muted = true;
  tempVideoElement.playsInline = true;
  tempVideoElement.srcObject = new MediaStream([videoTrack]);

  try {
    await tempVideoElement.play();

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = tempVideoElement.videoWidth || 640;
    captureCanvas.height = tempVideoElement.videoHeight || 360;
    const canvasContext = captureCanvas.getContext("2d");

    if (!canvasContext) {
      screenSharePosterUrl.value = null;
      return;
    }

    canvasContext.drawImage(
      tempVideoElement,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );
    screenSharePosterUrl.value = captureCanvas.toDataURL("image/jpeg", 0.72);
  } catch {
    screenSharePosterUrl.value = null;
  } finally {
    tempVideoElement.pause();
    tempVideoElement.srcObject = null;
  }
}
</script>

<template>
  <DbrCard
    as="article"
    class="channel-member-card"
    :class="{
      'channel-member-card--current-user': props.isCurrentUser,
    }"
  >
    <div class="channel-member-card__top">
      <DbrAvatar
        class="channel-member-card__avatar"
        :class="{
          'channel-member-card__avatar--speaking': props.speaking,
        }"
        size="lg"
        :name="props.participant.displayName"
        :src="props.participant.avatarUrl ?? undefined"
      />
    </div>

    <div class="channel-member-card__content">
      <h3 class="channel-member-card__name dbru-text-base dbru-text-main">
        {{ props.participant.displayName }}
      </h3>
      <p class="channel-member-card__username dbru-text-sm dbru-text-muted">
        {{ usernameLabel }}
      </p>
      <p class="channel-member-card__status dbru-text-xs dbru-text-muted">
        {{ secondaryLabel }}
      </p>
      <DbrChip
        v-if="props.screenShareStream"
        class="channel-member-card__stream-chip"
        variant="danger"
      >
        Ведет трансляцию
      </DbrChip>
    </div>

    <div class="channel-member-card__meta">
      <VoiceStateIndicators
        :muted="props.muted || props.deafened"
        :deafened="props.deafened"
        size="sm"
      />
      <ConnectionQualityIndicator :quality="props.connectionQuality" />
    </div>

    <div class="channel-member-card__voice-level">
      <p class="channel-member-card__voice-level-title dbru-text-xs dbru-text-muted">
        {{ props.isCurrentUser ? "Громкость вашего микрофона" : "Громкость голоса" }}
      </p>

      <div class="channel-member-card__voice-level-control">
        <img
          class="channel-member-card__voice-level-icon"
          :src="volumeMinIcon"
          alt=""
          aria-hidden="true"
        />

        <input
          v-if="props.isCurrentUser"
          v-model.number="microphoneGain"
          class="channel-member-card__range"
          type="range"
          min="0"
          max="200"
          step="5"
          aria-label="Изменить громкость микрофона"
        />
        <input
          v-else
          v-model.number="playbackVolume"
          class="channel-member-card__range"
          type="range"
          min="0"
          max="200"
          step="5"
          :aria-label="`Изменить громкость пользователя ${props.participant.displayName}`"
        />

        <img
          class="channel-member-card__voice-level-icon"
          :src="volumeMaxIcon"
          alt=""
          aria-hidden="true"
        />
      </div>

      <p class="channel-member-card__voice-level-value dbru-text-xs dbru-text-muted">
        {{
          formatVoiceLevelLabel(
            props.isCurrentUser ? microphoneGain : playbackVolume,
          )
        }}
      </p>
    </div>

    <div class="channel-member-card__stream">
      <div
        v-if="props.isCurrentUser && props.screenShareStream"
        class="channel-member-card__stream-placeholder"
      >
        <p class="channel-member-card__stream-copy dbru-text-xs dbru-text-muted">
          Ваш стрим сейчас идет. Просмотр собственной трансляции недоступен.
        </p>
      </div>

      <div
        v-else-if="props.screenShareStream && isScreenShareVisible"
        class="channel-member-card__stream-preview"
      >
        <video
          ref="previewVideoElement"
          class="channel-member-card__stream-video"
          autoplay
          playsinline
          muted
        />

        <div class="channel-member-card__stream-overlay">
          <div class="channel-member-card__stream-actions">
            <AppIconButton
              :icon-src="isScreenShareFullscreen ? minimizeIcon : expandIcon"
              :label="
                isScreenShareFullscreen
                  ? 'Свернуть просмотр стрима'
                  : 'Развернуть стрим на весь экран'
              "
              icon-alt=""
              @click="openScreenSharePreviewFullscreen"
            />
            <AppIconButton
              :icon-src="stopWatchIcon"
              label="Остановить просмотр стрима"
              icon-alt=""
              tone="danger"
              @click="toggleScreenSharePreview"
            />
          </div>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="channel-member-card__stream-cta dbru-reduced-motion"
        :class="{
          'channel-member-card__stream-cta--disabled': !props.screenShareStream,
        }"
        :disabled="!props.screenShareStream"
        @click="toggleScreenSharePreview"
      >
        <span
          class="channel-member-card__stream-cta-backdrop"
          :style="
            screenSharePosterUrl
              ? {
                  backgroundImage: `url(${screenSharePosterUrl})`,
                }
              : undefined
          "
        />

        <span class="channel-member-card__stream-cta-overlay" />

        <span class="channel-member-card__stream-cta-copy dbru-text-sm dbru-text-main">
          {{
            props.screenShareStream
              ? 'Смотреть стрим'
              : 'Стрим пока не запущен'
          }}
        </span>
      </button>
    </div>
  </DbrCard>
</template>

<style scoped>
.channel-member-card {
  display: grid;
  gap: var(--dbru-space-4);
  padding: var(--dbru-space-5);
}

.channel-member-card--current-user {
  border-color: var(--dbru-color-primary);
}

.channel-member-card__avatar--speaking {
  box-shadow:
    0 0 0 2px var(--dbru-color-success),
    0 0 0 5px color-mix(in srgb, var(--dbru-color-success) 18%, transparent);
}

.channel-member-card__top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--dbru-space-3);
}

.channel-member-card__content {
  display: grid;
  gap: var(--dbru-space-1);
  justify-items: center;
  text-align: center;
}

.channel-member-card__name,
.channel-member-card__username,
.channel-member-card__status,
.channel-member-card__voice-level-title,
.channel-member-card__voice-level-value,
.channel-member-card__stream-copy {
  margin: 0;
}

.channel-member-card__stream-chip {
  justify-self: center;
}

.channel-member-card__meta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--dbru-space-2);
}

.channel-member-card__voice-level {
  display: grid;
  gap: var(--dbru-space-2);
}

.channel-member-card__voice-level-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dbru-space-2);
}

.channel-member-card__voice-level-icon {
  display: block;
  width: 16px;
  height: 16px;
}

.channel-member-card__range {
  width: 100%;
  min-width: 0;
}

.channel-member-card__stream {
  display: grid;
}

.channel-member-card__stream-preview,
.channel-member-card__stream-placeholder {
  display: grid;
  gap: var(--dbru-space-3);
  min-height: 160px;
  padding: var(--dbru-space-4);
  border-radius: var(--dbru-radius-lg);
  background: var(--dbru-color-bg);
  border: var(--dbru-border-size-1) dashed var(--dbru-color-border);
}

.channel-member-card__stream-placeholder {
  align-content: center;
  justify-items: center;
  text-align: center;
}

.channel-member-card__stream-video {
  width: 100%;
  height: 180px;
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-bg);
  object-fit: cover;
}

.channel-member-card__stream-overlay {
  display: flex;
  justify-content: flex-end;
}

.channel-member-card__stream-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dbru-space-2);
}

.channel-member-card__stream-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 var(--dbru-space-3);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-full);
  background: var(--dbru-color-surface);
  cursor: pointer;
}

.channel-member-card__stream-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.channel-member-card__stream-cta {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: var(--dbru-space-4);
  overflow: hidden;
  border: var(--dbru-border-size-1) dashed var(--dbru-color-border);
  border-radius: var(--dbru-radius-lg);
  background: var(--dbru-color-bg);
  cursor: pointer;
}

.channel-member-card__stream-cta--disabled {
  cursor: not-allowed;
}

.channel-member-card__stream-cta-backdrop,
.channel-member-card__stream-cta-overlay {
  position: absolute;
  inset: 0;
}

.channel-member-card__stream-cta-backdrop {
  background: linear-gradient(160deg, var(--dbru-color-surface), var(--dbru-color-bg));
  background-position: center;
  background-size: cover;
  filter: blur(10px);
  transform: scale(1.08);
}

.channel-member-card__stream-cta-overlay {
  background: var(--dbru-color-bg);
  opacity: 0.52;
}

.channel-member-card__stream-cta-copy {
  position: relative;
  z-index: 1;
  padding: 0 var(--dbru-space-4);
  border-radius: var(--dbru-radius-full);
  background: var(--dbru-color-surface);
  line-height: 32px;
}
.channel-member-card {
  border: 0;
  border-radius: inherit;
  background: var(--dbru-color-surface);
  box-shadow: none;
}

.channel-member-card--current-user {
  background: color-mix(in srgb, var(--dbru-color-primary) 8%, var(--dbru-color-surface));
  box-shadow: 0 0 0 1px var(--dbru-color-primary);
}
</style>
