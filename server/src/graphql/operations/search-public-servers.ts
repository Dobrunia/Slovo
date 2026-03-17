import { z } from 'zod';
import { query } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { SERVER_NAME_MAX_LENGTH } from '../../config/constants.js';
import {
  publicServerDiscoveryItemSchema,
  toPublicServerDiscoveryItem,
} from '../../server/public-server.js';
import type { GraphqlContext } from '../context.js';

const searchPublicServersInputSchema = z.object({
  query: z.string().trim().min(1).max(SERVER_NAME_MAX_LENGTH),
});

/**
 * Приватный GraphQL-query поиска публичных серверов по названию.
 */
export const searchPublicServersQuery = query({
  name: 'searchPublicServers',
  policy: authenticatedPolicy,
  input: searchPublicServersInputSchema,
  output: z.array(publicServerDiscoveryItemSchema),
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof searchPublicServersInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    requireCurrentUser(graphqlContext);

    const queryValue = input.query.trim().toLowerCase();
    const publicServers = await graphqlContext.dataLayer.prisma.server.findMany({
      where: {
        isPublic: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return publicServers
      .filter((server) => server.name.toLowerCase().includes(queryValue))
      .map((server) =>
        toPublicServerDiscoveryItem({
          id: server.id,
          name: server.name,
          avatarUrl: server.avatarUrl,
        })
      );
  },
});
