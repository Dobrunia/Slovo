<script setup lang="ts">
import { DbrAvatar } from "dobruniaui-vue";
import type { ClientRuntimePresenceMember } from "../../../types/server";

interface ChannelMemberInlineItemProps {
  member: ClientRuntimePresenceMember;
}

defineProps<ChannelMemberInlineItemProps>();
</script>

<template>
  <div class="channel-member-inline-item">
    <DbrAvatar
      size="sm"
      :name="member.displayName"
      :src="member.avatarUrl ?? undefined"
    />
    <span class="channel-member-inline-item__name dbru-text-sm dbru-text-muted">
      {{ member.displayName }}
    </span>
  </div>
</template>

<style scoped>
.channel-member-inline-item {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-2);
  min-width: 0;
  padding-inline-start: calc(var(--dbru-space-5) + var(--dbru-space-3));
}

.channel-member-inline-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
