import { z } from "zod";
import { query } from "strictql";
import { authenticatedPolicy } from "../../auth/policies.js";
import { requireCurrentUser } from "../../auth/require.js";
import { requireServerOwner } from "../../server/access.js";
import {
  publicServerMembersSnapshotSchema,
  toPublicServerMember,
} from "../../server/public-server.js";
import type { GraphqlContext } from "../context.js";

const serverMembersInputSchema = z.object({
  serverId: z.string().min(1),
});

type ServerMemberRecord = {
  userId: string;
  role: "OWNER" | "MEMBER";
  createdAt: Date;
  user: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

/**
 * Приватный GraphQL-query owner-only списка участников сервера для moderation UI.
 */
export const serverMembersQuery = query({
  name: "serverMembers",
  policy: authenticatedPolicy,
  input: serverMembersInputSchema,
  output: publicServerMembersSnapshotSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof serverMembersInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const userId = requireCurrentUser(graphqlContext);

    const ownerMembership = await requireServerOwner({
      dataLayer: graphqlContext.dataLayer,
      serverId: input.serverId,
      userId,
    });
    const members = (await graphqlContext.dataLayer.prisma.serverMember.findMany({
      where: {
        serverId: ownerMembership.server.id,
      },
      include: {
        user: true,
      },
    })) as ServerMemberRecord[];

    const sortedMembers = members
      .filter((member) => member.user)
      .sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === "OWNER" ? -1 : 1;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });

    return {
      serverId: ownerMembership.server.id,
      members: sortedMembers.map((member) =>
        toPublicServerMember({
          userId: member.userId,
          displayName: member.user?.displayName ?? "Unknown",
          avatarUrl: member.user?.avatarUrl ?? null,
          role: member.role,
        }),
      ),
    };
  },
});
