<script setup lang="ts">
import { ref, watch } from "vue";
import { DbrAvatar } from "dobruniaui-vue";

const props = defineProps<{
  displayName: string;
  avatarUrl: string | null;
  stream: MediaStream;
  isCurrentUser: boolean;
}>();

const videoElement = ref<HTMLVideoElement | null>(null);

watch(
  [videoElement, () => props.stream],
  ([nextVideoElement, nextStream]) => {
    if (!nextVideoElement) {
      return;
    }

    nextVideoElement.srcObject = nextStream;
    void nextVideoElement.play().catch(() => {});
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <article class="channel-screen-share-card">
    <video
      ref="videoElement"
      class="channel-screen-share-card__video"
      autoplay
      playsinline
      muted
    ></video>

    <div class="channel-screen-share-card__meta">
      <DbrAvatar
        size="sm"
        :name="props.displayName"
        :src="props.avatarUrl ?? undefined"
      />

      <div class="channel-screen-share-card__text">
        <p class="channel-screen-share-card__name dbru-text-base dbru-text-main">
          {{ props.displayName }}
        </p>
        <p class="channel-screen-share-card__subtitle dbru-text-sm dbru-text-muted">
          {{ props.isCurrentUser ? "Вы показываете экран" : "Демонстрация экрана" }}
        </p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.channel-screen-share-card {
  display: grid;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-3);
  background: var(--dbru-color-surface);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-lg);
}

.channel-screen-share-card__video {
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: cover;
  background: var(--dbru-color-bg);
  border-radius: var(--dbru-radius-md);
}

.channel-screen-share-card__meta {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
}

.channel-screen-share-card__text {
  min-width: 0;
}

.channel-screen-share-card__name,
.channel-screen-share-card__subtitle {
  margin: 0;
}
</style>
