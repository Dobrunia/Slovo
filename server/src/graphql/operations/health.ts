import { z } from "zod";
import { publicPolicy, query } from "strictql";
import {
  DEFAULT_GRAPHQL_PATH,
  MAX_CHANNELS_PER_SERVER,
  MAX_SERVERS_PER_OWNER,
} from "../../config/constants.js";
import type { GraphqlContext } from "../context.js";

const healthQueryInputSchema = z.object({
  probe: z.string().min(1),
});

const healthQueryOutputSchema = z.object({
  status: z.string().min(1),
  service: z.string().min(1),
  graphqlPath: z.string(),
  limits: z.object({
    maxServersPerOwner: z.number().int().positive(),
    maxChannelsPerServer: z.number().int().positive(),
  }),
});

/**
 * Базовый публичный query для проверки доступности GraphQL foundation.
 */
export const healthQuery = query({
  name: "health",
  policy: publicPolicy,
  input: healthQueryInputSchema,
  output: healthQueryOutputSchema,
  resolve: ({ ctx }: { ctx: unknown }) => {
    void (ctx as GraphqlContext);
    const graphqlPath = process.env.GRAPHQL_PATH?.trim()?.startsWith("/")
      ? process.env.GRAPHQL_PATH.trim()
      : DEFAULT_GRAPHQL_PATH;

    return {
      status: "ok",
      service: "slovo-server",
      graphqlPath,
      limits: {
        maxServersPerOwner: MAX_SERVERS_PER_OWNER,
        maxChannelsPerServer: MAX_CHANNELS_PER_SERVER,
      },
    };
  },
});
