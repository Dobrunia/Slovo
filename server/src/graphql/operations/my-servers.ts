import { z } from "zod";
import { query } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import {
  publicServerListItemSchema,
  toPublicServerListItem,
} from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const myServersQueryInputSchema = z.object({
  marker: z.string().optional(),
});

/**
 * Приватный GraphQL-query, возвращающий список серверов текущего пользователя.
 */
export const myServersQuery = query({
  name: "myServers",
  policy: authenticatedPolicy,
  input: myServersQueryInputSchema,
  output: z.array(publicServerListItemSchema),
  resolve: async ({
    ctx,
  }: {
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;

    if (!graphqlContext.userId) {
      throw new Error("Требуется авторизация.");
    }

    const memberships = await graphqlContext.dataLayer.prisma.serverMember.findMany({
      where: {
        userId: graphqlContext.userId,
      },
      include: {
        server: true,
      },
    });

    return memberships
      .filter((membership) => Boolean(membership.server))
      .sort((left, right) => {
        const leftTime = left.server?.updatedAt.getTime() ?? 0;
        const rightTime = right.server?.updatedAt.getTime() ?? 0;

        return rightTime - leftTime;
      })
      .map((membership) =>
        toPublicServerListItem({
          id: membership.server!.id,
          name: membership.server!.name,
          avatarUrl: membership.server!.avatarUrl,
          isPublic: membership.server!.isPublic,
          role: membership.role,
        }),
      );
  },
});
