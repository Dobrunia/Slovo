import { z } from 'zod';
import { query } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { requireServerOwner } from '../../server/access.js';
import {
  publicServerInviteLinkSchema,
  toPublicServerInviteLink,
} from '../../server/public-server.js';
import { buildServerInviteLink, ensureServerInviteToken } from '../../server/invite-link.js';
import type { GraphqlContext } from '../context.js';

const serverInviteLinkInputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватный GraphQL-query invite-ссылки сервера только для владельца.
 */
export const serverInviteLinkQuery = query({
  name: 'serverInviteLink',
  policy: authenticatedPolicy,
  input: serverInviteLinkInputSchema,
  output: publicServerInviteLinkSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof serverInviteLinkInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const manageableMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const ensuredInviteToken = await ensureServerInviteToken(
      graphqlContext.dataLayer,
      manageableMembership.server
    );

    return toPublicServerInviteLink({
      serverId: ensuredInviteToken.id,
      inviteLink: buildServerInviteLink(ensuredInviteToken.inviteToken),
    });
  },
});
