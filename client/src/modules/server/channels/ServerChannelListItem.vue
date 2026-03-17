<script setup lang="ts">
import megaphoneIconRaw from '../../../assets/icons/megaphone.svg?raw';

defineProps<{
  channelId: string;
  name: string;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [channelId: string];
}>();

/**
 * Нормализованный SVG канала с привязкой цвета к currentColor.
 */
const megaphoneIconMarkup = megaphoneIconRaw
  .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
  .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
</script>

<template>
  <button
    type="button"
    class="server-channel-list-item"
    :class="{
      'server-channel-list-item--selected': isSelected,
    }"
    @click="emit('select', channelId)"
  >
    <span class="server-channel-list-item__icon" aria-hidden="true" v-html="megaphoneIconMarkup" />

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
  background-color: color-mix(in srgb, var(--dbru-color-primary) 12%, transparent);
}

.server-channel-list-item--selected,
.server-channel-list-item--selected:hover {
  background: transparent;
}

.server-channel-list-item__icon {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  color: var(--dbru-color-text);
}

.server-channel-list-item__icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.server-channel-list-item--selected .server-channel-list-item__icon {
  color: var(--dbru-color-success);
}

.server-channel-list-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
