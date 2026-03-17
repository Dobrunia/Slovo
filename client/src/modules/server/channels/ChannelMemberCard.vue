<script setup lang="ts">
import { DbrAvatar } from "dobruniaui-vue";
import type { ClientRuntimePresenceMember } from "../../../types/server";

interface ChannelMemberCardProps {
  member: ClientRuntimePresenceMember;
  isCurrentUser?: boolean;
}

defineProps<ChannelMemberCardProps>();
</script>

<template>
  <article class="channel-member-card">
    <DbrAvatar
      size="md"
      :name="member.displayName"
      :src="member.avatarUrl ?? undefined"
    />

    <div class="channel-member-card__body">
      <p class="channel-member-card__name dbru-text-base dbru-text-main">
        {{ member.displayName }}
      </p>
      <p
        v-if="isCurrentUser"
        class="channel-member-card__meta dbru-text-sm dbru-text-muted"
      >
        Вы
      </p>
    </div>
  </article>
</template>

<style scoped>
.channel-member-card {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  min-width: 0;
  padding: var(--dbru-space-4);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: var(--dbru-color-surface);
}

.channel-member-card__body {
  display: grid;
  gap: var(--dbru-space-1);
  min-width: 0;
}

.channel-member-card__name,
.channel-member-card__meta {
  margin: 0;
}

.channel-member-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
