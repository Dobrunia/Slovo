import { z } from 'zod';
import { query } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { requireServerMember } from '../../server/access.js';
import {
  publicServerSnapshotSchema,
  toPublicServerListItem,
  toPublicVoiceChannel,
} from '../../server/public-server.js';
import type { GraphqlContext } from '../context.js';

const serverSnapshotInputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватный GraphQL-query initial snapshot выбранного сервера.
 */
export const serverSnapshotQuery = query({
  name: 'serverSnapshot',
  policy: authenticatedPolicy,
  input: serverSnapshotInputSchema,
  output: publicServerSnapshotSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof serverSnapshotInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const readableMembership = await requireServerMember({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    const channels = await graphqlContext.dataLayer.prisma.voiceChannel.findMany({
      where: {
        serverId: input.serverId,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return {
      server: toPublicServerListItem({
        id: readableMembership.server.id,
        name: readableMembership.server.name,
        avatarUrl: readableMembership.server.avatarUrl,
        isPublic: readableMembership.server.isPublic,
        role: readableMembership.role,
      }),
      channels: channels.map((channel) =>
        toPublicVoiceChannel({
          id: channel.id,
          name: channel.name,
          sortOrder: channel.sortOrder,
        })
      ),
    };
  },
});
