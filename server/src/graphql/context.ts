import type { DataLayer } from "../data/prisma.js";

/**
 * Контекст GraphQL-запроса, общий для StrictQL-резолверов.
 */
export type GraphqlContext = {
  dataLayer: DataLayer;
  userId: string | null;
};

type ContextInput = {
  dataLayer: DataLayer;
  request: Request;
};

/**
 * Создает единый контекст запроса для GraphQL-операций.
 */
export function createGraphqlContext(input: ContextInput): GraphqlContext {
  return {
    dataLayer: input.dataLayer,
    userId: input.request.headers.get("x-user-id"),
  };
}
