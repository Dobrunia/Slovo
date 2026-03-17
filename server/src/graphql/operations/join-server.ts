import { z } from 'zod';
import { mutation } from 'strictql';
import { authenticatedPolicy } from '../../auth/policies.js';
import { requireCurrentUser } from '../../auth/require.js';
import { emitSystemRealtimeEvent } from '../../realtime/runtime.js';
import { REALTIME_EVENT_NAMES } from '../../../../shared/realtime/names.js';
import { publicServerListItemSchema, toPublicServerListItem } from '../../server/public-server.js';
import type { GraphqlContext } from '../context.js';

const joinServerInputSchema = z.object({
  serverId: z.string().min(1).optional(),
  inviteToken: z.string().min(1).optional(),
});

const joinServerOutputSchema = z.object({
  server: publicServerListItemSchema,
});

/**
 * Приватная GraphQL-мутация вступления в сервер по invite token или public serverId.
 */
export const joinServerMutation = mutation({
  name: 'joinServer',
  policy: authenticatedPolicy,
  input: joinServerInputSchema,
  output: joinServerOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof joinServerInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const joinTarget = resolveJoinTarget(input);
    const server =
      joinTarget.kind === 'serverId'
        ? await graphqlContext.dataLayer.prisma.server.findUnique({
            where: {
              id: joinTarget.serverId,
            },
          })
        : await graphqlContext.dataLayer.prisma.server.findUnique({
            where: {
              inviteToken: joinTarget.inviteToken,
            },
          });

    if (!server) {
      throw new Error(
        joinTarget.kind === 'inviteToken' ? 'Invite-ссылка недействительна.' : 'Сервер не найден.'
      );
    }

    if (joinTarget.kind === 'serverId' && !server.isPublic) {
      throw new Error('Без invite-ссылки можно вступить только в публичный сервер.');
    }

    const existingMembership = await graphqlContext.dataLayer.prisma.serverMember.findUnique({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId,
        },
      },
    });

    if (existingMembership) {
      throw new Error('Пользователь уже состоит в сервере.');
    }

    const serverBan = await graphqlContext.dataLayer.prisma.serverBan.findUnique({
      where: {
        serverId_userId: {
          serverId: server.id,
          userId,
        },
      },
    });

    if (serverBan) {
      throw new Error('Пользователь заблокирован в этом сервере.');
    }

    const membership = await graphqlContext.dataLayer.prisma.serverMember.create({
      data: {
        serverId: server.id,
        userId,
        role: 'MEMBER',
      },
    });

    if (graphqlContext.realtimeRuntime) {
      await emitSystemRealtimeEvent(graphqlContext.realtimeRuntime, REALTIME_EVENT_NAMES.userServersUpdated, {
        userId,
        serverId: server.id,
        action: 'joined',
        occurredAt: membership.createdAt.toISOString(),
      });
    }

    return {
      server: toPublicServerListItem({
        id: server.id,
        name: server.name,
        avatarUrl: server.avatarUrl,
        isPublic: server.isPublic,
        role: 'MEMBER',
      }),
    };
  },
});

type JoinTarget =
  | {
      kind: 'serverId';
      serverId: string;
    }
  | {
      kind: 'inviteToken';
      inviteToken: string;
    };

/**
 * Валидирует, что клиент передал ровно один способ вступления в сервер.
 */
function resolveJoinTarget(input: z.infer<typeof joinServerInputSchema>): JoinTarget {
  if (input.serverId && input.inviteToken) {
    throw new Error('Нужно передать либо serverId, либо inviteToken.');
  }

  if (input.serverId) {
    return {
      kind: 'serverId',
      serverId: input.serverId,
    };
  }

  if (input.inviteToken) {
    return {
      kind: 'inviteToken',
      inviteToken: input.inviteToken,
    };
  }

  throw new Error('Нужно передать либо serverId, либо inviteToken.');
}
