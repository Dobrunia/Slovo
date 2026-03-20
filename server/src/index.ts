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
import { createMediaFoundation } from "./media/foundation.js";
import { isSocketIoRequest } from "./realtime/http.js";
import { createSlovoRealtimeServer } from "./realtime/runtime.js";
import { createShutdownCoordinator } from "./shutdown/coordinator.js";

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
  const mediaFoundation = await createMediaFoundation();
  process.stdout.write("MediaSoup foundation initialized\n");

  let yoga: ReturnType<typeof createGraphqlServer>;
  const server = createServer((request, response) => {
    if (isSocketIoRequest(request.url)) {
      return;
    }

    void yoga(request, response);
  });
  const realtime = createSlovoRealtimeServer({
    httpServer: server,
    dataLayer,
    mediaFoundation,
  });
  yoga = createGraphqlServer({
    dataLayer,
    realtimeRuntime: realtime.runtime,
    presenceRegistry: realtime.presenceRegistry,
    forceDisconnectUserFromServer: realtime.forceDisconnectUserFromServer,
  });

  await new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });

  const shutdownCoordinator = createShutdownCoordinator({
    closeRealtime: () =>
      new Promise<void>((resolve, reject) => {
        realtime.io.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    closeHttpServer: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    closeMediaFoundation: () => mediaFoundation.close(),
    disposeDataLayer: () => disposeDataLayer(dataLayer),
    onShutdownStart: (signal) => {
      process.stdout.write(`Received ${signal}, shutting down Slovo server\n`);
    },
    onShutdownComplete: () => {
      process.stdout.write("Slovo server shutdown complete\n");
    },
    onShutdownError: (error) => {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unknown shutdown error";

      process.stderr.write(`Slovo server shutdown failed: ${errorMessage}\n`);
      process.exitCode = 1;
    },
  });

  const handleProcessSignal = (signal: NodeJS.Signals) => {
    if (shutdownCoordinator.isShuttingDown()) {
      process.stdout.write(`Shutdown already in progress after ${signal}\n`);
      return;
    }

    void shutdownCoordinator.shutdown(signal);
  };

  process.once("SIGINT", () => {
    handleProcessSignal("SIGINT");
  });
  process.once("SIGTERM", () => {
    handleProcessSignal("SIGTERM");
  });

  process.stdout.write(
    `Slovo server listening on http://localhost:${port}${graphqlPath}\n`,
  );
}

void startServer().catch((error) => {
  const errorMessage =
    error instanceof Error && error.message ? error.message : "Unknown startup error";

  process.stderr.write(`Slovo server failed to start: ${errorMessage}\n`);
  process.exitCode = 1;
});
