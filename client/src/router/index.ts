import { createRouter, createWebHistory } from "vue-router";
import {
  APP_HOME_ROUTE_PATH,
  DEFAULT_CLIENT_APP_TITLE,
  ROOT_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
  REGISTER_ROUTE_PATH,
} from "../constants";
import { resolveRouteAccess } from "./guards";
import { pinia } from "../stores/pinia";
import { useAuthStore } from "../stores/auth";
import HomePage from "../views/HomePage.vue";
import LandingPage from "../views/LandingPage.vue";
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
      component: LandingPage,
      meta: {
        guestOnly: true,
        guestLayout: "landing",
        title: DEFAULT_CLIENT_APP_TITLE,
      },
    },
    {
      path: LOGIN_ROUTE_PATH,
      component: LoginPage,
      meta: {
        guestOnly: true,
        guestLayout: "auth",
        title: "Вход",
      },
    },
    {
      path: REGISTER_ROUTE_PATH,
      component: RegisterPage,
      meta: {
        guestOnly: true,
        guestLayout: "auth",
        title: "Регистрация",
      },
    },
    {
      path: APP_HOME_ROUTE_PATH,
      component: HomePage,
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

  return resolveRouteAccess(to.meta, authStore.isAuthenticated);
});
