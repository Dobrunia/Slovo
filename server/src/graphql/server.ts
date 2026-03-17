import { createYoga } from 'graphql-yoga';
import { createGraphqlYogaIntegration } from 'strictql';
import type { DataLayer } from '../data/prisma.js';
import { DEFAULT_CLIENT_ORIGIN, DEFAULT_GRAPHQL_PATH } from '../config/constants.js';
import { createGraphqlContext } from './context.js';
import { strictqlApiSchema } from './registry.js';
import type { SlovoRealtimeRuntime } from '../realtime/runtime.js';

type GraphqlServerInput = {
  dataLayer: DataLayer;
  realtimeRuntime?: SlovoRealtimeRuntime | null;
};

/**
 * Поднимает GraphQL Yoga runtime поверх StrictQL-схемы и серверного контекста.
 */
export function createGraphqlServer(input: GraphqlServerInput) {
  const graphqlPath = process.env.GRAPHQL_PATH?.trim()?.startsWith('/')
    ? process.env.GRAPHQL_PATH.trim()
    : DEFAULT_GRAPHQL_PATH;
  const clientOrigin = process.env.CLIENT_ORIGIN?.trim() || DEFAULT_CLIENT_ORIGIN;
  const integration = createGraphqlYogaIntegration({
    schema: strictqlApiSchema,
    injectContext: ({ adapterContext }) =>
      createGraphqlContext({
        dataLayer: input.dataLayer,
        realtimeRuntime: input.realtimeRuntime,
        request: adapterContext as Request,
      }),
  });

  return createYoga({
    graphqlEndpoint: graphqlPath,
    schema: integration.schema,
    context: ({ request }) =>
      integration.context({
        adapterContext: request,
      }),
    graphiql: true,
    cors: {
      origin: clientOrigin,
      credentials: true,
    },
  });
}
