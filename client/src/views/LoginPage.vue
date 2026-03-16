<template>
  <AuthFormPanel title="Вход">
    <form class="login-page__form" @submit.prevent="handleSubmit">
      <div class="login-page__fields">
        <DbrInput
          v-model="form.email"
          label="Email"
          autocomplete="email"
          required
        />

        <DbrInput
          v-model="form.password"
          label="Пароль"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="errorMessage" class="login-page__error dbru-text-sm">
        {{ errorMessage }}
      </p>

      <DbrButton
        class="login-page__primary-action"
        :disabled="authStore.isSubmitting"
        :native-type="'submit'"
      >
        {{ submitLabel }}
      </DbrButton>
    </form>

    <div class="login-page__divider" aria-hidden="true">
      <span class="login-page__divider-line"></span>
      <span class="login-page__divider-text dbru-text-sm dbru-text-muted">Нет аккаунта?</span>
      <span class="login-page__divider-line"></span>
    </div>

    <DbrButton
      class="login-page__secondary-action"
      variant="ghost"
      :native-type="'button'"
      @click="goToRegister"
    >
      Создать аккаунт
    </DbrButton>
  </AuthFormPanel>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import { DbrButton, DbrInput } from "dobruniaui-vue";
import AuthFormPanel from "../components/auth/AuthFormPanel.vue";
import { APP_HOME_ROUTE_PATH, REGISTER_ROUTE_PATH } from "../constants";
import { useAuthStore } from "../stores/auth";
import type { LoginFormModel } from "../types/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive<LoginFormModel>({
  email: "",
  password: "",
});

/**
 * Текст основной кнопки логина.
 */
const submitLabel = computed(() => (authStore.isSubmitting ? "Входим..." : "Войти"));

/**
 * Сообщение об ошибке авторизации.
 */
const errorMessage = computed(() => authStore.errorMessage);

/**
 * Выполняет вход и переводит пользователя в основной раздел.
 */
async function handleSubmit(): Promise<void> {
  await authStore.login({
    email: form.email,
    password: form.password,
  });

  await router.replace(APP_HOME_ROUTE_PATH);
}

/**
 * Переводит пользователя на экран регистрации.
 */
async function goToRegister(): Promise<void> {
  await router.replace(REGISTER_ROUTE_PATH);
}
</script>

<style scoped>
.login-page__fields {
  display: grid;
  gap: var(--dbru-space-4);
}

.login-page__primary-action {
  width: 100%;
  margin-top: var(--dbru-space-4);
}

.login-page__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--dbru-space-3);
  align-items: center;
}

.login-page__divider-line {
  height: 1px;
  background: var(--dbru-color-border);
}

.login-page__divider-text {
  white-space: nowrap;
}

.login-page__secondary-action {
  width: 100%;
}

.login-page__error {
  margin: 0;
  color: var(--dbru-color-error);
}
</style>
