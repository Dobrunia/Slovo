// Domain limits

/**
 * Максимально допустимое число серверов у одного владельца.
 */
export const MAX_SERVERS_PER_OWNER = 2;

/**
 * Максимально допустимое число каналов внутри одного сервера.
 */
export const MAX_CHANNELS_PER_SERVER = 5;

/**
 * Минимальная длина названия сервера.
 */
export const SERVER_NAME_MIN_LENGTH = 1;

/**
 * Максимальная длина названия сервера.
 */
export const SERVER_NAME_MAX_LENGTH = 191;

/**
 * Максимальная длина URL аватара сервера.
 */
export const SERVER_AVATAR_URL_MAX_LENGTH = 2048;

// Runtime defaults

/**
 * Стандартный URL базы данных для локального запуска.
 */
export const DEFAULT_DATABASE_URL = "mysql://slovo:slovo@127.0.0.1:3306/slovo";

/**
 * Стандартный порт MySQL, если он не указан в DATABASE_URL.
 */
export const DEFAULT_DATABASE_PORT = 3306;

/**
 * Стандартный серверный порт.
 */
export const DEFAULT_SERVER_PORT = 4000;

/**
 * Стандартный GraphQL path.
 */
export const DEFAULT_GRAPHQL_PATH = "/graphql";

/**
 * Стандартный origin клиента.
 */
export const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";

/**
 * Стандартное имя серверного сервиса в health-ответах и runtime-логах.
 */
export const DEFAULT_SERVER_SERVICE_NAME = "slovo-server";

// GraphQL security

/**
 * Максимальная глубина GraphQL-запроса.
 */
export const GRAPHQL_MAX_QUERY_DEPTH = 6;

/**
 * Максимальная вычисленная сложность GraphQL-запроса.
 */
export const GRAPHQL_MAX_QUERY_COMPLEXITY = 50;

/**
 * Максимальная глубина вложенности GraphQL-списков.
 */
export const GRAPHQL_MAX_NESTED_LIST_DEPTH = 2;

// Auth

/**
 * Заголовок для передачи auth session token между клиентом и сервером.
 */
export const SESSION_TOKEN_HEADER = "x-session-token";

/**
 * Префикс Authorization header для Bearer token.
 */
export const AUTHORIZATION_BEARER_PREFIX = "Bearer ";

/**
 * Алгоритм хеширования auth session token.
 */
export const SESSION_TOKEN_HASH_ALGORITHM = "sha256";

/**
 * Размер сырого auth session token в байтах до кодирования.
 */
export const SESSION_TOKEN_BYTES = 32;

/**
 * Размер случайной соли пароля в байтах.
 */
export const PASSWORD_SALT_BYTES = 16;

/**
 * Размер итогового ключа пароля после scrypt.
 */
export const PASSWORD_KEY_BYTES = 64;

// Auth validation

/**
 * Минимальная длина пользовательского username.
 */
export const USERNAME_MIN_LENGTH = 3;

/**
 * Минимальная длина пользовательского display name.
 */
export const DISPLAY_NAME_MIN_LENGTH = 1;

/**
 * Минимальная длина пользовательского пароля.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Максимальная длина пользовательского email.
 */
export const USER_EMAIL_MAX_LENGTH = 191;

/**
 * Максимальная длина пользовательского username.
 */
export const USERNAME_MAX_LENGTH = 191;

/**
 * Максимальная длина пользовательского display name.
 */
export const DISPLAY_NAME_MAX_LENGTH = 191;

/**
 * Максимальная длина пользовательского avatar URL.
 */
export const USER_AVATAR_URL_MAX_LENGTH = 2048;

/**
 * Максимальная длина пользовательского пароля.
 */
export const PASSWORD_MAX_LENGTH = 255;
