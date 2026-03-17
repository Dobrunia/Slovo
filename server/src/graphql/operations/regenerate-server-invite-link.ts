import { z } from 'zod';
import { mutation } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { emitSystemRealtimeEvent } from '../../realtime/runtime.js';
import { REALTIME_EVENT_NAMES } from '../../../../shared/realtime/names.js';
import { requireServerOwner } from '../../server/access.js';
import {
  publicServerInviteLinkSchema,
  toPublicServerInviteLink,
} from '../../server/public-server.js';
import { buildServerInviteLink, generateServerInviteToken } from '../../server/invite-link.js';
import type { GraphqlContext } from '../context.js';

const regenerateServerInviteLinkInputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватная GraphQL-мутация перевыпуска invite-ссылки сервера только для владельца.
 */
export const regenerateServerInviteLinkMutation = mutation({
  name: 'regenerateServerInviteLink',
  policy: authenticatedPolicy,
  input: regenerateServerInviteLinkInputSchema,
  output: publicServerInviteLinkSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof regenerateServerInviteLinkInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const manageableMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const server = await graphqlContext.dataLayer.prisma.server.update({
      where: {
        id: manageableMembership.server.id,
      },
      data: {
        inviteToken: generateServerInviteToken(),
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await emitSystemRealtimeEvent(graphqlContext.realtimeRuntime, REALTIME_EVENT_NAMES.serverUpdated, {
        serverId: server.id,
        name: server.name,
        avatarUrl: server.avatarUrl,
        isPublic: server.isPublic,
        updatedAt: server.updatedAt.toISOString(),
      });
    }

    return toPublicServerInviteLink({
      serverId: server.id,
      inviteLink: buildServerInviteLink(server.inviteToken!),
    });
  },
});
