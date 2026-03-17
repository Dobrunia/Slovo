import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import {
  VOICE_CHANNEL_NAME_MAX_LENGTH,
  VOICE_CHANNEL_NAME_MIN_LENGTH,
} from "../../config/constants.js";
import { requireServerOwner } from "../../server/access.js";
import {
  emitServerChannelsUpdated,
  loadServerChannels,
} from "../../server/channels.js";
import { publicServerChannelsSchema } from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const updateVoiceChannelInputSchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(VOICE_CHANNEL_NAME_MIN_LENGTH)
    .max(VOICE_CHANNEL_NAME_MAX_LENGTH),
});

/**
 * Приватная GraphQL-мутация переименования voice-канала сервера.
 */
export const updateVoiceChannelMutation = mutation({
  name: "updateVoiceChannel",
  policy: authenticatedPolicy,
  input: updateVoiceChannelInputSchema,
  output: publicServerChannelsSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof updateVoiceChannelInputSchema>;
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

    await graphqlContext.dataLayer.prisma.voiceChannel.update({
      where: {
        id: input.channelId,
      },
      data: {
        name: input.name.trim(),
      },
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
