import { z } from 'zod';
import { query } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { publicUserSchema, toPublicUser } from '../../auth/user.js';
import type { GraphqlContext } from '../context.js';

const meQueryInputSchema = z.object({
  marker: z.string().optional(),
});

/**
 * Приватный GraphQL-query, возвращающий текущего пользователя по auth-сессии.
 */
export const meQuery = query({
  name: 'me',
  policy: authenticatedPolicy,
  input: meQueryInputSchema,
  output: publicUserSchema,
  resolve: async ({ ctx }: { ctx: unknown }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const user = await graphqlContext.dataLayer.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new Error('Текущий пользователь не найден.');
    }

    return toPublicUser(user);
  },
});
