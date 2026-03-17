<script setup lang="ts">
import ChannelViewModule from "./channels/ChannelViewModule.vue";
import ServerChannelListModule from "./channels/ServerChannelListModule.vue";

defineProps<{
  selectedChannelId?: string | null;
}>();

const emit = defineEmits<{
  selectChannel: [channelId: string];
}>();
</script>

<template>
  <div class="server-workspace">
    <aside class="server-workspace__sidebar">
      <ServerChannelListModule
        :selected-channel-id="selectedChannelId"
        @select-channel="emit('selectChannel', $event)"
      />
    </aside>

    <section class="server-workspace__channel-view">
      <ChannelViewModule :selected-channel-id="selectedChannelId" />
    </section>
  </div>
</template>

<style scoped>
.server-workspace {
  display: grid;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
  gap: 0;
  height: 100%;
  min-height: 0;
}

.server-workspace__sidebar,
.server-workspace__channel-view {
  min-height: 0;
}

@media (max-width: 960px) {
  .server-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
