<script setup lang="ts">
import { computed } from "vue";
import CurrentUserControlPanel from "../../../components/base/CurrentUserControlPanel.vue";
import { useServersStore } from "../../../stores/servers";
import { useServerModuleStore } from "../../../stores/serverModule";
import ChannelParticipantsModule from "./ChannelParticipantsModule.vue";
import ChannelViewportModule from "./ChannelViewportModule.vue";

const props = defineProps<{
  selectedChannelId?: string | null;
}>();

const serversStore = useServersStore();
const serverModuleStore = useServerModuleStore();

const hasServers = computed(() => serversStore.items.length > 0);
const serverSnapshot = computed(() => serverModuleStore.snapshot);
const selectedChannel = computed(() =>
  serverSnapshot.value?.channels.find((channel) => channel.id === props.selectedChannelId) ?? null,
);
</script>

<template>
  <section class="channel-view-module">
    <CurrentUserControlPanel />

    <div class="channel-view-module__body">
      <ChannelViewportModule
        :has-servers="hasServers"
        :has-server-snapshot="Boolean(serverSnapshot)"
        :is-loading="serverModuleStore.isLoading"
        :selected-channel="selectedChannel"
      />

      <ChannelParticipantsModule
        :has-server-snapshot="Boolean(serverSnapshot)"
        :selected-channel="selectedChannel"
      />
    </div>
  </section>
</template>

<style scoped>
.channel-view-module {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: var(--dbru-border-size-1) solid var(--dbru-color-border);
  border-top-right-radius: var(--dbru-radius-md);
  border-bottom-right-radius: var(--dbru-radius-md);
  background-color: var(--dbru-color-bg);
  background-image: url("../../../assets/global_back.png");
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.channel-view-module__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  min-height: 0;
}

@media (max-width: 1100px) {
  .channel-view-module__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .channel-view-module {
    min-height: 18rem;
    border-top: 0;
    border-top-right-radius: 0;
    border-top-left-radius: 0;
    border-bottom-left-radius: var(--dbru-radius-md);
  }
}
</style>
