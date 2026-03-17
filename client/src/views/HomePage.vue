<script setup lang="ts">
import { ref } from "vue";
import AppIconButton from "../components/base/AppIconButton.vue";
import addServerIcon from "../assets/icons/add-server.svg";
import settingsIcon from "../assets/icons/settings.svg";
import UserSettingsModal from "../modules/settings/UserSettingsModal.vue";
import ServerRailModule from "../modules/servers/ServerRailModule.vue";

const isSettingsOpen = ref(false);

/**
 * Переключает видимость модального окна с настройками пользователя.
 */
function toggleSettings(): void {
  isSettingsOpen.value = !isSettingsOpen.value;
}

/**
 * Закрывает модальное окно с настройками.
 */
function closeSettings(): void {
  isSettingsOpen.value = false;
}

/**
 * Временная заглушка до реализации создания сервера.
 */
function handleAddServer(): void {
  // Действие появится в следующем наборе задач.
}
</script>

<template>
  <div class="home-page">
    <header class="home-page__header">
      <div class="home-page__rail">
        <ServerRailModule />
      </div>

      <div class="home-page__actions">
        <AppIconButton
          :icon-src="addServerIcon"
          label="Добавить сервер"
          icon-alt=""
          @click="handleAddServer"
        />

        <AppIconButton
          :icon-src="settingsIcon"
          label="Открыть настройки"
          icon-alt=""
          @click="toggleSettings"
        />
      </div>
    </header>

    <div class="home-page__body">
      <aside class="home-page__sidebar">
        <section class="home-page__panel">
          <p class="home-page__eyebrow">Список каналов</p>
          <h2 class="home-page__panel-title">Появится позже</h2>
        </section>

        <section class="home-page__panel">
          <p class="home-page__eyebrow">Превью аккаунта</p>
          <h2 class="home-page__panel-title">Появится позже</h2>
        </section>
      </aside>

      <section class="home-page__stage">
        <p class="home-page__eyebrow">Главная зона сервера</p>
        <h1 class="home-page__stage-title">Контент появится позже</h1>
      </section>
    </div>

    <UserSettingsModal :is-open="isSettingsOpen" @close="closeSettings" />
  </div>
</template>

<style scoped>
.home-page {
  display: grid;
  gap: var(--dbru-space-4);
}

.home-page__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-4);
  align-items: center;
  padding-inline: var(--dbru-space-4);
}

.home-page__rail {
  min-width: 0;
}

.home-page__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dbru-space-2);
}

.home-page__body {
  display: grid;
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
  gap: var(--dbru-space-4);
  min-height: 0;
}

.home-page__sidebar {
  display: grid;
  gap: var(--dbru-space-4);
  min-height: 0;
}

.home-page__panel,
.home-page__stage {
  display: grid;
  gap: var(--dbru-space-3);
  align-content: start;
  min-height: 12rem;
  padding: var(--dbru-space-5);
  border: 1px solid var(--dbru-color-border);
  border-radius: var(--dbru-radius-md);
  background: color-mix(in srgb, var(--dbru-color-bg) 92%, white);
}

.home-page__stage {
  min-height: 100%;
}

.home-page__eyebrow {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--dbru-color-text) 62%, transparent);
}

.home-page__panel-title,
.home-page__stage-title {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.2;
}

.home-page__stage-title {
  font-size: 1.45rem;
}

@media (max-width: 960px) {
  .home-page__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .home-page__header {
    grid-template-columns: 1fr;
    padding-inline: var(--dbru-space-3);
  }

  .home-page__actions {
    justify-content: flex-end;
  }

  .home-page__panel,
  .home-page__stage {
    padding: var(--dbru-space-4);
  }
}
</style>
