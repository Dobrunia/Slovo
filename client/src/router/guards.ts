import { APP_HOME_ROUTE_PATH, LOGIN_ROUTE_PATH } from "../constants";

/**
 * Минимальный набор route meta, который влияет на доступ к странице.
 */
export interface RouteAccessMeta {
  guestOnly?: boolean;
  requiresAuth?: boolean;
  [key: string]: unknown;
}

/**
 * Вычисляет результат доступа к маршруту на основе auth-состояния пользователя.
 */
export function resolveRouteAccess(
  meta: RouteAccessMeta,
  isAuthenticated: boolean,
): true | string {
  if (meta.requiresAuth && !isAuthenticated) {
    return LOGIN_ROUTE_PATH;
  }

  if (meta.guestOnly && isAuthenticated) {
    return APP_HOME_ROUTE_PATH;
  }

  return true;
}
