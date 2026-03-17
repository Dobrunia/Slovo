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
  query: z.string().trim().max(SERVER_NAME_MAX_LENGTH),
});

/**
 * Приватный GraphQL-query поиска публичных серверов по названию
 * и выдачи двух самых популярных рекомендаций при пустом запросе.
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
    });
    const publicServersWithPopularity = await Promise.all(
      publicServers.map(async (server) => ({
        server,
        memberCount: await graphqlContext.dataLayer.prisma.serverMember.count({
          where: {
            serverId: server.id,
          },
        }),
      })),
    );

    const filteredServers = publicServersWithPopularity
      .filter(({ server }) =>
        queryValue.length === 0 ? true : server.name.toLowerCase().includes(queryValue),
      )
      .sort((left, right) => {
        if (right.memberCount !== left.memberCount) {
          return right.memberCount - left.memberCount;
        }

        return right.server.updatedAt.getTime() - left.server.updatedAt.getTime();
      });

    const recommendedServers = queryValue.length === 0 ? filteredServers.slice(0, 2) : filteredServers;

    return recommendedServers.map(({ server }) =>
      toPublicServerDiscoveryItem({
        id: server.id,
        name: server.name,
        avatarUrl: server.avatarUrl,
      }),
    );
  },
});
