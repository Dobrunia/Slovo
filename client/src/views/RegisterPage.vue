<template>
  <section class="register-page">
    <AuthFormPanel
      eyebrow="Регистрация"
      title="Новый аккаунт Slovo"
      description="Создайте учетную запись и затем войдите в приложение."
      :error-message="errorMessage"
      footer-text="Уже есть аккаунт?"
      footer-link-label="Перейти ко входу"
      :footer-to="LOGIN_ROUTE_PATH"
      @submit="handleSubmit"
    >
      <DbrInput
        v-model="form.email"
        label="Email"
        autocomplete="email"
        required
      />

      <DbrInput
        v-model="form.username"
        label="Username"
        autocomplete="username"
        required
      />

      <DbrInput
        v-model="form.displayName"
        label="Отображаемое имя"
        autocomplete="nickname"
        required
      />

      <DbrInput
        v-model="form.password"
        label="Пароль"
        type="password"
        autocomplete="new-password"
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
import { LOGIN_ROUTE_PATH } from "../constants";
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
 * Текст кнопки отправки формы регистрации.
 */
const submitLabel = computed(() => (authStore.isSubmitting ? "Создаем..." : "Создать аккаунт"));

/**
 * Текущее сообщение об ошибке auth store.
 */
const errorMessage = computed(() => authStore.errorMessage);

/**
 * Отправляет форму регистрации и переводит пользователя на страницу логина.
 */
async function handleSubmit(): Promise<void> {
  await authStore.register({
    email: form.email,
    username: form.username,
    displayName: form.displayName,
    password: form.password,
  });

  await router.replace(LOGIN_ROUTE_PATH);
}
</script>

<style scoped>
.register-page {
  display: grid;
}
</style>
