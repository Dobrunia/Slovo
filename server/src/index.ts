import "dotenv/config";
import { createServer } from "node:http";
import {
  DEFAULT_DATABASE_URL,
  DEFAULT_GRAPHQL_PATH,
  DEFAULT_SERVER_PORT,
} from "./config/constants.js";
import {
  connectDataLayer,
  createDataLayer,
  disposeDataLayer,
} from "./data/prisma.js";
import { createGraphqlServer } from "./graphql/server.js";
import { createSlovoRealtimeServer } from "./realtime/runtime.js";

/**
 * Поднимает минимальный HTTP-сервер, который позже будет расширен GraphQL и realtime-слоями.
 */
async function startServer() {
  const rawPort = Number(process.env.PORT?.trim());
  const port = Number.isInteger(rawPort) && rawPort > 0 ? rawPort : DEFAULT_SERVER_PORT;
  const graphqlPath = process.env.GRAPHQL_PATH?.trim()?.startsWith("/")
    ? process.env.GRAPHQL_PATH.trim()
    : DEFAULT_GRAPHQL_PATH;
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const dataLayer = createDataLayer(databaseUrl);

  await connectDataLayer(dataLayer);
  process.stdout.write("Connected to MySQL database\n");

  const yoga = createGraphqlServer({
    dataLayer,
  });
  const server = createServer(yoga);
  const realtime = createSlovoRealtimeServer({
    httpServer: server,
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const shutdown = async () => {
    realtime.io.close();
    server.close();
    await disposeDataLayer(dataLayer);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  process.stdout.write(
    `Slovo server listening on http://localhost:${port}${graphqlPath}\n`,
  );
}

void startServer();
