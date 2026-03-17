import { z } from 'zod';
import { mutation } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import {
  MAX_SERVERS_PER_OWNER,
  SERVER_AVATAR_URL_MAX_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
} from '../../config/constants.js';
import { emitSystemRealtimeEvent } from '../../realtime/runtime.js';
import { generateServerInviteToken } from '../../server/invite-link.js';
import { publicServerListItemSchema, toPublicServerListItem } from '../../server/public-server.js';
import { REALTIME_EVENT_NAMES } from '../../../../shared/realtime/names.js';
import type { GraphqlContext } from '../context.js';

const createServerInputSchema = z.object({
  name: z.string().trim().min(SERVER_NAME_MIN_LENGTH).max(SERVER_NAME_MAX_LENGTH),
  avatarUrl: z.string().trim().url().max(SERVER_AVATAR_URL_MAX_LENGTH).optional(),
  isPublic: z.boolean().optional(),
});

const createServerOutputSchema = z.object({
  server: publicServerListItemSchema,
});

/**
 * Приватная GraphQL-мутация создания сервера с membership владельца.
 */
export const createServerMutation = mutation({
  name: 'createServer',
  policy: authenticatedPolicy,
  input: createServerInputSchema,
  output: createServerOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof createServerInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const ownedServersCount = await graphqlContext.dataLayer.prisma.server.count({
      where: {
        ownerId: userId,
      },
    });

    if (ownedServersCount >= MAX_SERVERS_PER_OWNER) {
      throw new Error(
        `Пользователь не может владеть более чем ${MAX_SERVERS_PER_OWNER} серверами.`
      );
    }

    const server = await graphqlContext.dataLayer.prisma.server.create({
      data: {
        name: input.name.trim(),
        avatarUrl: input.avatarUrl?.trim() || null,
        inviteToken: generateServerInviteToken(),
        isPublic: input.isPublic ?? false,
        ownerId: userId,
      },
    });

    await graphqlContext.dataLayer.prisma.serverMember.create({
      data: {
        serverId: server.id,
        userId,
        role: 'OWNER',
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await emitSystemRealtimeEvent(graphqlContext.realtimeRuntime, REALTIME_EVENT_NAMES.userServersUpdated, {
        userId,
        serverId: server.id,
        action: 'created',
        occurredAt: server.updatedAt.toISOString(),
      });
    }

    return {
      server: toPublicServerListItem({
        id: server.id,
        name: server.name,
        avatarUrl: server.avatarUrl,
        isPublic: server.isPublic,
        role: 'OWNER',
      }),
    };
  },
});
