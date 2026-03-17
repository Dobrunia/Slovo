import { createPolicy } from "strictql";
import type { GraphqlContext } from "../graphql/context.js";
import { AUTHENTICATION_REQUIRED_REASON } from "./require.js";

/**
 * Базовая policy, разрешающая только операции с валидной auth-сессией.
 * Используется там, где после проверки сессии resolver обязан выполнить
 * дополнительные доменные проверки доступа: membership, manager access и другие.
 *
 * StrictQL operation-level policy получает только `ctx`, поэтому input-aware проверки
 * для конкретного `serverId` остаются на слое domain access helpers.
 */
export const authenticatedPolicy = createPolicy<GraphqlContext>({
  name: "authenticated",
  check: (ctx) => ({
    allowed: Boolean(ctx.userId),
    reason: AUTHENTICATION_REQUIRED_REASON,
  }),
});
