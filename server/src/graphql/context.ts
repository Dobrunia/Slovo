import { resolveSessionUserId } from "../auth/session.js";
import type { DataLayer } from "../data/prisma.js";
import type { SlovoRealtimeRuntime } from "../realtime/runtime.js";

/**
 * Контекст GraphQL-запроса, общий для StrictQL-резолверов.
 */
export type GraphqlContext = {
  dataLayer: DataLayer;
  userId: string | null;
  realtimeRuntime: SlovoRealtimeRuntime | null;
};

type ContextInput = {
  dataLayer: DataLayer;
  realtimeRuntime?: SlovoRealtimeRuntime | null;
  request: Request;
};

/**
 * Создает единый контекст запроса для GraphQL-операций.
 */
export async function createGraphqlContext(input: ContextInput): Promise<GraphqlContext> {
  return {
    dataLayer: input.dataLayer,
    userId: await resolveSessionUserId({
      dataLayer: input.dataLayer,
      headers: input.request.headers,
    }),
    realtimeRuntime: input.realtimeRuntime ?? null,
  };
}
