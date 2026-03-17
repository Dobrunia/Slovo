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

type PublicServerListItemSource = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
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
