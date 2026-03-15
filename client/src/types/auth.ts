/**
 * Состояние авторизации клиента.
 */
export type AuthStatus = "idle" | "initializing" | "authenticated" | "anonymous";

/**
 * Публичные данные авторизованного пользователя.
 */
export interface ClientUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * Публичные данные авторизованного пользователя.
 */
export type AuthUser = ClientUser;

/**
 * Входные данные регистрации пользователя.
 */
export interface RegisterInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

/**
 * Входные данные логина пользователя.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Результат регистрации пользователя.
 */
export interface RegisterResult {
  user: ClientUser;
}

/**
 * Результат успешной авторизации пользователя.
 */
export interface AuthSessionResult {
  sessionToken: string;
  user: ClientUser;
}

/**
 * Модель формы логина.
 */
export interface LoginFormModel {
  email: string;
  password: string;
}

/**
 * Модель формы регистрации.
 */
export interface RegisterFormModel {
  email: string;
  username: string;
  displayName: string;
  password: string;
}
