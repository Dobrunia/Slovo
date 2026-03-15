import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
  DEFAULT_SERVER_SERVICE_NAME,
  MAX_CHANNELS_PER_SERVER,
  MAX_SERVERS_PER_OWNER,
} from "../src/config/constants.js";
import type { DataLayer } from "../src/data/prisma.js";
import { createGraphqlServer } from "../src/graphql/server.js";

const GRAPHQL_TEST_URL = new URL(
  DEFAULT_GRAPHQL_PATH,
  `http://localhost:${DEFAULT_SERVER_PORT}`,
).toString();

test("should expose the health query through GraphQL Yoga and StrictQL", async () => {
  /**
   * Проверяется, что базовый GraphQL endpoint отвечает через реальную связку Yoga + StrictQL после упрощения env-архитектуры.
   * Это важно, потому что следующие GraphQL-задачи будут опираться на этот foundation без отдельного config-layer.
   * Граничный случай — минимальный data layer без настоящего подключения к базе, так как health-query не должна зависеть от Prisma-запросов.
   */
  const previousGraphqlPath = process.env.GRAPHQL_PATH;
  process.env.GRAPHQL_PATH = DEFAULT_GRAPHQL_PATH;

  const dataLayer = {
    prisma: {
      $disconnect: async () => undefined,
    },
  } as unknown as DataLayer;
  const yoga = createGraphqlServer({
    dataLayer,
  });

  const response = await yoga.fetch(
    new Request(GRAPHQL_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query HealthFoundation {
            health(input: { probe: "health" }) {
              status
              service
              graphqlPath
              limits {
                maxServersPerOwner
                maxChannelsPerServer
              }
            }
          }
        `,
      }),
    }),
  );

  if (previousGraphqlPath === undefined) {
    delete process.env.GRAPHQL_PATH;
  } else {
    process.env.GRAPHQL_PATH = previousGraphqlPath;
  }

  assert.equal(response.status, 200);

  const payload = (await response.json()) as {
    data: {
      health: {
        status: string;
        service: string;
        graphqlPath: string;
        limits: {
          maxServersPerOwner: number;
          maxChannelsPerServer: number;
        };
      };
    };
  };

  assert.deepEqual(payload.data.health, {
    status: "ok",
    service: DEFAULT_SERVER_SERVICE_NAME,
    graphqlPath: DEFAULT_GRAPHQL_PATH,
    limits: {
      maxServersPerOwner: MAX_SERVERS_PER_OWNER,
      maxChannelsPerServer: MAX_CHANNELS_PER_SERVER,
    },
  });
});
