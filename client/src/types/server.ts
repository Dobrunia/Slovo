/**
 * Роль пользователя внутри сервера.
 */
export type ServerMembershipRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * Краткая клиентская форма сервера для списков и навигации.
 */
export interface ClientServerListItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isPublic: boolean;
  role: ServerMembershipRole;
}

/**
 * Входные данные для создания нового сервера на клиенте.
 */
export interface ClientCreateServerInput {
  name: string;
}

/**
 * Результат успешного создания сервера через GraphQL.
 */
export interface ClientCreateServerResult {
  server: ClientServerListItem;
}

/**
 * Краткая клиентская форма голосового канала сервера.
 */
export interface ClientVoiceChannel {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Initial snapshot выбранного сервера для client-side модуля сервера.
 */
export interface ClientServerSnapshot {
  server: ClientServerListItem;
  channels: ClientVoiceChannel[];
}
