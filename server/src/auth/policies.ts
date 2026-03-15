import { createPolicy } from "strictql";
import type { GraphqlContext } from "../graphql/context.js";

/**
 * Policy, разрешающая только аутентифицированные GraphQL-операции с session-backed userId.
 */
export const authenticatedPolicy = createPolicy<GraphqlContext>({
  name: "authenticated",
  check: (ctx) => ({
    allowed: Boolean(ctx.userId),
    reason: "Требуется авторизация.",
  }),
});
