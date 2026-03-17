<template>
  <section class="server-rail">
    <p v-if="serversStore.isLoading" class="server-rail__state dbru-text-sm dbru-text-muted">
      Загружаем серверы...
    </p>

    <p v-if="serversStore.errorMessage" class="server-rail__state server-rail__state--error dbru-text-sm">
      {{ serversStore.errorMessage }}
    </p>

    <p v-if="displayServers.length === 0" class="server-rail__state dbru-text-sm">
      У Вас пока нет серверов.
    </p>

    <div
      v-else
      class="server-rail__viewport-wrap"
    >
      <div
        ref="serverViewportElement"
        class="server-rail__viewport"
        @scroll="syncScrollState"
        @wheel.prevent.stop="handleWheelScroll"
      >
        <ul class="server-rail__list">
          <li
            v-for="server in displayServers"
            :key="server.id"
            class="server-rail__item"
          >
            <RouterLink
              :to="buildServerRoute(server.id)"
              replace
              class="server-rail__server-button"
              :aria-label="server.name"
              :title="server.name"
            >
              <DbrAvatar
                :active="server.id === selectedServerId"
                :src="server.avatarUrl ?? undefined"
                :name="server.name"
                size="md"
                shape="rounded"
              />
            </RouterLink>
          </li>
        </ul>
      </div>

      <button
        v-if="canScrollLeft"
        type="button"
        class="server-rail__nav server-rail__nav--left"
        aria-label="Перейти к началу списка серверов"
        @click="scrollToStart"
      >
        <span class="server-rail__nav-glyph dbru-text-lg dbru-text-main" aria-hidden="true">‹</span>
      </button>

      <button
        v-if="canScrollRight"
        type="button"
        class="server-rail__nav server-rail__nav--right"
        aria-label="Перейти к концу списка серверов"
        @click="scrollToEnd"
      >
        <span class="server-rail__nav-glyph dbru-text-lg dbru-text-main" aria-hidden="true">›</span>
      </button>

      <div
        v-if="showScrollIndicator"
        class="server-rail__range"
        aria-hidden="true"
      >
        <span class="server-rail__range-track">
          <span class="server-rail__range-thumb" :style="rangeThumbStyle" />
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { DbrAvatar } from "dobruniaui-vue";
import { ENABLE_SERVER_RAIL_MOCKS, SERVER_RAIL_MOCK_SERVERS } from "./mockServers";
import { buildAppServerRoute } from "../../router/serverRoutes";
import { useAuthStore } from "../../stores/auth";
import { useServersStore } from "../../stores/servers";

defineProps<{
  selectedServerId?: string | null;
}>();

const authStore = useAuthStore();
const serversStore = useServersStore();
const serverViewportElement = ref<HTMLDivElement | null>(null);
const scrollLeft = ref(0);
const maxScrollLeft = ref(0);
const visibleRatio = ref(1);
let viewportResizeObserver: ResizeObserver | null = null;

/**
 * Возвращает реальные серверы пользователя, а до их появления — временные заглушки для layout.
 */
const displayServers = computed(() => {
  if (serversStore.items.length > 0) {
    return serversStore.items;
  }

  if (ENABLE_SERVER_RAIL_MOCKS) {
    return SERVER_RAIL_MOCK_SERVERS;
  }

  return [];
});

/**
 * Показывает левую стрелку только после реального ухода от начала списка.
 */
const canScrollLeft = computed(() => scrollLeft.value > 8);

/**
 * Показывает правую стрелку, пока в списке остается скрытая часть справа.
 */
const canScrollRight = computed(() => maxScrollLeft.value - scrollLeft.value > 8);

/**
 * Тонкий индикатор диапазона нужен только если список действительно шире viewport.
 */
const showScrollIndicator = computed(() => maxScrollLeft.value > 0);

/**
 * Стили для thumb-индикатора текущего положения в серверном рейле.
 */
const rangeThumbStyle = computed(() => {
  const widthPercent = Math.max(12, visibleRatio.value * 100);
  const travelPercent = Math.max(0, 100 - widthPercent);
  const offsetPercent =
    maxScrollLeft.value > 0 ? (scrollLeft.value / maxScrollLeft.value) * travelPercent : 0;

  return {
    width: `${widthPercent}%`,
    transform: `translateX(${offsetPercent}%)`,
  };
});

/**
 * Возвращает URL выбранного сервера для семантической навигации через ссылку.
 */
function buildServerRoute(serverId: string): string {
  return buildAppServerRoute(serverId);
}

/**
 * Преобразует вертикальное колесико мыши в горизонтальный скролл списка серверов.
 */
function handleWheelScroll(event: WheelEvent): void {
  const serverViewport = serverViewportElement.value;

  if (!serverViewport || serverViewport.scrollWidth <= serverViewport.clientWidth) {
    return;
  }

  const delta = normalizeWheelDelta(event, serverViewport.clientWidth);

  if (delta === 0) {
    return;
  }

  const maxAllowedScrollLeft = serverViewport.scrollWidth - serverViewport.clientWidth;
  const nextScrollLeft = clampScrollLeft(serverViewport.scrollLeft + delta, maxAllowedScrollLeft);

  serverViewport.scrollLeft = nextScrollLeft;
  syncScrollState();
}

