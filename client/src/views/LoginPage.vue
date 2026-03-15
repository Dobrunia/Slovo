<template>
  <section class="login-page">
    <AuthFormPanel
      eyebrow="Авторизация"
      title="Вход в Slovo"
      description="Используйте email и пароль существующего пользователя."
      :error-message="errorMessage"
      footer-text="Еще нет аккаунта?"
      footer-link-label="Создать аккаунт"
      :footer-to="REGISTER_ROUTE_PATH"
      @submit="handleSubmit"
    >
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

      <template #actions>
        <DbrButton :disabled="authStore.isSubmitting" :native-type="'submit'">
          {{ submitLabel }}
        </DbrButton>
      </template>
    </AuthFormPanel>
  </section>
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
 * Текст кнопки отправки формы логина.
 */
const submitLabel = computed(() => (authStore.isSubmitting ? "Входим..." : "Войти"));

/**
 * Текущее сообщение об ошибке auth store.
 */
const errorMessage = computed(() => authStore.errorMessage);

/**
 * Отправляет логин-форму и переводит пользователя в защищенный раздел.
 */
async function handleSubmit(): Promise<void> {
  await authStore.login({
    email: form.email,
    password: form.password,
  });

  await router.replace(APP_HOME_ROUTE_PATH);
}
</script>

<style scoped>
.login-page {
  display: grid;
}
</style>
