import { createHash, randomBytes } from "node:crypto";
import {
  AUTHORIZATION_BEARER_PREFIX,
  SESSION_TOKEN_BYTES,
  SESSION_TOKEN_HASH_ALGORITHM,
  SESSION_TOKEN_HEADER,
} from "../config/constants.js";
import type { DataLayer } from "../data/prisma.js";

type CreateAuthSessionInput = {
  dataLayer: DataLayer;
  userId: string;
};

type ResolveSessionUserIdInput = {
  dataLayer: DataLayer;
  headers: Headers;
};

/**
 * Создает новую auth-сессию пользователя и возвращает сырой токен для клиента.
 */
export async function createAuthSession(input: CreateAuthSessionInput): Promise<string> {
  const sessionToken = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashSessionToken(sessionToken);

  await input.dataLayer.prisma.authSession.create({
    data: {
      userId: input.userId,
      tokenHash,
    },
  });

  return sessionToken;
}

/**
 * Ищет пользователя по auth session token из заголовков транспортного запроса.
 */
export async function resolveSessionUserId(
  input: ResolveSessionUserIdInput,
): Promise<string | null> {
  const sessionToken = readSessionToken(input.headers);

  if (!sessionToken) {
    return null;
  }

  const session = await input.dataLayer.prisma.authSession.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },
  });

  return session?.userId ?? null;
}

/**
 * Преобразует сырой session token в хеш для безопасного хранения и поиска.
 */
export function hashSessionToken(sessionToken: string): string {
  return createHash(SESSION_TOKEN_HASH_ALGORITHM).update(sessionToken).digest("hex");
}

/**
 * Считывает auth session token из стандартного Bearer header или project-specific header.
 */
export function readSessionToken(headers: Headers): string | null {
  const directToken = headers.get(SESSION_TOKEN_HEADER)?.trim();

  if (directToken) {
    return directToken;
  }

  const authorizationHeader = headers.get("authorization")?.trim();

  if (!authorizationHeader?.startsWith(AUTHORIZATION_BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(AUTHORIZATION_BEARER_PREFIX.length).trim();

  return token || null;
}
