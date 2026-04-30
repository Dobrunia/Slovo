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

      <div class="register-page__consent dbru-text-sm">
        <DbrCheckbox
          v-model="isPersonalDataConsentAccepted"
          class="register-page__consent-control"
          @update:model-value="consentErrorMessage = null"
        />
        <p class="register-page__consent-text" @click="togglePersonalDataConsent">
          Я даю согласие на обработку моих персональных данных в целях регистрации, авторизации и
          использования сервиса в соответствии с
          <RouterLink
            class="register-page__consent-link"
            :to="PRIVACY_POLICY_ROUTE_PATH"
            @click.stop
          >
            [Политикой в отношении обработки персональных данных]
          </RouterLink>
          .
        </p>
      </div>

      <p v-if="consentErrorMessage" class="register-page__error dbru-text-sm">
        {{ consentErrorMessage }}
      </p>

      <p v-if="errorMessage" class="register-page__error dbru-text-sm">
        {{ errorMessage }}
      </p>

      <DbrButton
        class="register-page__primary-action"
        :disabled="isSubmitDisabled"
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
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DbrButton, DbrCheckbox, DbrInput } from "dobruniaui-vue";
import AuthFormPanel from "../components/auth/AuthFormPanel.vue";
import {
  APP_HOME_ROUTE_PATH,
  AUTH_REDIRECT_QUERY_KEY,
  LOGIN_ROUTE_PATH,
  PRIVACY_POLICY_ROUTE_PATH,
} from "../constants";
import { readAuthRedirectPath } from "../router/guards";
import { useAuthStore } from "../stores/auth";
import type { RegisterFormModel } from "../types/auth";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive<RegisterFormModel>({
  email: "",
  username: "",
  displayName: "",
  password: "",
});
const isPersonalDataConsentAccepted = ref(false);
const consentErrorMessage = ref<string | null>(null);

/**
 * Текст основной кнопки регистрации.
 */
const submitLabel = computed(() => (authStore.isSubmitting ? "Создаем..." : "Создать аккаунт"));

/**
 * Сообщение об ошибке регистрации.
 */
const errorMessage = computed(() => authStore.errorMessage);
const isSubmitDisabled = computed(
  () => authStore.isSubmitting || !isPersonalDataConsentAccepted.value,
);

/**
 * Выполняет регистрацию и сразу переводит пользователя в приложение.
 */
async function handleSubmit(): Promise<void> {
  if (!isPersonalDataConsentAccepted.value) {
    consentErrorMessage.value = "Нужно согласиться на обработку персональных данных.";
    return;
  }

  await authStore.register({
    email: form.email,
    username: form.username,
    displayName: form.displayName,
    password: form.password,
  });

  await router.replace(
    readAuthRedirectPath(route.query[AUTH_REDIRECT_QUERY_KEY]) ?? APP_HOME_ROUTE_PATH,
  );
}

/**
 * Переводит пользователя на экран входа.
 */
async function goToLogin(): Promise<void> {
  await router.replace({
    path: LOGIN_ROUTE_PATH,
    query: {
      [AUTH_REDIRECT_QUERY_KEY]:
        readAuthRedirectPath(route.query[AUTH_REDIRECT_QUERY_KEY]) ?? undefined,
    },
  });
}

/**
 * Переключает согласие при клике на текст рядом с чекбоксом.
 */
function togglePersonalDataConsent(): void {
  isPersonalDataConsentAccepted.value = !isPersonalDataConsentAccepted.value;
  consentErrorMessage.value = null;
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
  height: var(--dbru-border-size-1);
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

.register-page__consent {
  display: flex;
  align-items: flex-start;
  gap: var(--dbru-space-2);
}

.register-page__consent-control {
  flex: 0 0 auto;
}

.register-page__consent-text {
  margin: 0;
  cursor: pointer;
}

.register-page__consent-link {
  color: var(--dbru-color-primary);
}
</style>
