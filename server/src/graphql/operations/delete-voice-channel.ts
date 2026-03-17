import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { requireServerOwner } from "../../server/access.js";
import {
  compactServerChannelOrder,
  emitServerChannelsUpdated,
  loadServerChannels,
} from "../../server/channels.js";
import { publicServerChannelsSchema } from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const deleteVoiceChannelInputSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
});

/**
 * Приватная GraphQL-мутация удаления voice-канала сервера.
 */
export const deleteVoiceChannelMutation = mutation({
  name: "deleteVoiceChannel",
  policy: authenticatedPolicy,
  input: deleteVoiceChannelInputSchema,
  output: publicServerChannelsSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof deleteVoiceChannelInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    const channel = await graphqlContext.dataLayer.prisma.voiceChannel.findUnique({
      where: {
        id: input.channelId,
      },
    });

    if (!channel || channel.serverId !== input.serverId) {
      throw new Error("Канал не найден.");
    }

    await graphqlContext.dataLayer.prisma.voiceChannel.delete({
      where: {
        id: input.channelId,
      },
    });

    await compactServerChannelOrder({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
    });

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
