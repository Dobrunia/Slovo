import { z } from "zod";

/**
 * Публичная краткая форма сервера для списков и навигации клиента.
 */
export const publicServerListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().optional(),
  isPublic: z.boolean(),
  role: z.string().min(1),
});

/**
 * Публичная краткая форма voice-канала для initial snapshot и live-обновлений.
 */
export const publicVoiceChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

/**
 * Публичный initial snapshot выбранного сервера.
 */
export const publicServerSnapshotSchema = z.object({
  server: publicServerListItemSchema,
  channels: z.array(publicVoiceChannelSchema),
});

/**
 * Публичная форма invite-ссылки сервера для server settings и invite-flow.
 */
export const publicServerInviteLinkSchema = z.object({
  serverId: z.string().min(1),
  inviteLink: z.string().url(),
});

/**
 * Публичная форма публичного сервера для discovery-поиска.
 */
export const publicServerDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().optional(),
  isPublic: z.boolean(),
});

/**
 * Публичный payload сервера в списке пользовательских серверов.
 */
export type PublicServerListItem = z.infer<typeof publicServerListItemSchema> & {
  role: "OWNER" | "ADMIN" | "MEMBER";
};

/**
 * Публичная форма voice-канала сервера.
 */
export type PublicVoiceChannel = z.infer<typeof publicVoiceChannelSchema>;

/**
 * Публичный initial snapshot сервера с каналами.
 */
export type PublicServerSnapshot = z.infer<typeof publicServerSnapshotSchema> & {
  server: PublicServerListItem;
};

/**
 * Публичная invite-ссылка сервера.
 */
export type PublicServerInviteLink = z.infer<typeof publicServerInviteLinkSchema>;

/**
 * Публичная краткая форма публичного сервера для discovery-списков.
 */
export type PublicServerDiscoveryItem = z.infer<typeof publicServerDiscoveryItemSchema>;

type PublicServerListItemSource = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type PublicServerDiscoveryItemSource = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type PublicVoiceChannelSource = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * Преобразует серверную запись membership+server в безопасную клиентскую форму.
 */
export function toPublicServerListItem(
  server: PublicServerListItemSource,
): PublicServerListItem {
  return {
    id: server.id,
    name: server.name,
    avatarUrl: server.avatarUrl ?? undefined,
    isPublic: server.isPublic,
    role: server.role,
  };
}

/**
 * Преобразует серверную запись voice-канала в безопасную клиентскую форму.
 */
export function toPublicVoiceChannel(
  channel: PublicVoiceChannelSource,
): PublicVoiceChannel {
  return {
    id: channel.id,
    name: channel.name,
    sortOrder: channel.sortOrder,
  };
}

/**
 * Преобразует invite token сервера в безопасную клиентскую форму ссылки.
 */
export function toPublicServerInviteLink(input: {
  serverId: string;
  inviteLink: string;
}): PublicServerInviteLink {
  return {
    serverId: input.serverId,
    inviteLink: input.inviteLink,
  };
}

/**
 * Преобразует публичный сервер в безопасную discovery-форму.
 */
export function toPublicServerDiscoveryItem(
  server: PublicServerDiscoveryItemSource,
): PublicServerDiscoveryItem {
  return {
    id: server.id,
    name: server.name,
    avatarUrl: server.avatarUrl ?? undefined,
    isPublic: true,
  };
}