/**
 * Нормализует wheel-дельту, чтобы горизонтальный скролл был предсказуемым
 * для мыши, тачпада и браузеров с разными режимами deltaMode.
 */
function normalizeWheelDelta(event: WheelEvent, containerWidth: number): number {
  const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX;

  if (rawDelta === 0) {
    return 0;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return rawDelta * 20;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return rawDelta * containerWidth * 0.85;
  }

  return rawDelta;
}

/**
 * Ограничивает scrollLeft допустимым диапазоном контейнера.
 */
function clampScrollLeft(nextScrollLeft: number, maxAllowedScrollLeft: number): number {
  return Math.min(Math.max(nextScrollLeft, 0), maxAllowedScrollLeft);
}

/**
 * Синхронизирует локальное состояние скролла для стрелок и индикатора диапазона.
 */
function syncScrollState(): void {
  const serverViewport = serverViewportElement.value;

  if (!serverViewport) {
    scrollLeft.value = 0;
    maxScrollLeft.value = 0;
    visibleRatio.value = 1;
    return;
  }

  const nextMaxScrollLeft = Math.max(serverViewport.scrollWidth - serverViewport.clientWidth, 0);

  scrollLeft.value = clampScrollLeft(serverViewport.scrollLeft, nextMaxScrollLeft);
  maxScrollLeft.value = nextMaxScrollLeft;
  visibleRatio.value =
    serverViewport.scrollWidth > 0
      ? Math.min(serverViewport.clientWidth / serverViewport.scrollWidth, 1)
      : 1;
}

/**
 * Быстро переносит пользователя в начало списка серверов.
 */
function scrollToStart(): void {
  const serverViewport = serverViewportElement.value;

  if (!serverViewport) {
    return;
  }

  serverViewport.scrollTo({
    left: 0,
    behavior: "smooth",
  });
}

/**
 * Быстро переносит пользователя в конец списка серверов.
 */
function scrollToEnd(): void {
  const serverViewport = serverViewportElement.value;

  if (!serverViewport) {
    return;
  }

  serverViewport.scrollTo({
    left: serverViewport.scrollWidth,
    behavior: "smooth",
  });
}

watch(
  () => authStore.sessionToken,
  (sessionToken) => {
    if (!sessionToken) {
      serversStore.reset();
      return;
    }

    if (
      !serversStore.isLoading &&
      serversStore.loadedForSessionToken !== sessionToken
    ) {
      void serversStore.loadServers().catch(() => undefined);
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => displayServers.value.length,
  async () => {
    await nextTick();
    syncScrollState();
  },
  {
    immediate: true,
  },
);

onMounted(() => {
  syncScrollState();

  if (typeof ResizeObserver !== "undefined") {
    viewportResizeObserver = new ResizeObserver(() => {
      syncScrollState();
    });

    if (serverViewportElement.value) {
      viewportResizeObserver.observe(serverViewportElement.value);
    }
  }
});

onBeforeUnmount(() => {
  viewportResizeObserver?.disconnect();
  viewportResizeObserver = null;
});
</script>

<style scoped>
.server-rail {
  min-width: 0;
  display: flex;
  overflow: hidden;
  align-items: center;
}

.server-rail__state {
  margin: 0;
  flex-shrink: 0;
}

.server-rail__viewport {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
}

.server-rail__viewport-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.server-rail__viewport::-webkit-scrollbar {
  display: none;
}

.server-rail__list {
  list-style: none;
  display: flex;
  width: max-content;
  min-width: max-content;
  gap: var(--dbru-space-3);
  align-items: center;
  margin: 0;
  padding: 0;
}

.server-rail__item {
  flex: 0 0 auto;
}

.server-rail__server-button {
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--dbru-radius-md);
  background: transparent;
  text-decoration: none;
  cursor: pointer;
  transition: transform 160ms ease;
}

.server-rail__server-button:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 2px;
}

.server-rail__server-button:active {
  transform: scale(0.97);
}

.server-rail__nav {
  position: absolute;
  top: 50%;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--dbru-color-surface);
  color: var(--dbru-color-text);
  box-shadow: var(--dbru-shadow-sm);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    opacity 160ms ease;
  backdrop-filter: blur(10px);
}

.server-rail__nav:hover {
  background-color: var(--icon-button-hover);
}

.server-rail__nav:focus-visible {
  outline: var(--dbru-border-size-2) solid var(--dbru-color-focus);
  outline-offset: 2px;
}

.server-rail__nav:active {
  transform: translateY(-50%) scale(0.96);
}

.server-rail__nav--left {
  left: var(--dbru-space-1);
}

.server-rail__nav--right {
  right: var(--dbru-space-1);
}

.server-rail__range {
  position: absolute;
  right: var(--dbru-space-2);
  bottom: calc(var(--dbru-space-1) * -1);
  left: var(--dbru-space-2);
  pointer-events: none;
}

.server-rail__range-track {
  display: block;
  height: 3px;
  border-radius: 999px;
  background: var(--dbru-color-border);
  overflow: hidden;
}

.server-rail__range-thumb {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dbru-color-primary);
  transition:
    transform 140ms ease,
    width 140ms ease;
}

.server-rail__state--error {
  color: var(--dbru-color-error);
}

@media (max-width: 640px) {
  .server-rail {
    gap: var(--dbru-space-2);
  }

  .server-rail__nav {
    width: 1.85rem;
    height: 1.85rem;
  }
}
</style>
