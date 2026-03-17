import { describe, expect, test } from "vitest";
import {
  APP_HOME_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
  REGISTER_ROUTE_PATH,
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
    expect(resolveRouteAccess({ meta: { guestOnly: true }, fullPath: "/" }, true)).toBe(APP_HOME_ROUTE_PATH);
    expect(resolveRouteAccess({ meta: { guestOnly: true, guestLayout: "landing" }, fullPath: "/" }, true)).toBe(
      APP_HOME_ROUTE_PATH,
    );
    expect(resolveRouteAccess({ meta: { guestOnly: true, guestLayout: "auth" }, fullPath: "/login" }, true)).toBe(
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
    expect(
      resolveRouteAccess({ meta: { requiresAuth: true }, fullPath: "/app" }, false),
    ).toEqual({
      path: LOGIN_ROUTE_PATH,
      query: {
        redirect: "/app",
      },
    });
    expect(resolveRouteAccess({ meta: { guestOnly: true }, fullPath: "/" }, false)).toBe(true);
  });

  /**
 * Проверяется, что попытка открыть invite-ссылку без активной сессии
 * ведет пользователя сразу на регистрацию и сохраняет исходный путь в redirect-параметре.
 * Это важно, потому что invite-flow должен превращаться в onboarding-путь:
 * пользователь регистрируется и после этого автоматически попадает обратно на invite URL.
 * Граничные случаи: редирект должен сохранить именно полный путь invite-маршрута
 * и не должен отправлять пользователя на обычную страницу логина.
 */
test("should preserve invite route as redirect target for anonymous users", () => {
  expect(
      resolveRouteAccess(
        {
          meta: { requiresAuth: true },
          fullPath: "/invite/token-123",
        },
        false,
      ),
    ).toEqual({
      path: REGISTER_ROUTE_PATH,
      query: {
        redirect: "/invite/token-123",
      },
    });
  });
});
