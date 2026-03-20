import assert from "node:assert/strict";
import test from "node:test";
import { createSocketIoChannelRoute } from "dobrunia-liverail-server/socket-io";
import { createRealtimeEventRouters } from "../src/realtime/events.js";
import {
  REALTIME_CHANNEL_NAMES,
  REALTIME_EVENT_NAMES,
} from "../../shared/realtime/names.js";

test("should route targeted voice signaling to the target user profile channel", () => {
  /*
   * Проверяется критичный сценарий безопасности: signaling-ответ, адресованный
   * одному конкретному пользователю, не должен попадать в общий channel room.
   * Это важно, потому что transport/ICE/producer metadata нельзя раздавать
   * всем подписчикам канала и надеяться только на client-side фильтрацию.
   */
  const eventRouters = createRealtimeEventRouters();
  const route = eventRouters[REALTIME_EVENT_NAMES.voiceSessionSignaled]?.({
    payload: {
      serverId: "server-1",
      channelId: "channel-1",
      sourceUserId: "system",
      targetUserId: "user-2",
      signalType: "mediasoup.transport.create.response",
      payloadJson: "{}",
      occurredAt: "2026-03-20T12:00:00.000Z",
    },
  });

  assert.deepEqual(
    route,
    createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.userProfile, {
      userId: "user-2",
    }),
  );
});

test("should route broadcast voice signaling to the channel signaling room", () => {
  /*
   * Проверяется обратный сценарий: широковещательные signaling-события уровня канала
   * должны остаться channel-scoped, иначе peers перестанут видеть producer available/closed.
   * Это важно, чтобы fix адресной доставки не сломал легитимные broadcast-события канала.
   */
  const eventRouters = createRealtimeEventRouters();
  const route = eventRouters[REALTIME_EVENT_NAMES.voiceSessionSignaled]?.({
    payload: {
      serverId: "server-1",
      channelId: "channel-1",
      sourceUserId: "system",
      targetUserId: null,
      signalType: "mediasoup.producer.available",
      payloadJson: "{}",
      occurredAt: "2026-03-20T12:00:00.000Z",
    },
  });

  assert.deepEqual(
    route,
    createSocketIoChannelRoute(REALTIME_CHANNEL_NAMES.voiceSignaling, {
      serverId: "server-1",
      channelId: "channel-1",
    }),
  );
});
