<script setup lang="ts">
import { computed } from 'vue';
import { DbrCard } from 'dobruniaui-vue';
import ChannelMemberCard from './ChannelMemberCard.vue';
import { useAuthStore } from '../../../stores/auth';
import { useServerModuleStore } from '../../../stores/serverModule';

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
      <div v-if="selectedChannelParticipants.length > 0" class="channel-presence-view-module__grid">
        <ChannelMemberCard
          v-for="participant in selectedChannelParticipants"
          :key="participant.userId"
          :participant="participant"
          :muted="serverModuleStore.getMemberVoiceState(participant.userId).muted"
          :deafened="serverModuleStore.getMemberVoiceState(participant.userId).deafened"
          :speaking="serverModuleStore.isMemberSpeaking(participant.userId)"
          :connection-quality="
            serverModuleStore.getMemberVoiceState(participant.userId).connectionQuality
          "
          :username="getParticipantUsername(participant.userId)"
          :screen-share-stream="getParticipantScreenShareStream(participant.userId)"
          :is-current-user="isCurrentUser(participant.userId)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.channel-presence-view-module {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  height: 100%;
  min-height: 0;
  background: var(--dbru-color-bg);
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
</style>
