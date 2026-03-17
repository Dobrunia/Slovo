import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { requireServerOwner } from "../../server/access.js";
import {
  emitServerChannelsUpdated,
  loadServerChannels,
} from "../../server/channels.js";
import { publicServerChannelsSchema } from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const reorderVoiceChannelsInputSchema = z.object({
  serverId: z.string().min(1),
  channelIds: z.array(z.string().min(1)).min(1),
});

/**
 * Приватная GraphQL-мутация перестановки voice-каналов сервера.
 */
export const reorderVoiceChannelsMutation = mutation({
  name: "reorderVoiceChannels",
  policy: authenticatedPolicy,
  input: reorderVoiceChannelsInputSchema,
  output: publicServerChannelsSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof reorderVoiceChannelsInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    const currentChannels = await graphqlContext.dataLayer.prisma.voiceChannel.findMany({
      where: {
        serverId: input.serverId,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    const currentChannelIds = currentChannels.map((channel) => channel.id);
    const nextChannelIds = input.channelIds;
    const uniqueChannelIds = new Set(nextChannelIds);

    const hasInvalidOrder =
      currentChannelIds.length !== nextChannelIds.length ||
      uniqueChannelIds.size !== nextChannelIds.length ||
      currentChannelIds.some((channelId) => !uniqueChannelIds.has(channelId));

    if (hasInvalidOrder) {
      throw new Error("Неверный порядок каналов.");
    }

    await Promise.all(
      nextChannelIds.map((channelId, index) =>
        graphqlContext.dataLayer.prisma.voiceChannel.update({
          where: {
            id: channelId,
          },
          data: {
            sortOrder: index,
          },
        }),
      ),
    );

    const channels = await loadServerChannels({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
    });

    await emitServerChannelsUpdated({
      realtimeRuntime: graphqlContext.realtimeRuntime,
      serverId: input.serverId,
      channels,
    });

    return {
      channels,
    };
  },
});
