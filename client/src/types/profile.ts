import type { ClientUser } from "./auth";

/**
 * Входные данные для клиентского сохранения профиля пользователя.
 */
export interface ClientProfileUpdateInput {
  displayName: string;
  avatarUrl: string;
}

/**
 * Входные данные для изменения display name через GraphQL.
 */
export interface ClientUpdateDisplayNameInput {
  displayName: string;
}

/**
 * Входные данные для изменения аватара через GraphQL.
 */
export interface ClientUpdateAvatarInput {
  avatarUrl: string | null;
}

/**
 * Результат успешного изменения профиля через GraphQL.
 */
export interface ClientProfileMutationResult {
  user: ClientUser;
}
