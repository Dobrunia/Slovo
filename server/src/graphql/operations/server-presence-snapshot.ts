import { z } from "zod";
import { query } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { requireServerMember } from "../../server/access.js";
import {
  publicServerPresenceSnapshotSchema,
  toPublicRuntimePresenceMember,
} from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const serverPresenceSnapshotInputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватный GraphQL-query initial snapshot runtime presence выбранного сервера.
 */
export const serverPresenceSnapshotQuery = query({
  name: "serverPresenceSnapshot",
  policy: authenticatedPolicy,
  input: serverPresenceSnapshotInputSchema,
  output: publicServerPresenceSnapshotSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof serverPresenceSnapshotInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    await requireServerMember({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    return {
      members: (graphqlContext.presenceRegistry?.getServerPresence(input.serverId) ?? []).map(
        (member) =>
          toPublicRuntimePresenceMember({
            userId: member.userId,
            displayName: member.displayName,
            avatarUrl: member.avatarUrl,
            channelId: member.channelId,
            joinedAt: member.joinedAt,
          }),
      ),
    };
  },
});
