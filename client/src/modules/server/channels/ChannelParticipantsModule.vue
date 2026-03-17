<script setup lang="ts">
import type { ClientVoiceChannel } from "../../../types/server";
import AppHeadingBlock from "../../../components/base/AppHeadingBlock.vue";

defineProps<{
  hasServerSnapshot: boolean;
  selectedChannel?: ClientVoiceChannel | null;
}>();
</script>

<template>
  <aside class="channel-participants-module">
    <template v-if="selectedChannel">
      <AppHeadingBlock
        title="Участники канала"
        description="Здесь позже появятся участники, камеры и сопутствующие панели канала."
        title-tag="h2"
        title-size="base"
      />
    </template>

    <template v-else-if="hasServerSnapshot">
      <AppHeadingBlock
        title="Участники"
        description="Выберите канал, чтобы открыть связанную правую панель."
        title-tag="h2"
        title-size="base"
      />
    </template>

    <template v-else>
      <AppHeadingBlock
        title="Правая панель"
        description="Появится после открытия сервера."
        title-tag="h2"
        title-size="base"
      />
    </template>
  </aside>
</template>

<style scoped>
.channel-participants-module {
  display: grid;
  align-content: start;
  min-height: 0;
  padding: var(--dbru-space-5);
  background: var(--dbru-color-surface);
  border-left: var(--dbru-border-size-1) solid var(--dbru-color-border);
}

@media (max-width: 1100px) {
  .channel-participants-module {
    display: none;
  }
}
</style>
