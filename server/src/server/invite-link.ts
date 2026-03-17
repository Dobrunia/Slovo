import { randomBytes } from "node:crypto";
import {
  DEFAULT_CLIENT_ORIGIN,
  DEFAULT_SERVER_INVITE_PATHNAME,
  SERVER_INVITE_TOKEN_BYTES,
} from "../config/constants.js";
import type { DataLayer } from "../data/prisma.js";

type InviteServerRecord = {
  id: string;
  inviteToken?: string | null;
};

/**
 * Создает новый invite token сервера.
 */
export function generateServerInviteToken(): string {
  return randomBytes(SERVER_INVITE_TOKEN_BYTES).toString("hex");
}

/**
 * Строит полную клиентскую invite-ссылку сервера.
 */
export function buildServerInviteLink(inviteToken: string): string {
  const clientOrigin = process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN;
  const invitePathname = `${DEFAULT_SERVER_INVITE_PATHNAME}${inviteToken}`;

  return new URL(invitePathname, clientOrigin).toString();
}

/**
 * Гарантирует, что у сервера есть активный invite token, и при отсутствии создает его.
 */
export async function ensureServerInviteToken(
  dataLayer: DataLayer,
  server: InviteServerRecord,
): Promise<{ id: string; inviteToken: string }> {
  if (server.inviteToken) {
    return {
      id: server.id,
      inviteToken: server.inviteToken,
    };
  }

  const updatedServer = await dataLayer.prisma.server.update({
    where: {
      id: server.id,
    },
    data: {
      inviteToken: generateServerInviteToken(),
    },
  });

  return {
    id: updatedServer.id,
    inviteToken: updatedServer.inviteToken!,
  };
}
