<script setup lang="ts">
import { computed } from "vue";
import { DbrCard } from "dobruniaui-vue";
import ChannelMemberCard from "./ChannelMemberCard.vue";
import { useAuthStore } from "../../../stores/auth";
import { useServerModuleStore } from "../../../stores/serverModule";

interface ChannelPresenceViewModuleProps {
  selectedChannelId: string | null;
}

const props = defineProps<ChannelPresenceViewModuleProps>();

const authStore = useAuthStore();
const serverModuleStore = useServerModuleStore();
const currentUserId = computed(() => authStore.currentUser?.id ?? null);

/**
 * Возвращает snapshot открытого сервера.
 */
const snapshot = computed(() => serverModuleStore.snapshot);

/**
 * Возвращает выбранный канал внутри открытого сервера.
 */
const selectedChannel = computed(() => {
  if (!props.selectedChannelId) {
    return null;
  }

  return snapshot.value?.channels.find((channel) => channel.id === props.selectedChannelId) ?? null;
});

/**
 * Возвращает runtime-участников выбранного канала.
 */
const selectedChannelParticipants = computed(() => {
  if (!props.selectedChannelId) {
    return [];
  }

  return [...serverModuleStore.presenceMembers]
    .filter((participant) => participant.channelId === props.selectedChannelId)
    .sort((left, right) => {
      if (left.userId === currentUserId.value) {
        return -1;
      }

      if (right.userId === currentUserId.value) {
        return 1;
      }

      return left.joinedAt.localeCompare(right.joinedAt);
    });
});

/**
 * Возвращает `true`, если карточка принадлежит текущему пользователю.
 */
function isCurrentUser(userId: string): boolean {
  return authStore.currentUser?.id === userId;
}

/**
 * Возвращает username для карточки участника или `null`, если сервер еще не отдает его явно.
 */
function getParticipantUsername(userId: string): string | null {
  if (authStore.currentUser?.id === userId) {
    return authStore.currentUser.username;
  }

  return null;
}

/**
 * Возвращает доступный stream демонстрации экрана участника.
 */
function getParticipantScreenShareStream(userId: string): MediaStream | null {
  return (
    serverModuleStore.screenShareStreams.find((stream) => stream.userId === userId)?.stream ?? null
  );
}
</script>

<template>
  <section class="channel-presence-view-module">
    <template v-if="selectedChannel">
      <div
        v-if="selectedChannelParticipants.length > 0"
        class="channel-presence-view-module__grid"
      >
        <ChannelMemberCard
          v-for="participant in selectedChannelParticipants"
          :key="participant.userId"
          :participant="participant"
          :muted="serverModuleStore.getMemberVoiceState(participant.userId).muted"
          :deafened="serverModuleStore.getMemberVoiceState(participant.userId).deafened"
          :speaking="serverModuleStore.isMemberSpeaking(participant.userId)"
          :connection-quality="serverModuleStore.getMemberVoiceState(participant.userId).connectionQuality"
          :username="getParticipantUsername(participant.userId)"
          :screen-share-stream="getParticipantScreenShareStream(participant.userId)"
          :is-current-user="isCurrentUser(participant.userId)"
        />
      </div>

      <div
        v-else
        class="channel-presence-view-module__empty"
      >
        <DbrCard class="channel-presence-view-module__empty-card">
          <h3 class="channel-presence-view-module__empty-title dbru-text-base dbru-text-main">
            В канале пока никого нет
          </h3>
          <p class="channel-presence-view-module__empty-copy dbru-text-sm dbru-text-muted">
            Как только участники подключатся, их карточки появятся здесь.
          </p>
        </DbrCard>
      </div>
    </template>

    <div
      v-else
      class="channel-presence-view-module__placeholder"
    >
      <DbrCard class="channel-presence-view-module__placeholder-card">
        <h2 class="channel-presence-view-module__placeholder-title dbru-text-lg dbru-text-main">
          Канал не выбран
        </h2>
        <p class="channel-presence-view-module__placeholder-copy dbru-text-sm dbru-text-muted">
          Выберите канал слева, чтобы посмотреть участников и их текущее состояние.
        </p>
      </DbrCard>
    </div>
  </section>
</template>

<style scoped>
.channel-presence-view-module {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  height: 100%;
  min-height: 0;
  background: linear-gradient(180deg, var(--dbru-color-bg), var(--dbru-color-surface));
}

.channel-presence-view-module__eyebrow,
.channel-presence-view-module__empty-title,
.channel-presence-view-module__empty-copy,
.channel-presence-view-module__placeholder-title,
.channel-presence-view-module__placeholder-copy {
  margin: 0;
}

.channel-presence-view-module__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  align-content: start;
  gap: var(--dbru-space-4);
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--dbru-space-6);
  overflow: auto;
}

.channel-presence-view-module__empty,
.channel-presence-view-module__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: var(--dbru-space-6);
}

.channel-presence-view-module__empty-card,
.channel-presence-view-module__placeholder-card {
  display: grid;
  gap: var(--dbru-space-2);
  max-width: 420px;
  padding: var(--dbru-space-6);
  text-align: center;
}
</style>
