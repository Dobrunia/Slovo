<script setup lang="ts">
import type { ClientVoiceChannel } from "../../../types/server";
import AppHeadingBlock from "../../../components/base/AppHeadingBlock.vue";

defineProps<{
  hasServers: boolean;
  hasServerSnapshot: boolean;
  isLoading: boolean;
  selectedChannel?: ClientVoiceChannel | null;
}>();
</script>

<template>
  <section class="channel-viewport-module">
    <template v-if="selectedChannel">
      <AppHeadingBlock
        class="channel-viewport-module__copy"
        :title="selectedChannel.name"
        description="Центральная область зарезервирована под активный чат, voice UI, screen share и видеопотоки."
        title-tag="h1"
        centered
      />
    </template>

    <template v-else-if="hasServerSnapshot">
      <AppHeadingBlock
        class="channel-viewport-module__copy"
        title="Канал не выбран"
        description="Выберите нужный канал слева."
        title-tag="h1"
        centered
      />
    </template>

    <template v-else-if="isLoading">
      <AppHeadingBlock
        class="channel-viewport-module__copy"
        title="Загружаем сервер"
        title-tag="h1"
        centered
      />
    </template>

    <template v-else-if="hasServers">
      <AppHeadingBlock
        class="channel-viewport-module__copy"
        title="Откройте сервер сверху"
        title-tag="h1"
        centered
      />
    </template>

    <template v-else>
      <AppHeadingBlock
        class="channel-viewport-module__copy"
        title="Центральная зона пока пустая"
        title-tag="h1"
        centered
      />
    </template>
  </section>
</template>

<style scoped>
.channel-viewport-module {
  display: grid;
  place-items: center;
  min-height: 0;
  padding: var(--dbru-space-5);
}

.channel-viewport-module__copy {
  max-width: 26rem;
}

@media (max-width: 640px) {
  .channel-viewport-module {
    padding: var(--dbru-space-4);
  }
}
</style>
