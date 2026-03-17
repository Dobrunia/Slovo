import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { emitSystemRealtimeEvent } from "../../realtime/runtime.js";
import { requireServerOwner } from "../../server/access.js";
import { REALTIME_EVENT_NAMES } from "../../../../shared/realtime/names.js";
import type { GraphqlContext } from "../context.js";

const deleteServerInputSchema = z.object({
  serverId: z.string().min(1),
});

const deleteServerOutputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватная GraphQL-мутация удаления сервера владельцем.
 */
export const deleteServerMutation = mutation({
  name: "deleteServer",
  policy: authenticatedPolicy,
  input: deleteServerInputSchema,
  output: deleteServerOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof deleteServerInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const ownerMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const affectedMemberships = await graphqlContext.dataLayer.prisma.serverMember.findMany({
      where: {
        serverId: ownerMembership.server.id,
      },
    });
    const deletedServer = await graphqlContext.dataLayer.prisma.server.delete({
      where: {
        id: ownerMembership.server.id,
      },
    });

    if (graphqlContext.realtimeRuntime) {
      for (const membership of affectedMemberships) {
        await emitSystemRealtimeEvent(
          graphqlContext.realtimeRuntime,
          REALTIME_EVENT_NAMES.userServersUpdated,
          {
            userId: membership.userId,
            serverId: deletedServer.id,
            action: "deleted",
            occurredAt: deletedServer.updatedAt.toISOString(),
          },
        );
      }
    }

    return {
      serverId: deletedServer.id,
    };
  },
});
