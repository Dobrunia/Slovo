import type { RouteLocationRaw } from "vue-router";
import {
  APP_HOME_ROUTE_PATH,
  AUTH_REDIRECT_QUERY_KEY,
  LOGIN_ROUTE_PATH,
  REGISTER_ROUTE_PATH,
  SERVER_INVITE_ROUTE_PREFIX,
} from "../constants";

/**
 * Минимальный набор route meta, который влияет на доступ к странице.
 */
export interface RouteAccessMeta {
  guestOnly?: boolean;
  requiresAuth?: boolean;
  [key: string]: unknown;
}

/**
 * Минимальный контракт маршрута для вычисления доступа и redirect target.
 */
export interface RouteAccessTarget {
  meta: RouteAccessMeta;
  fullPath: string;
}

/**
 * Вычисляет результат доступа к маршруту на основе auth-состояния пользователя.
 */
export function resolveRouteAccess(
  target: RouteAccessTarget,
  isAuthenticated: boolean,
): true | RouteLocationRaw {
  if (target.meta.requiresAuth && !isAuthenticated) {
    const authEntryPath = target.fullPath.startsWith(SERVER_INVITE_ROUTE_PREFIX)
      ? REGISTER_ROUTE_PATH
      : LOGIN_ROUTE_PATH;

    return {
      path: authEntryPath,
      query: {
        [AUTH_REDIRECT_QUERY_KEY]: target.fullPath,
      },
    };
  }

  if (target.meta.guestOnly && isAuthenticated) {
    return APP_HOME_ROUTE_PATH;
  }

  return true;
}

/**
 * Возвращает безопасный post-auth redirect path из route query.
 */
export function readAuthRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue.startsWith("/")) {
    return null;
  }

  return normalizedValue;
}
