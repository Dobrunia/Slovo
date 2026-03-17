<script setup lang="ts">
import { computed } from "vue";
import AppHeadingBlock from "../../../components/base/AppHeadingBlock.vue";
import { useServerModuleStore } from "../../../stores/serverModule";

const props = defineProps<{
  selectedChannelId?: string | null;
}>();

const serverModuleStore = useServerModuleStore();
const serverSnapshot = computed(() => serverModuleStore.snapshot);
const selectedChannel = computed(() =>
  serverSnapshot.value?.channels.find((channel) => channel.id === props.selectedChannelId) ?? null,
);
</script>

<template>
  <section class="channel-view-module">
    <template v-if="selectedChannel">
      <AppHeadingBlock
        class="channel-view-module__copy"
        :title="selectedChannel.name"
        description="Здесь позже появятся участники канала, их камеры, screen share и связанные панели."
        title-tag="h1"
        centered
      />
    </template>

    <template v-else-if="serverSnapshot">
      <AppHeadingBlock
        class="channel-view-module__copy"
        title="Канал не выбран"
        description="Выберите нужный канал слева."
        title-tag="h1"
        centered
      />
    </template>

    <template v-else-if="serverModuleStore.isLoading">
      <AppHeadingBlock
        class="channel-view-module__copy"
        title="Загружаем сервер"
        title-tag="h1"
        centered
      />
    </template>

    <template v-else>
      <AppHeadingBlock
        class="channel-view-module__copy"
        title="Область канала пока пустая"
        title-tag="h1"
        centered
      />
    </template>
  </section>
</template>

<style scoped>
.channel-view-module {
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 0;
  background-color: var(--dbru-color-bg);
  background-image: url("../../../assets/global_back.png");
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.channel-view-module__copy {
  max-width: 30rem;
  padding: var(--dbru-space-5);
}

@media (max-width: 960px) {
  .channel-view-module {
    min-height: 18rem;
  }
}

@media (max-width: 640px) {
  .channel-view-module__copy {
    padding: var(--dbru-space-4);
  }
}
</style>
