/**
 * Максимально допустимое число серверов у одного владельца.
 */
export const MAX_SERVERS_PER_OWNER = 2;

/**
 * Максимально допустимое число каналов внутри одного сервера.
 */
export const MAX_CHANNELS_PER_SERVER = 5;

/**
 * Стандартный URL базы данных для локального запуска.
 */
export const DEFAULT_DATABASE_URL = "mysql://slovo:slovo@127.0.0.1:3306/slovo";

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
