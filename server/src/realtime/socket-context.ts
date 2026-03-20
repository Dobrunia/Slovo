import { resolveSessionUserId } from "../auth/session.js";
import type { DataLayer } from "../data/prisma.js";

type RealtimeServerContextLike = {
  user: {
    userId: string | null;
  };
};

type SocketHandshakeLike =
  | {
      address?: string;
      headers?: Record<string, string | string[] | undefined>;
      auth?: Record<string, unknown>;
    }
  | undefined;

/**
 * Извлекает user id из realtime context или завершает команду ошибкой авторизации.
 */
export function requireRealtimeUserId(context: RealtimeServerContextLike): string {
  if (!context.user.userId) {
    throw new Error("Требуется авторизация.");
  }

  return context.user.userId;
}

/**
 * Извлекает user-agent из заголовков сокета и нормализует его к строке или `null`.
 */
export function resolveRealtimeUserAgent(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | null {
  const userAgent = headers?.["user-agent"];

  if (typeof userAgent === "string" && userAgent.trim()) {
    return userAgent;
  }

  return null;
}

/**
 * Разрешает auth session пользователя из Socket.IO-handshake.
 */
export async function resolveRealtimeSocketUserId(args: {
  dataLayer: DataLayer;
  handshake: SocketHandshakeLike;
}): Promise<string | null> {
  const headers = new Headers();

  appendSocketHandshakeHeaders(headers, args.handshake?.headers);

  const authSessionToken = readHandshakeSessionToken(args.handshake?.auth);

  if (authSessionToken) {
    headers.set("x-session-token", authSessionToken);
  }

  return resolveSessionUserId({
    dataLayer: args.dataLayer,
    headers,
  });
}

/**
 * Копирует строковые заголовки из socket handshake в стандартный `Headers`.
 */
function appendSocketHandshakeHeaders(
  target: Headers,
  headers: Record<string, string | string[] | undefined> | undefined,
): void {
  if (!headers) {
    return;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.trim()) {
      target.set(name, value);
    } else if (Array.isArray(value) && value[0]?.trim()) {
      target.set(name, value[0]);
    }
  }
}

/**
 * Считывает session token из auth-объекта handshake, если он там есть.
 */
function readHandshakeSessionToken(
  source: Record<string, unknown> | undefined,
): string | null {
  const sessionToken = source?.sessionToken;

  return typeof sessionToken === "string" && sessionToken.trim() ? sessionToken : null;
}
