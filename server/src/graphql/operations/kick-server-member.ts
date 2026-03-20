import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { emitSystemRealtimeEvent } from "../../realtime/runtime.js";
import { REALTIME_EVENT_NAMES } from "../../../../shared/realtime/names.js";
import { requireServerOwner } from "../../server/access.js";
import {
  assertModeratableServerMember,
  requireModerationTargetMember,
} from "../../server/moderation.js";
import type { GraphqlContext } from "../context.js";

const kickServerMemberInputSchema = z.object({
  serverId: z.string().min(1),
  targetUserId: z.string().min(1),
});

const kickServerMemberOutputSchema = z.object({
  serverId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Приватная GraphQL-мутация кика участника сервера владельцем.
 */
export const kickServerMemberMutation = mutation({
  name: "kickServerMember",
  policy: authenticatedPolicy,
  input: kickServerMemberInputSchema,
  output: kickServerMemberOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof kickServerMemberInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const ownerMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const targetMembership = assertModeratableServerMember(
      await requireModerationTargetMember({
        dataLayer: graphqlContext.dataLayer,
        serverId: ownerMembership.server.id,
        targetUserId: input.targetUserId,
      }),
    );
    const removedMembership = await graphqlContext.dataLayer.prisma.serverMember.delete({
      where: {
        serverId_userId: {
          serverId: ownerMembership.server.id,
          userId: targetMembership.userId,
        },
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await graphqlContext.forceDisconnectUserFromServer?.({
        userId: removedMembership.userId,
        serverId: removedMembership.serverId,
        reason: "Вы были исключены из сервера.",
      });

      await emitSystemRealtimeEvent(
        graphqlContext.realtimeRuntime,
        REALTIME_EVENT_NAMES.userServersUpdated,
        {
          userId: removedMembership.userId,
          serverId: removedMembership.serverId,
          action: "deleted",
          occurredAt: new Date().toISOString(),
        },
      );
    }

    return {
      serverId: removedMembership.serverId,
      userId: removedMembership.userId,
    };
  },
});
