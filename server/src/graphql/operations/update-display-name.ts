import { z } from 'zod';
import { mutation } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH } from '../../config/constants.js';
import { publicUserSchema, toPublicUser } from '../../auth/user.js';
import { REALTIME_EVENT_NAMES } from '../../../../shared/realtime/names.js';
import type { GraphqlContext } from '../context.js';

const updateDisplayNameInputSchema = z.object({
  displayName: z.string().trim().min(DISPLAY_NAME_MIN_LENGTH).max(DISPLAY_NAME_MAX_LENGTH),
});

const updateDisplayNameOutputSchema = z.object({
  user: publicUserSchema,
});

/**
 * Приватная GraphQL-мутация изменения display name текущего пользователя
 * с обязательной realtime-рассылкой обновленного профиля.
 */
export const updateDisplayNameMutation = mutation({
  name: 'updateDisplayName',
  policy: authenticatedPolicy,
  input: updateDisplayNameInputSchema,
  output: updateDisplayNameOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof updateDisplayNameInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const updatedUser = await graphqlContext.dataLayer.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        displayName: input.displayName.trim(),
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await graphqlContext.realtimeRuntime.emitEvent(REALTIME_EVENT_NAMES.profileUpdated, {
        userId: updatedUser.id,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        updatedAt: updatedUser.updatedAt.toISOString(),
      });
    }

    return {
      user: toPublicUser(updatedUser),
    };
  },
});
