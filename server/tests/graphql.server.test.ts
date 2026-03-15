import test from "node:test";
import assert from "node:assert/strict";
import type { DataLayer } from "../src/data/prisma.js";
import { createGraphqlServer } from "../src/graphql/server.js";

test("should expose the health query through GraphQL Yoga and StrictQL", async () => {
  /**
   * Проверяется, что базовый GraphQL endpoint отвечает через реальную связку Yoga + StrictQL после упрощения env-архитектуры.
   * Это важно, потому что следующие GraphQL-задачи будут опираться на этот foundation без отдельного config-layer.
   * Граничный случай — минимальный data layer без настоящего подключения к базе, так как health-query не должна зависеть от Prisma-запросов.
   */
  const previousGraphqlPath = process.env.GRAPHQL_PATH;
  process.env.GRAPHQL_PATH = "/graphql";

  const dataLayer = {
    prisma: {
      $disconnect: async () => undefined,
    },
  } as unknown as DataLayer;
  const yoga = createGraphqlServer({
    dataLayer,
  });

  const response = await yoga.fetch(
    new Request("http://localhost:4000/graphql", {
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
    service: "slovo-server",
    graphqlPath: "/graphql",
    limits: {
      maxServersPerOwner: 2,
      maxChannelsPerServer: 5,
    },
  });
});
