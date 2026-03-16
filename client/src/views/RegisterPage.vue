<template>
  <AuthFormPanel title="Регистрация">
    <form class="register-page__form" @submit.prevent="handleSubmit">
      <div class="register-page__fields">
        <DbrInput
          v-model="form.email"
          label="Email"
          required
        />

        <DbrInput
          v-model="form.username"
          label="Username"
          icon-position="left"
          required
        >
          <template #icon>@</template>
        </DbrInput>

        <DbrInput
          v-model="form.displayName"
          label="Отображаемое имя"
          required
        />

        <DbrInput
          v-model="form.password"
          label="Пароль"
          type="password"
          required
        />
      </div>

      <p v-if="errorMessage" class="register-page__error dbru-text-sm">
        {{ errorMessage }}
      </p>

      <DbrButton
        class="register-page__primary-action"
        :disabled="authStore.isSubmitting"
        :native-type="'submit'"
      >
        {{ submitLabel }}
      </DbrButton>
    </form>

    <div class="register-page__divider" aria-hidden="true">
      <span class="register-page__divider-line"></span>
      <span class="register-page__divider-text dbru-text-sm dbru-text-muted">Уже есть аккаунт?</span>
      <span class="register-page__divider-line"></span>
    </div>

    <DbrButton
      class="register-page__secondary-action"
      variant="ghost"
      :native-type="'button'"
      @click="goToLogin"
    >
      Войти
    </DbrButton>
  </AuthFormPanel>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import { DbrButton, DbrInput } from "dobruniaui-vue";
import AuthFormPanel from "../components/auth/AuthFormPanel.vue";
import { APP_HOME_ROUTE_PATH, LOGIN_ROUTE_PATH } from "../constants";
import { useAuthStore } from "../stores/auth";
import type { RegisterFormModel } from "../types/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive<RegisterFormModel>({
  email: "",
  username: "",
  displayName: "",
  password: "",
});

/**
 * Текст основной кнопки регистрации.
 */
const submitLabel = computed(() => (authStore.isSubmitting ? "Создаем..." : "Создать аккаунт"));

/**
 * Сообщение об ошибке регистрации.
 */
const errorMessage = computed(() => authStore.errorMessage);

/**
 * Выполняет регистрацию и сразу переводит пользователя в приложение.
 */
async function handleSubmit(): Promise<void> {
  await authStore.register({
    email: form.email,
    username: form.username,
    displayName: form.displayName,
    password: form.password,
  });

  await router.replace(APP_HOME_ROUTE_PATH);
}

/**
 * Переводит пользователя на экран входа.
 */
async function goToLogin(): Promise<void> {
  await router.replace(LOGIN_ROUTE_PATH);
}
</script>

<style scoped>
.register-page__form {
  display: grid;
  gap: var(--dbru-space-4);
}

.register-page__fields {
  display: grid;
  gap: var(--dbru-space-4);
}

.register-page__primary-action {
  width: 100%;
}

.register-page__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--dbru-space-3);
  align-items: center;
}

.register-page__divider-line {
  height: 1px;
  background: var(--dbru-color-border);
}

.register-page__divider-text {
  white-space: nowrap;
}

.register-page__secondary-action {
  width: 100%;
}

.register-page__error {
  margin: 0;
  color: var(--dbru-color-error);
}
</style>
