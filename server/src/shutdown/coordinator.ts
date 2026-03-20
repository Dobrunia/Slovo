/**
 * Источник сигнала завершения server process.
 */
export type ShutdownSignal = NodeJS.Signals | "manual";

/**
 * Зависимости graceful shutdown coordinator для серверного процесса.
 */
export interface CreateShutdownCoordinatorInput {
  closeRealtime(): Promise<void>;
  closeHttpServer(): Promise<void>;
  closeMediaFoundation(): Promise<void>;
  disposeDataLayer(): Promise<void>;
  onShutdownStart?(signal: ShutdownSignal): void;
  onShutdownComplete?(): void;
  onShutdownError?(error: unknown): void;
}

/**
 * Публичный API координатора graceful shutdown сервера.
 */
export interface ShutdownCoordinator {
  shutdown(signal?: ShutdownSignal): Promise<void>;
  isShuttingDown(): boolean;
}

/**
 * Создает идемпотентный coordinator завершения процесса.
 */
export function createShutdownCoordinator(
  input: CreateShutdownCoordinatorInput,
): ShutdownCoordinator {
  let shutdownPromise: Promise<void> | null = null;

  return {
    shutdown(signal = "manual") {
      if (shutdownPromise) {
        return shutdownPromise;
      }

      input.onShutdownStart?.(signal);

      shutdownPromise = (async () => {
        try {
          await input.closeRealtime();
          await input.closeHttpServer();
          await input.closeMediaFoundation();
          await input.disposeDataLayer();
          input.onShutdownComplete?.();
        } catch (error) {
          input.onShutdownError?.(error);
          throw error;
        }
      })();

      return shutdownPromise;
    },

    isShuttingDown() {
      return shutdownPromise !== null;
    },
  };
}
