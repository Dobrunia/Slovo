import type { GraphqlContext } from "../graphql/context.js";

/**
 * Каноническая причина отказа для операций, требующих валидную auth-сессию.
 */
export const AUTHENTICATION_REQUIRED_REASON = "Требуется авторизация.";

/**
 * Возвращает идентификатор текущего пользователя из GraphQL-контекста
 * или завершает операцию человекочитаемой ошибкой авторизации.
 */
export function requireCurrentUser(ctx: GraphqlContext): string {
  if (!ctx.userId) {
    throw new Error(AUTHENTICATION_REQUIRED_REASON);
  }

  return ctx.userId;
}
