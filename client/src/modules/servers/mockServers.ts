import type { ClientServerListItem } from "../../types/server";

/**
 * Временный флаг для показа заглушек серверов в верхнем рейле.
 * Нужен только для визуальной проверки layout до появления реальных серверов.
 */
export const ENABLE_SERVER_RAIL_MOCKS = true;

/**
 * Количество временных заглушек серверов для проверки горизонтального скролла.
 */
export const SERVER_RAIL_MOCK_COUNT = 40;

/**
 * Временный набор серверов-заглушек для проверки скролла, hover и размеров аватаров.
 */
export const SERVER_RAIL_MOCK_SERVERS: ClientServerListItem[] = Array.from(
  { length: SERVER_RAIL_MOCK_COUNT },
  (_, index) => createMockServer(index + 1),
);

/**
 * Создает одну временную запись сервера для визуальной проверки client layout.
 */
function createMockServer(index: number): ClientServerListItem {
  return {
    id: `mock-server-${index}`,
    name: `Тестовый сервер ${index}`,
    avatarUrl: null,
    isPublic: index % 2 === 0,
    role: index % 5 === 0 ? "ADMIN" : "MEMBER",
  };
}
