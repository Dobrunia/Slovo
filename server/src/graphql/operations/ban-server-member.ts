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

const banServerMemberInputSchema = z.object({
  serverId: z.string().min(1),
  targetUserId: z.string().min(1),
});

const banServerMemberOutputSchema = z.object({
  serverId: z.string().min(1),
  userId: z.string().min(1),
});

/**
 * Приватная GraphQL-мутация бана участника сервера владельцем.
 */
export const banServerMemberMutation = mutation({
  name: "banServerMember",
  policy: authenticatedPolicy,
  input: banServerMemberInputSchema,
  output: banServerMemberOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof banServerMemberInputSchema>;
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
    const existingBan = await graphqlContext.dataLayer.prisma.serverBan.findUnique({
      where: {
        serverId_userId: {
          serverId: ownerMembership.server.id,
          userId: targetMembership.userId,
        },
      },
    });

    if (existingBan) {
      throw new Error("Пользователь уже заблокирован в этом сервере.");
    }

    await graphqlContext.dataLayer.prisma.serverMember.delete({
      where: {
        serverId_userId: {
          serverId: ownerMembership.server.id,
          userId: targetMembership.userId,
        },
      },
    });

    const createdServerBan = await graphqlContext.dataLayer.prisma.serverBan.create({
      data: {
        serverId: ownerMembership.server.id,
        userId: targetMembership.userId,
        bannedByUserId: userId,
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await graphqlContext.forceDisconnectUserFromServer?.({
        userId: createdServerBan.userId,
        serverId: createdServerBan.serverId,
        reason: "Вы были заблокированы в сервере.",
      });

      await emitSystemRealtimeEvent(
        graphqlContext.realtimeRuntime,
        REALTIME_EVENT_NAMES.userServersUpdated,
        {
          userId: createdServerBan.userId,
          serverId: createdServerBan.serverId,
          action: "deleted",
          occurredAt: createdServerBan.createdAt.toISOString(),
        },
      );
    }

    return {
      serverId: createdServerBan.serverId,
      userId: createdServerBan.userId,
    };
  },
});
