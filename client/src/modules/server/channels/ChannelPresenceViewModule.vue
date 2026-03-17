<script setup lang="ts">
import { computed } from "vue";
import globalBack from "../../../assets/global_back.png";
import ChannelMemberCard from "./ChannelMemberCard.vue";
import { useServerModuleStore } from "../../../stores/serverModule";

const props = defineProps<{
  selectedChannelId: string | null;
}>();

const serverModuleStore = useServerModuleStore();

/**
 * Возвращает выбранный канал из текущего snapshot-а сервера.
 */
const selectedChannel = computed(() => {
  if (!props.selectedChannelId) {
    return null;
  }

  return (
    serverModuleStore.snapshot?.channels.find(
      (channel) => channel.id === props.selectedChannelId,
    ) ?? null
  );
});

/**
 * Возвращает участников выбранного канала по runtime presence.
 */
const selectedChannelMembers = computed(() => {
  if (!props.selectedChannelId) {
    return [];
  }

  return serverModuleStore.presenceMembers.filter(
    (member) => member.channelId === props.selectedChannelId,
  );
});

/**
 * Возвращает название текущего сервера для служебного подзаголовка.
 */
const selectedServerName = computed(
  () => serverModuleStore.snapshot?.server.name ?? "Сервер",
);
</script>

<template>
  <section class="channel-presence-view-module">
    <div class="channel-presence-view-module__background">
      <img
        class="channel-presence-view-module__background-image"
        :src="globalBack"
        alt=""
      >
    </div>

    <div class="channel-presence-view-module__overlay"></div>

    <div class="channel-presence-view-module__content">
      <template v-if="selectedChannel">
        <header class="channel-presence-view-module__header">
          <h2 class="channel-presence-view-module__title dbru-text-lg dbru-text-main">
            {{ selectedChannel.name }}
          </h2>
          <p class="channel-presence-view-module__subtitle dbru-text-sm dbru-text-muted">
            {{ selectedServerName }}
          </p>
        </header>

        <div
          v-if="selectedChannelMembers.length > 0"
          class="channel-presence-view-module__members"
        >
          <ChannelMemberCard
            v-for="member in selectedChannelMembers"
            :key="member.userId"
            :display-name="member.displayName"
            :avatar-url="member.avatarUrl"
          />
        </div>

        <div
          v-else
          class="channel-presence-view-module__empty"
        >
          <h2 class="channel-presence-view-module__title dbru-text-lg dbru-text-main">
            {{ selectedChannel.name }}
          </h2>
          <p class="channel-presence-view-module__subtitle dbru-text-sm dbru-text-muted">
            В этом канале пока никого нет.
          </p>
        </div>
      </template>

      <div
        v-else
        class="channel-presence-view-module__empty"
      >
        <h2 class="channel-presence-view-module__title dbru-text-lg dbru-text-main">
          Канал не выбран
        </h2>
        <p class="channel-presence-view-module__subtitle dbru-text-sm dbru-text-muted">
          Выберите нужный канал слева.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.channel-presence-view-module {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--dbru-color-bg);
}

.channel-presence-view-module__background,
.channel-presence-view-module__overlay,
.channel-presence-view-module__content {
  position: absolute;
  inset: 0;
}

.channel-presence-view-module__background {
  display: flex;
  align-items: center;
  justify-content: center;
}

.channel-presence-view-module__background-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
}

.channel-presence-view-module__overlay {
  background: var(--dbru-color-bg);
  opacity: 0.84;
}

.channel-presence-view-module__content {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-5);
  z-index: 1;
}

.channel-presence-view-module__header {
  display: grid;
  gap: var(--dbru-space-2);
  align-content: start;
}

.channel-presence-view-module__title,
.channel-presence-view-module__subtitle {
  margin: 0;
}

.channel-presence-view-module__members {
  display: grid;
  align-content: start;
  gap: var(--dbru-space-3);
  min-height: 0;
  overflow: auto;
}

.channel-presence-view-module__empty {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--dbru-space-2);
  min-height: 0;
  text-align: center;
}
@media (max-width: 768px) {
  .channel-presence-view-module__content {
    padding: var(--dbru-space-4);
  }
}
</style>
