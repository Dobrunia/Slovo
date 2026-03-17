import { describe, expect, test } from "vitest";
import {
  buildAppServerChannelRoute,
  buildAppServerRoute,
  readSelectedChannelIdFromRouteParams,
  readSelectedServerIdFromRouteParams,
} from "../src/router/serverRoutes";

describe("server route helpers", () => {
  /**
   * Проверяется, что helper для открытия сервера собирает предсказуемый route object
   * с именем маршрута и нужным `serverId`.
   * Это важно, потому что клик по серверу в верхнем rail должен менять URL
   * одинаково во всех местах приложения, а не собираться вручную строками.
   * Граничные случаи: route должен содержать только серверный id и не должен
   * случайно тащить channel params из других сценариев.
   */
  test("should build a route location for a selected server", () => {
    expect(buildAppServerRoute("server-1")).toBe("/app/servers/server-1");
  });

  /**
   * Проверяется, что helper для открытия канала собирает route object
   * с `serverId` и `channelId`, а parser затем корректно извлекает оба значения из params.
   * Это важно, потому что канал должен быть адресуемым через URL и переживать reload,
   * иначе выбранный контекст общения будет теряться при каждом обновлении страницы.
   * Граничные случаи: parser должен возвращать `null`, если параметр отсутствует
   * или пришел в неподходящем формате вместо обычной строки.
   */
  test("should build and parse a route location for a selected channel", () => {
    expect(buildAppServerChannelRoute("server-1", "channel-9")).toBe(
      "/app/servers/server-1/channels/channel-9",
    );

    expect(
      readSelectedServerIdFromRouteParams({
        serverId: "server-1",
        channelId: "channel-9",
      }),
    ).toBe("server-1");
    expect(
      readSelectedChannelIdFromRouteParams({
        serverId: "server-1",
        channelId: "channel-9",
      }),
    ).toBe("channel-9");
    expect(readSelectedChannelIdFromRouteParams({})).toBeNull();
  });
});
