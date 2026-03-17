import { z } from "zod";
import { mutation } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { USER_AVATAR_URL_MAX_LENGTH } from "../../config/constants.js";
import { publicUserSchema, toPublicUser } from "../../auth/user.js";
import { REALTIME_EVENT_NAMES } from "../../../../shared/realtime/names.js";
import type { GraphqlContext } from "../context.js";

const updateAvatarInputSchema = z.object({
  avatarUrl: z.string().max(USER_AVATAR_URL_MAX_LENGTH).nullable(),
});

const updateAvatarOutputSchema = z.object({
  user: publicUserSchema,
});

/**
 * Приватная GraphQL-мутация изменения avatarUrl текущего пользователя
 * с обязательной realtime-рассылкой обновленного профиля.
 */
export const updateAvatarMutation = mutation({
  name: "updateAvatar",
  policy: authenticatedPolicy,
  input: updateAvatarInputSchema,
  output: updateAvatarOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof updateAvatarInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;

    if (!graphqlContext.userId) {
      throw new Error("Требуется авторизация.");
    }

    const normalizedAvatarUrl = normalizeAvatarUrl(input.avatarUrl);

    const updatedUser = await graphqlContext.dataLayer.prisma.user.update({
      where: {
        id: graphqlContext.userId,
      },
      data: {
        avatarUrl: normalizedAvatarUrl,
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await graphqlContext.realtimeRuntime.emitEvent(
        REALTIME_EVENT_NAMES.profileUpdated,
        {
          userId: updatedUser.id,
          displayName: updatedUser.displayName,
          avatarUrl: updatedUser.avatarUrl,
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
      );
    }

    return {
      user: toPublicUser(updatedUser),
    };
  },
});

/**
 * Нормализует входной avatar URL: пустое значение очищает аватар,
 * непустое — должно оставаться валидным URL.
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
    throw new Error("Аватар должен быть валидным URL.");
  }

  return normalizedAvatarUrl;
}
