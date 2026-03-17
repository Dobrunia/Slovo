<script setup lang="ts">
import { DbrAvatar } from "dobruniaui-vue";

const props = defineProps<{
  displayName: string;
  avatarUrl: string | null;
}>();
</script>

<template>
  <article class="channel-member-card">
    <DbrAvatar
      size="md"
      :name="props.displayName"
      :src="props.avatarUrl ?? undefined"
    />

    <div class="channel-member-card__body">
      <p class="channel-member-card__name dbru-text-base dbru-text-main">
        {{ props.displayName }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.channel-member-card {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  padding: var(--dbru-space-3);
  background: var(--dbru-color-surface);
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-lg);
}

.channel-member-card__body {
  min-width: 0;
}

.channel-member-card__name {
  margin: 0;
}
</style>
