<script setup lang="ts">
import megaphoneIcon from "../../../assets/icons/megaphone.svg";

defineProps<{
  channelId: string;
  name: string;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [channelId: string];
}>();
</script>

<template>
  <button
    type="button"
    class="server-channel-list-item"
    @click="emit('select', channelId)"
  >
    <img
      class="server-channel-list-item__icon"
      :src="megaphoneIcon"
      alt=""
    >

    <span class="server-channel-list-item__name dbru-text-base dbru-text-main">
      {{ name }}
    </span>
  </button>
</template>

<style scoped>
.server-channel-list-item {
  display: flex;
  align-items: center;
  gap: var(--dbru-space-3);
  width: 100%;
  min-width: 0;
  padding: var(--dbru-space-3) var(--dbru-space-4);
  border: 0;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  color: var(--dbru-color-text);
  cursor: pointer;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.server-channel-list-item:hover {
  background: color-mix(in srgb, #000000 12%, transparent); /* НЕ МЕНЯТЬ!! */
}

.server-channel-list-item__icon {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
}

.server-channel-list-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
