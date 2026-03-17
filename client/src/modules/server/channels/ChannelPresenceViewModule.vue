<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "../../../stores/auth";
import { useServerModuleStore } from "../../../stores/serverModule";
import globalBack from "../../../assets/global_back.png";
import ChannelMemberCard from "./ChannelMemberCard.vue";

interface ChannelPresenceViewModuleProps {
  selectedChannelId: string | null;
}

const props = defineProps<ChannelPresenceViewModuleProps>();
const authStore = useAuthStore();
const serverModuleStore = useServerModuleStore();

/**
 * Возвращает выбранный канал из текущего server snapshot.
 */
const selectedChannel = computed(() =>
  serverModuleStore.snapshot?.channels.find((channel) => channel.id === props.selectedChannelId) ?? null,
);

/**
 * Возвращает участников выбранного канала в текущем runtime presence snapshot.
 */
const selectedChannelMembers = computed(() =>
  serverModuleStore.presenceMembers.filter((member) => member.channelId === props.selectedChannelId),
);
</script>

<template>
  <section class="channel-presence-view-module">
    <img
      class="channel-presence-view-module__background"
      :src="globalBack"
      alt=""
      aria-hidden="true"
    >

    <div class="channel-presence-view-module__overlay">
      <template v-if="selectedChannel">
        <header class="channel-presence-view-module__header">
          <div class="channel-presence-view-module__title-block">
            <h2 class="channel-presence-view-module__title dbru-text-xl dbru-text-main">
              {{ selectedChannel.name }}
            </h2>
            <p class="channel-presence-view-module__subtitle dbru-text-sm dbru-text-muted">
              Участников в канале: {{ selectedChannelMembers.length }}
            </p>
          </div>
        </header>

        <div
          v-if="selectedChannelMembers.length > 0"
          class="channel-presence-view-module__members"
        >
          <ChannelMemberCard
            v-for="member in selectedChannelMembers"
            :key="member.userId"
            :member="member"
            :is-current-user="member.userId === authStore.currentUser?.id"
          />
        </div>

        <div
          v-else
          class="channel-presence-view-module__empty"
        >
          <p class="channel-presence-view-module__empty-title dbru-text-lg dbru-text-main">
            В канале пока никого нет
          </p>
          <p class="channel-presence-view-module__empty-copy dbru-text-sm dbru-text-muted">
            Участники появятся здесь, как только кто-то подключится к этому каналу.
          </p>
        </div>
      </template>

      <div
        v-else
        class="channel-presence-view-module__empty"
      >
        <p class="channel-presence-view-module__empty-title dbru-text-lg dbru-text-main">
          Канал не выбран
        </p>
        <p class="channel-presence-view-module__empty-copy dbru-text-sm dbru-text-muted">
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
}

.channel-presence-view-module__background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
}

.channel-presence-view-module__overlay {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--dbru-space-5);
  height: 100%;
  min-height: 0;
  padding: var(--dbru-space-5);
  background: var(--dbru-color-bg);
  backdrop-filter: blur(10px);
}

.channel-presence-view-module__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dbru-space-4);
}

.channel-presence-view-module__title-block {
  display: grid;
  gap: var(--dbru-space-2);
}

.channel-presence-view-module__title,
.channel-presence-view-module__subtitle,
.channel-presence-view-module__empty-title,
.channel-presence-view-module__empty-copy {
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
  justify-items: start;
  gap: var(--dbru-space-2);
  min-height: 0;
}
</style>
