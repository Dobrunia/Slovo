import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import {
  MAX_CHANNELS_PER_SERVER,
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

const createVoiceChannelInputSchema = z.object({
  serverId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(VOICE_CHANNEL_NAME_MIN_LENGTH)
    .max(VOICE_CHANNEL_NAME_MAX_LENGTH),
});

/**
 * Приватная GraphQL-мутация создания voice-канала внутри сервера.
 */
export const createVoiceChannelMutation = mutation({
  name: "createVoiceChannel",
  policy: authenticatedPolicy,
  input: createVoiceChannelInputSchema,
  output: publicServerChannelsSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof createVoiceChannelInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });

    const existingChannels = await graphqlContext.dataLayer.prisma.voiceChannel.findMany({
      where: {
        serverId: input.serverId,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    if (existingChannels.length >= MAX_CHANNELS_PER_SERVER) {
      throw new Error(
        `Внутри одного сервера нельзя создать более ${MAX_CHANNELS_PER_SERVER} каналов.`,
      );
    }

    await graphqlContext.dataLayer.prisma.voiceChannel.create({
      data: {
        serverId: input.serverId,
        name: input.name.trim(),
        sortOrder: existingChannels.length,
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
