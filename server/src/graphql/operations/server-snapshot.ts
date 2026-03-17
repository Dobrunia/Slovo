import { z } from "zod";
import { query } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import {
  publicServerSnapshotSchema,
  toPublicServerListItem,
  toPublicVoiceChannel,
} from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const serverSnapshotInputSchema = z.object({
  serverId: z.string().min(1),
});

/**
 * Приватный GraphQL-query initial snapshot выбранного сервера.
 */
export const serverSnapshotQuery = query({
  name: "serverSnapshot",
  policy: authenticatedPolicy,
  input: serverSnapshotInputSchema,
  output: publicServerSnapshotSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof serverSnapshotInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;

    if (!graphqlContext.userId) {
      throw new Error("Требуется авторизация.");
    }

    const membership = await graphqlContext.dataLayer.prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId: input.serverId,
          userId: graphqlContext.userId,
        },
      },
      include: {
        server: true,
      },
    });

    if (!membership?.server) {
      throw new Error("Сервер недоступен.");
    }

    const channels = await graphqlContext.dataLayer.prisma.voiceChannel.findMany({
      where: {
        serverId: input.serverId,
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    return {
      server: toPublicServerListItem({
        id: membership.server.id,
        name: membership.server.name,
        avatarUrl: membership.server.avatarUrl,
        isPublic: membership.server.isPublic,
        role: membership.role,
      }),
      channels: channels.map((channel) =>
        toPublicVoiceChannel({
          id: channel.id,
          name: channel.name,
          sortOrder: channel.sortOrder,
        }),
      ),
    };
  },
});
