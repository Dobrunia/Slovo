import { createRouter, createWebHistory } from "vue-router";
import {
  APP_HOME_ROUTE_PATH,
  DEFAULT_CLIENT_APP_TITLE,
  LOGIN_ROUTE_PATH,
  REGISTER_ROUTE_PATH,
  ROOT_ROUTE_PATH,
} from "../constants";
import { pinia } from "../stores/pinia";
import { useAuthStore } from "../stores/auth";
import AppHomePage from "../views/AppHomePage.vue";
import LoginPage from "../views/LoginPage.vue";
import RegisterPage from "../views/RegisterPage.vue";

/**
 * Основной роутер клиентского приложения.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: ROOT_ROUTE_PATH,
      redirect: () => {
        const authStore = useAuthStore(pinia);
        return authStore.sessionToken ? APP_HOME_ROUTE_PATH : LOGIN_ROUTE_PATH;
      },
    },
    {
      path: LOGIN_ROUTE_PATH,
      component: LoginPage,
      meta: {
        guestOnly: true,
        title: "Вход",
      },
    },
    {
      path: REGISTER_ROUTE_PATH,
      component: RegisterPage,
      meta: {
        guestOnly: true,
        title: "Регистрация",
      },
    },
    {
      path: APP_HOME_ROUTE_PATH,
      component: AppHomePage,
      meta: {
        requiresAuth: true,
        title: DEFAULT_CLIENT_APP_TITLE,
      },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);

  if (!authStore.isInitialized && authStore.status !== "initializing") {
    await authStore.initialize();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return LOGIN_ROUTE_PATH;
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return APP_HOME_ROUTE_PATH;
  }

  return true;
});
