// Transport

/**
 * Стандартный GraphQL URL клиента.
 */
export const DEFAULT_CLIENT_GRAPHQL_URL = "http://localhost:4000/graphql";

/**
 * Стандартный realtime URL клиента.
 */
export const DEFAULT_CLIENT_REALTIME_URL = "http://localhost:4000";

/**
 * Заголовок для клиентского session token.
 */
export const SESSION_TOKEN_HEADER = "x-session-token";

/**
 * Префикс Authorization header для Bearer token.
 */
export const AUTHORIZATION_BEARER_PREFIX = "Bearer ";

// App

/**
 * Стандартный заголовок клиента.
 */
export const DEFAULT_CLIENT_APP_TITLE = "Slovo";

// Auth

/**
 * Ключ localStorage для session token клиента.
 */
export const AUTH_SESSION_STORAGE_KEY = "slovo.session-token";

// Routes

/**
 * Корневой маршрут приложения.
 */
export const ROOT_ROUTE_PATH = "/";

/**
 * Маршрут логина.
 */
export const LOGIN_ROUTE_PATH = "/login";

/**
 * Маршрут регистрации.
 */
export const REGISTER_ROUTE_PATH = "/register";

/**
 * Публичный маршрут политики обработки персональных данных.
 */
export const PRIVACY_POLICY_ROUTE_PATH = "/privacy-policy";

/**
 * Защищенный основной маршрут приложения.
 */
export const APP_HOME_ROUTE_PATH = "/app";

/**
 * Публичный client-side path для invite-ссылок серверов.
 */
export const SERVER_INVITE_ROUTE_PATH = "/invite/:inviteToken";

/**
 * Префикс client-side invite-маршрута без параметра токена.
 */
export const SERVER_INVITE_ROUTE_PREFIX = "/invite/";

/**
 * Query-ключ, в котором хранится post-auth redirect target.
 */
export const AUTH_REDIRECT_QUERY_KEY = "redirect";
