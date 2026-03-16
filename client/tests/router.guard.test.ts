import { describe, expect, test } from "vitest";
import {
  APP_HOME_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
} from "../src/constants";
import { resolveRouteAccess } from "../src/router/guards";

describe("router guards", () => {
  /**
   * Проверяется, что стартовая страница, вход и регистрация остаются гостевыми маршрутами
   * и недоступны уже авторизованному пользователю.
   * Это важно, потому что после появления landing-page пользователь с активной сессией
   * не должен видеть повторно ни промо-экран, ни auth-формы, а должен сразу попадать в аккаунт.
   * Граничные случаи: проверяются сразу три гостевых сценария подряд, чтобы поведение не было
   * случайно зашито только под одну конкретную страницу.
   */
  test("should redirect authenticated users away from all guest-only routes", () => {
    expect(resolveRouteAccess({ guestOnly: true }, true)).toBe(APP_HOME_ROUTE_PATH);
    expect(resolveRouteAccess({ guestOnly: true, guestLayout: "landing" }, true)).toBe(
      APP_HOME_ROUTE_PATH,
    );
    expect(resolveRouteAccess({ guestOnly: true, guestLayout: "auth" }, true)).toBe(
      APP_HOME_ROUTE_PATH,
    );
  });

  /**
   * Проверяется, что защищенный маршрут приложения все еще закрыт для гостя
   * и отправляет его на страницу входа.
   * Это важно, потому что после добавления стартовой landing-page нельзя потерять
   * базовую защиту приватной части приложения для неавторизованного пользователя.
   * Граничные случаи: helper должен вернуть редирект только для приватного маршрута,
   * а для обычной гостевой страницы без активной сессии обязан разрешить доступ.
   */
  test("should redirect anonymous users from the private app route to login", () => {
    expect(resolveRouteAccess({ requiresAuth: true }, false)).toBe(LOGIN_ROUTE_PATH);
    expect(resolveRouteAccess({ guestOnly: true }, false)).toBe(true);
  });
});
