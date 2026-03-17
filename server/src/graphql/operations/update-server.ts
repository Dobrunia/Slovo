import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import {
  SERVER_AVATAR_URL_MAX_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
} from "../../config/constants.js";
import { emitSystemRealtimeEvent } from "../../realtime/runtime.js";
import { requireServerOwner } from "../../server/access.js";
import {
  publicServerListItemSchema,
  toPublicServerListItem,
} from "../../server/public-server.js";
import { REALTIME_EVENT_NAMES } from "../../../../shared/realtime/names.js";
import type { GraphqlContext } from "../context.js";

const updateServerInputSchema = z.object({
  serverId: z.string().min(1),
  name: z.string().trim().min(SERVER_NAME_MIN_LENGTH).max(SERVER_NAME_MAX_LENGTH),
  avatarUrl: z.string().max(SERVER_AVATAR_URL_MAX_LENGTH).nullable(),
});

const updateServerOutputSchema = z.object({
  server: publicServerListItemSchema,
});

/**
 * Приватная GraphQL-мутация изменения названия и аватара сервера владельцем.
 */
export const updateServerMutation = mutation({
  name: "updateServer",
  policy: authenticatedPolicy,
  input: updateServerInputSchema,
  output: updateServerOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof updateServerInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const ownerMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const updatedServer = await graphqlContext.dataLayer.prisma.server.update({
      where: {
        id: ownerMembership.server.id,
      },
      data: {
        name: input.name.trim(),
        avatarUrl: normalizeAvatarUrl(input.avatarUrl),
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await emitSystemRealtimeEvent(
        graphqlContext.realtimeRuntime,
        REALTIME_EVENT_NAMES.serverUpdated,
        {
          serverId: updatedServer.id,
          name: updatedServer.name,
          avatarUrl: updatedServer.avatarUrl,
          isPublic: updatedServer.isPublic,
          updatedAt: updatedServer.updatedAt.toISOString(),
        },
      );
    }

    return {
      server: toPublicServerListItem({
        id: updatedServer.id,
        name: updatedServer.name,
        avatarUrl: updatedServer.avatarUrl,
        isPublic: updatedServer.isPublic,
        role: ownerMembership.role,
      }),
    };
  },
});

/**
 * Нормализует avatar URL сервера: пустое значение очищает аватар.
 */
function normalizeAvatarUrl(avatarUrl: string | null): string | null {
  if (avatarUrl === null) {
    return null;
  }

  const normalizedAvatarUrl = avatarUrl.trim();

  if (!normalizedAvatarUrl) {
    return null;
  }

  const parseResult = z.string().url().safeParse(normalizedAvatarUrl);

  if (!parseResult.success) {
    throw new Error("Аватар сервера должен быть валидным URL.");
  }

  return normalizedAvatarUrl;
}
