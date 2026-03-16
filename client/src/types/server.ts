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
