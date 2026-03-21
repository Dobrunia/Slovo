<script setup lang="ts">
import { computed } from "vue";
import ChannelMemberInlineItem from "./ChannelMemberInlineItem.vue";
import { useAuthStore } from "../../../stores/auth";
import { useServerModuleStore } from "../../../stores/serverModule";
import type { ClientRuntimePresenceMember } from "../../../types/server";

interface ServerChannelPresenceListItemProps {
  channelId: string;
  name: string;
  isSelected: boolean;
  participants: ClientRuntimePresenceMember[];
}

const props = defineProps<ServerChannelPresenceListItemProps>();

const emit = defineEmits<{
  select: [channelId: string];
}>();

const authStore = useAuthStore();
const serverModuleStore = useServerModuleStore();

/**
 * Возвращает участников канала в порядке входа.
 */
const sortedParticipants = computed(() =>
  [...props.participants].sort((left, right) => left.joinedAt.localeCompare(right.joinedAt)),
);

/**
 * Сообщает родителю о выборе канала.
 */
function handleSelect(): void {
  emit("select", props.channelId);
}

/**
 * Возвращает `true`, если участник списка является текущим пользователем.
 */
function isCurrentUser(userId: string): boolean {
  return authStore.currentUser?.id === userId;
}
</script>

<template>
  <section class="server-channel-presence-list-item">
    <button
      type="button"
      class="server-channel-presence-list-item__button dbru-reduced-motion"
      :class="{
        'server-channel-presence-list-item__button--selected': props.isSelected,
      }"
      @click="handleSelect"
    >
      <span
        class="server-channel-presence-list-item__icon"
        :class="{
          'server-channel-presence-list-item__icon--selected': props.isSelected,
        }"
        aria-hidden="true"
      >
        <svg
          class="server-channel-presence-list-item__icon-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
          <path d="M6 14a12 12 0 0 0 2.4 7.2a2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14M8 6v8" />
        </svg>
      </span>

      <span class="server-channel-presence-list-item__name dbru-text-sm dbru-text-main">
        {{ props.name }}
      </span>

      <span
        v-if="sortedParticipants.length > 0"
        class="server-channel-presence-list-item__count dbru-text-xs dbru-text-muted"
      >
        {{ sortedParticipants.length }}
      </span>
    </button>

    <div
      v-if="sortedParticipants.length > 0"
      class="server-channel-presence-list-item__participants"
    >
      <ChannelMemberInlineItem
        v-for="participant in sortedParticipants"
        :key="participant.userId"
        :participant="participant"
        :muted="serverModuleStore.getMemberVoiceState(participant.userId).muted"
        :deafened="serverModuleStore.getMemberVoiceState(participant.userId).deafened"
        :speaking="serverModuleStore.isMemberSpeaking(participant.userId)"
        :connection-quality="serverModuleStore.getMemberVoiceState(participant.userId).connectionQuality"
        :is-current-user="isCurrentUser(participant.userId)"
      />
    </div>
  </section>
</template>

<style scoped>
.server-channel-presence-list-item {
  display: grid;
  gap: var(--dbru-space-2);
}

.server-channel-presence-list-item__button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dbru-space-3);
  width: 100%;
  padding: var(--dbru-space-3);
  border: 0;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.server-channel-presence-list-item__button:hover {
  background: var(--dbru-color-bg);
}

.server-channel-presence-list-item__button:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 2px;
}

.server-channel-presence-list-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--dbru-color-text-muted);
}

.server-channel-presence-list-item__icon-svg {
  display: block;
  width: 18px;
  height: 18px;
}

.server-channel-presence-list-item__icon--selected {
  color: var(--dbru-color-success);
}

.server-channel-presence-list-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-channel-presence-list-item__participants {
  position: relative;
  display: grid;
  gap: var(--dbru-space-2);
  padding-left: calc(18px + var(--dbru-space-6));
}

.server-channel-presence-list-item__participants::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 50%;
  left: calc(18px + var(--dbru-space-3));
  border-left: var(--dbru-border-size-1) solid var(--dbru-color-border);
}
.server-channel-presence-list-item__count {
  display: none;
}
</style>
