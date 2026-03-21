<script setup lang="ts">
import { computed } from "vue";
import { DbrAvatar } from "dobruniaui-vue";
import ConnectionQualityIndicator from "../../../components/base/ConnectionQualityIndicator.vue";
import VoiceStateIndicators from "../../../components/base/VoiceStateIndicators.vue";
import type {
  ClientRealtimeConnectionQuality,
  ClientRuntimePresenceMember,
} from "../../../types/server";

interface ChannelMemberInlineItemProps {
  participant: ClientRuntimePresenceMember;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  connectionQuality: ClientRealtimeConnectionQuality | null;
  isCurrentUser?: boolean;
}

const props = withDefaults(defineProps<ChannelMemberInlineItemProps>(), {
  isCurrentUser: false,
});

/**
 * Возвращает подпись участника с локальной пометкой для текущего пользователя.
 */
const displayName = computed(() =>
  props.isCurrentUser ? `${props.participant.displayName} (Вы)` : props.participant.displayName,
);
</script>

<template>
  <div
    class="channel-member-inline-item"
    :class="{
      'channel-member-inline-item--speaking': props.speaking,
    }"
  >
    <DbrAvatar
      class="channel-member-inline-item__avatar"
      size="sm"
      :name="props.participant.displayName"
      :src="props.participant.avatarUrl ?? undefined"
    />

    <span class="channel-member-inline-item__name dbru-text-xs dbru-text-main">
      {{ displayName }}
    </span>

    <span class="channel-member-inline-item__meta">
      <VoiceStateIndicators
        :muted="props.muted || props.deafened"
        :deafened="props.deafened"
        size="xs"
      />
      <ConnectionQualityIndicator :quality="props.connectionQuality" />
    </span>
  </div>
</template>

<style scoped>
.channel-member-inline-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dbru-space-2);
  position: relative;
  min-width: 0;
  padding: var(--dbru-space-2) var(--dbru-space-3);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-bg);
  transition:
    box-shadow var(--dbru-duration-base) var(--dbru-ease-standard),
    background-color var(--dbru-duration-base) var(--dbru-ease-standard);
}

.channel-member-inline-item::before {
  content: "";
  position: absolute;
  top: 50%;
  left: calc(var(--dbru-space-3) * -1);
  width: var(--dbru-space-3);
  border-top: var(--dbru-border-size-1) solid var(--dbru-color-border);
  transform: translateY(-50%);
}

.channel-member-inline-item--speaking {
  box-shadow: inset 0 0 0 1px var(--dbru-color-success);
}

.channel-member-inline-item__avatar {
  flex: 0 0 auto;
}

.channel-member-inline-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-member-inline-item__meta {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
}
.channel-member-inline-item--speaking {
  box-shadow: none;
  border-color: transparent;
  outline: none;
}

.channel-member-inline-item--speaking :deep(.dbru-avatar) {
  box-shadow:
    0 0 0 2px var(--dbru-color-success),
    0 0 0 5px color-mix(in srgb, var(--dbru-color-success) 18%, transparent);
}

.channel-member-inline-item--speaking::before,
.channel-member-inline-item--speaking::after {
  box-shadow: none;
  outline: none;
}
</style>
