<template>
  <section class="home-page">
    <header class="home-page__topbar dbru-surface">
      <div class="home-page__topbar-main">
        <ServerRailModule />
      </div>

      <div class="home-page__topbar-actions">
        <DbrButton
          class="home-page__action-btn"
          variant="ghost"
          :native-type="'button'"
          disabled
        >
          <span class="home-page__action-symbol">+</span>
        </DbrButton>

        <DbrButton
          class="home-page__action-btn"
          variant="ghost"
          :native-type="'button'"
          :pressed="isSettingsOpen"
          @click="toggleSettings"
        >
          <img
            :src="settingsIcon"
            alt=""
            aria-hidden="true"
            class="home-page__icon"
          />
        </DbrButton>
      </div>
    </header>

    <div class="home-page__layout">
      <aside class="home-page__sidebar">
        <section class="home-page__panel dbru-surface">
          <div class="home-page__panel-copy">
            <p class="dbru-text-xs dbru-text-muted">Voice Channels</p>
            <h2 class="dbru-text-base dbru-text-main">Список каналов</h2>
            <p class="dbru-text-sm dbru-text-muted">
              Здесь появится список voice-каналов сервера.
            </p>
          </div>
        </section>

        <section class="home-page__panel dbru-surface">
          <div class="home-page__panel-copy">
            <p class="dbru-text-xs dbru-text-muted">Account Preview</p>
            <h2 class="dbru-text-base dbru-text-main">Превью аккаунта</h2>
            <p class="dbru-text-sm dbru-text-muted">
              Здесь позже будет нижний блок с быстрым превью аккаунта.
            </p>
          </div>
        </section>
      </aside>

      <section class="home-page__stage dbru-surface">
        <div class="home-page__stage-empty">
          <p class="dbru-text-xs dbru-text-muted">Lobby</p>
          <h1 class="dbru-text-lg dbru-text-main">Главная зона сервера</h1>
          <p class="dbru-text-sm dbru-text-muted">
            Пока здесь пусто. В дальнейшем сюда встанет активный канал или лобби сервера.
          </p>
        </div>
      </section>
    </div>

    <UserSettingsModal
      :is-open="isSettingsOpen"
      @close="closeSettings"
    />
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DbrButton } from "dobruniaui-vue";
import settingsIcon from "../assets/icons/settings.svg";
import UserSettingsModal from "../modules/settings/UserSettingsModal.vue";
import ServerRailModule from "../modules/servers/ServerRailModule.vue";

const isSettingsOpen = ref(false);

/**
 * Переключает видимость модального окна пользовательских настроек.
 */
function toggleSettings(): void {
  isSettingsOpen.value = !isSettingsOpen.value;
}

/**
 * Закрывает модальное окно пользовательских настроек.
 */
function closeSettings(): void {
  isSettingsOpen.value = false;
}
</script>

<style scoped>
.home-page {
  min-height: calc(100dvh - (var(--dbru-space-4) * 2));
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--dbru-space-4);
}

.home-page__topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--dbru-space-4);
  align-items: center;
  padding: var(--dbru-space-4) var(--dbru-space-5);
  border-radius: var(--dbru-radius-md);
}

.home-page__topbar-main {
  min-width: 0;
}

.home-page__topbar-actions {
  display: flex;
  gap: var(--dbru-space-3);
  align-items: center;
}

.home-page__action-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  padding-inline: 0;
  justify-content: center;
}

.home-page__action-symbol {
  font-size: 1.25rem;
  line-height: 1;
}

.home-page__icon {
  width: 1.2rem;
  height: 1.2rem;
  display: block;
}

.home-page__layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(16rem, 18rem) minmax(0, 1fr);
  gap: var(--dbru-space-4);
}

.home-page__sidebar {
  display: grid;
  grid-template-rows: minmax(14rem, 1fr) auto;
  gap: var(--dbru-space-4);
}

.home-page__panel {
  display: grid;
  padding: var(--dbru-space-5);
  border-radius: var(--dbru-radius-md);
}

.home-page__panel-copy,
.home-page__stage-empty {
  display: grid;
  align-content: start;
  gap: var(--dbru-space-2);
}

.home-page__panel-copy p,
.home-page__panel-copy h2,
.home-page__stage-empty p,
.home-page__stage-empty h1 {
  margin: 0;
}

.home-page__stage {
  min-height: 0;
  display: grid;
  padding: var(--dbru-space-6);
  border-radius: var(--dbru-radius-md);
}

.home-page__stage-empty {
  width: min(100%, 40rem);
}

@media (max-width: 840px) {
  .home-page__layout {
    grid-template-columns: 1fr;
  }

  .home-page__sidebar {
    grid-template-rows: auto auto;
  }
}

@media (max-width: 640px) {
  .home-page {
    min-height: calc(100dvh - (var(--dbru-space-4) * 2));
  }

  .home-page__topbar {
    grid-template-columns: 1fr;
    padding: var(--dbru-space-4);
  }

  .home-page__topbar-actions {
    justify-content: flex-end;
  }

  .home-page__panel,
  .home-page__stage {
    padding: var(--dbru-space-4);
  }
}
</style>
