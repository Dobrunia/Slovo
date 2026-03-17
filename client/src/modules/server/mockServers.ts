import type { ClientServerListItem } from "../../types/server";

/**
 * Временный флаг для ручной подстановки списка mock-серверов в верхний rail.
 */
export const ENABLE_SERVER_RAIL_MOCKS = false;

/**
 * Количество временных mock-элементов серверного rail.
 */
export const SERVER_RAIL_MOCK_COUNT = 20;

/**
 * Генерирует детерминированный набор mock-серверов для layout-проверок.
 */
export const SERVER_RAIL_MOCK_SERVERS: ClientServerListItem[] = Array.from(
  {
    length: SERVER_RAIL_MOCK_COUNT,
  },
  (_, index) => ({
    id: `mock-server-${index + 1}`,
    name: `Сервер ${index + 1}`,
    avatarUrl: null,
    isPublic: false,
    role: "OWNER",
  }),
);
