/**
 * Возвращает `true`, если входящий HTTP-запрос относится к Socket.IO transport path.
 */
export function isSocketIoRequest(
  url: string | undefined,
  socketIoPath: string = "/socket.io",
): boolean {
  if (!url) {
    return false;
  }

  return (
    url === socketIoPath ||
    url.startsWith(`${socketIoPath}/`) ||
    url.startsWith(`${socketIoPath}?`)
  );
}

type RealtimeCorsOriginCallback = (error: Error | null, allow?: boolean) => void;

/**
 * Создает origin matcher для dev-realtime, устойчивый к localhost/127.0.0.1 alias-ам.
 */
export function createRealtimeCorsOriginMatcher(
  configuredOrigin: string,
): (origin: string | undefined, callback: RealtimeCorsOriginCallback) => void {
  const allowedOrigins = Array.from(new Set(expandLoopbackOriginAliases(configuredOrigin)));

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS origin is not allowed for realtime transport."), false);
  };
}

/**
 * Расширяет loopback-origin его парным alias-ом между localhost и 127.0.0.1.
 */
function expandLoopbackOriginAliases(origin: string): string[] {
  const normalizedOrigin = origin.trim();

  if (!normalizedOrigin) {
    return [];
  }

  try {
    const url = new URL(normalizedOrigin);

    if (url.hostname === "localhost") {
      const aliasUrl = new URL(normalizedOrigin);
      aliasUrl.hostname = "127.0.0.1";
      return [normalizedOrigin, aliasUrl.origin];
    }

    if (url.hostname === "127.0.0.1") {
      const aliasUrl = new URL(normalizedOrigin);
      aliasUrl.hostname = "localhost";
      return [normalizedOrigin, aliasUrl.origin];
    }
  } catch {
    return [normalizedOrigin];
  }

  return [normalizedOrigin];
}
