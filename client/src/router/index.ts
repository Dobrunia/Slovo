import { createRouter, createWebHistory } from "vue-router";
import {
  APP_HOME_ROUTE_PATH,
  DEFAULT_CLIENT_APP_TITLE,
  ROOT_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
  PRIVACY_POLICY_ROUTE_PATH,
  REGISTER_ROUTE_PATH,
  SERVER_INVITE_ROUTE_PATH,
} from "../constants";
import { resolveRouteAccess } from "./guards";
import {
  APP_HOME_ROUTE_NAME,
  APP_SERVER_CHANNEL_ROUTE_NAME,
  APP_SERVER_CHANNEL_ROUTE_PATH,
  APP_SERVER_ROUTE_NAME,
  APP_SERVER_ROUTE_PATH,
  SERVER_INVITE_ROUTE_NAME,
} from "./serverRoutes";
import { pinia } from "../stores/pinia";
import { useAuthStore } from "../stores/auth";
import HomePage from "../views/HomePage.vue";
import LandingPage from "../views/LandingPage.vue";
import LoginPage from "../views/LoginPage.vue";
import PrivacyPolicyPage from "../views/PrivacyPolicyPage.vue";
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
        guestLayout: "login",
        title: "Вход",
      },
    },
    {
      path: REGISTER_ROUTE_PATH,
      component: RegisterPage,
      meta: {
        guestOnly: true,
        guestLayout: "register",
        title: "Регистрация",
      },
    },
    {
      path: PRIVACY_POLICY_ROUTE_PATH,
      component: PrivacyPolicyPage,
      meta: {
        title: "Политика обработки персональных данных",
      },
    },
    {
      path: APP_HOME_ROUTE_PATH,
      name: APP_HOME_ROUTE_NAME,
      component: HomePage,
      meta: {
        requiresAuth: true,
        title: DEFAULT_CLIENT_APP_TITLE,
      },
    },
    {
      path: APP_SERVER_ROUTE_PATH,
      name: APP_SERVER_ROUTE_NAME,
      component: HomePage,
      meta: {
        requiresAuth: true,
        title: DEFAULT_CLIENT_APP_TITLE,
      },
    },
    {
      path: APP_SERVER_CHANNEL_ROUTE_PATH,
      name: APP_SERVER_CHANNEL_ROUTE_NAME,
      component: HomePage,
      meta: {
        requiresAuth: true,
        title: DEFAULT_CLIENT_APP_TITLE,
      },
    },
    {
      path: SERVER_INVITE_ROUTE_PATH,
      name: SERVER_INVITE_ROUTE_NAME,
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

  return resolveRouteAccess(
    {
      meta: to.meta,
      fullPath: to.fullPath,
    },
    authStore.isAuthenticated,
  );
});
