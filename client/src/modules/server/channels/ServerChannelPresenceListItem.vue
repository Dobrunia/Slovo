<script setup lang="ts">
import type { ClientRuntimePresenceMember } from "../../../types/server";
import megaphoneIconMarkup from "../../../assets/icons/megaphone.svg?raw";
import ChannelMemberInlineItem from "./ChannelMemberInlineItem.vue";

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

const megaphoneIcon = megaphoneIconMarkup
  .replaceAll(/fill="[^"]*"/g, 'fill="currentColor"')
  .replaceAll(/stroke="[^"]*"/g, 'stroke="currentColor"');

/**
 * Вызывает выбор канала у родительского списка.
 */
function handleSelect(): void {
  emit("select", props.channelId);
}
</script>

<template>
  <div class="server-channel-presence-list-item">
    <button
      type="button"
      class="server-channel-presence-list-item__button"
      :class="{
        'server-channel-presence-list-item--selected': isSelected,
      }"
      @click="handleSelect"
    >
      <span
        class="server-channel-presence-list-item__icon"
        aria-hidden="true"
        v-html="megaphoneIcon"
      />
      <span class="server-channel-presence-list-item__name dbru-text-sm dbru-text-main">
        {{ name }}
      </span>
      <span
        v-if="participants.length > 0"
        class="server-channel-presence-list-item__count dbru-text-sm dbru-text-muted"
      >
        {{ participants.length }}
      </span>
    </button>

    <div
      v-if="participants.length > 0"
      class="server-channel-presence-list-item__participants"
    >
      <ChannelMemberInlineItem
        v-for="member in participants"
        :key="member.userId"
        :member="member"
      />
    </div>
  </div>
</template>

<style scoped>
.server-channel-presence-list-item {
  display: grid;
  gap: var(--dbru-space-2);
}

.server-channel-presence-list-item__button {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-2);
  width: 100%;
  min-width: 0;
  padding: var(--dbru-space-2) var(--dbru-space-3);
  border: none;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  color: var(--dbru-color-text);
  text-align: left;
  cursor: pointer;
}

.server-channel-presence-list-item__button:hover {
  background: var(--dbru-color-surface);
}

.server-channel-presence-list-item__button:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 0;
}

.server-channel-presence-list-item__icon {
  display: inline-flex;
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  color: var(--dbru-color-text-muted);
}

.server-channel-presence-list-item__icon:deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.server-channel-presence-list-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-channel-presence-list-item__count {
  margin-left: auto;
}

.server-channel-presence-list-item__participants {
  display: grid;
  gap: var(--dbru-space-2);
}

.server-channel-presence-list-item--selected .server-channel-presence-list-item__icon {
  color: var(--dbru-color-success);
}
</style>
