<template>
  <section class="auth-panel">
    <DbrCard as="section" class="auth-panel__card">
      <header class="auth-panel__header">
        <p class="dbru-text-xs dbru-text-muted">{{ eyebrow }}</p>
        <h1 class="dbru-text-lg dbru-text-main">{{ title }}</h1>
        <p class="dbru-text-sm dbru-text-muted">{{ description }}</p>
      </header>

      <form class="auth-panel__form" @submit.prevent="emit('submit')">
        <slot />

        <p v-if="errorMessage" class="auth-panel__error dbru-text-sm">
          {{ errorMessage }}
        </p>

        <div class="auth-panel__actions">
          <slot name="actions" />
        </div>
      </form>

      <footer
        v-if="footerText || footerLinkLabel"
        class="auth-panel__footer dbru-text-sm dbru-text-muted"
      >
        <span v-if="footerText">{{ footerText }}</span>

        <RouterLink
          v-if="footerLinkLabel && footerTo"
          class="auth-panel__footer-link dbru-text-main"
          :to="footerTo"
        >
          {{ footerLinkLabel }}
        </RouterLink>
      </footer>
    </DbrCard>
  </section>
</template>

<script setup lang="ts">
import { DbrCard } from "dobruniaui-vue";
import { RouterLink } from "vue-router";

/**
 * Свойства общей auth-панели клиента.
 */
interface AuthFormPanelProps {
  eyebrow: string;
  title: string;
  description: string;
  errorMessage?: string | null;
  footerText?: string;
  footerLinkLabel?: string;
  footerTo?: string;
}

defineProps<AuthFormPanelProps>();

const emit = defineEmits<{
  submit: [];
}>();
</script>

<style scoped>
.auth-panel {
  display: grid;
}

.auth-panel__card {
  display: grid;
  gap: var(--dbru-space-5);
  padding: var(--dbru-space-6);
  border-radius: var(--dbru-radius-md);
}

.auth-panel__header {
  display: grid;
  gap: var(--dbru-space-2);
}

.auth-panel__form {
  display: grid;
  gap: var(--dbru-space-4);
}

.auth-panel__actions {
  display: flex;
  justify-content: flex-start;
}

.auth-panel__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dbru-space-2);
}

.auth-panel__footer-link {
  text-decoration: none;
}

.auth-panel__footer-link:hover {
  text-decoration: underline;
}

.auth-panel__error {
  color: var(--dbru-color-danger);
}
</style>
