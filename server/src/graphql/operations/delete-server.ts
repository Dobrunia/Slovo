import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
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
 * Приватная GraphQL-мутация удаления сервера только его владельцем.
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

    await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    const affectedMemberships = await graphqlContext.dataLayer.prisma.serverMember.findMany({
      where: {
        serverId: input.serverId,
      },
    });

    const deletedServer = await graphqlContext.dataLayer.prisma.server.delete({
      where: {
        id: input.serverId,
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await Promise.all(
        affectedMemberships.map((membership) =>
          graphqlContext.realtimeRuntime!.emitEvent(REALTIME_EVENT_NAMES.userServersUpdated, {
            userId: membership.userId,
            serverId: input.serverId,
            action: "deleted",
            occurredAt: deletedServer.updatedAt.toISOString(),
          }),
        ),
      );
    }

    return {
      serverId: input.serverId,
    };
  },
});
