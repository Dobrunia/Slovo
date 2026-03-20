import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimePresenceRegistry } from "../src/realtime/presence.js";
import { createRuntimeVoiceStateRegistry } from "../src/realtime/voice-state.js";
import {
  setSelfDeafenCommand,
  setSelfMuteCommand,
} from "../src/realtime/voice-state-commands.js";

/**
 * Проверяется, что команда self-mute обновляет runtime voice state
 * только для пользователя, который действительно находится в активном канале,
 * и прокидывает итоговое состояние дальше в media-слой и live-событие.
 * Это важно, потому что mute должен быть не только UI-флажком, а серверной
 * точкой истины для исходящего аудио и дальнейшей синхронизации клиента.
 * Граничные случаи: команда стартует без предварительно сохраненного voice state,
 * поэтому сервер должен корректно создать его с deafened=false по умолчанию.
 */
test("should update runtime voice state and emit a mute change for the active user", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });

  const voiceStateRegistry = createRuntimeVoiceStateRegistry();
  const appliedVoiceStates: unknown[] = [];
  const emittedEvents: unknown[] = [];

  const result = await setSelfMuteCommand({
    presenceRegistry,
    voiceStateRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    muted: true,
    applyVoiceState(nextState) {
      appliedVoiceStates.push(nextState);
      return Promise.resolve();
    },
    emitVoiceStateUpdated(payload) {
      emittedEvents.push(payload);
      return Promise.resolve();
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(voiceStateRegistry.getUserState("user-1")?.muted, true);
  assert.equal(voiceStateRegistry.getUserState("user-1")?.deafened, false);
  assert.deepEqual(appliedVoiceStates, [
    {
      userId: "user-1",
      serverId: "server-1",
      channelId: "channel-1",
      muted: true,
      deafened: false,
    },
  ]);
  assert.equal((emittedEvents.at(0) as { muted: boolean }).muted, true);
});

/**
 * Проверяется, что команда self-deafen обновляет runtime voice state
 * и сохраняет при этом текущее значение `muted`, не теряя предыдущее состояние.
 * Это важно, потому что deafen в приложении означает отдельный live-state,
 * который влияет и на исходящий голос, и на входящее прослушивание.
 * Граничные случаи: сначала пользователь уже замьючен, затем включает deafen,
 * и сервер должен вернуть комбинированное состояние без обнуления mute-флага.
 */
test("should preserve mute state while toggling deafen for the active user", async () => {
  const presenceRegistry = createRuntimePresenceRegistry();
  presenceRegistry.setPresence({
    userId: "user-1",
    displayName: "Добрыня",
    avatarUrl: null,
    serverId: "server-1",
    channelId: "channel-1",
  });

  const voiceStateRegistry = createRuntimeVoiceStateRegistry();
  voiceStateRegistry.setState({
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    muted: true,
    deafened: false,
  });
  const appliedVoiceStates: unknown[] = [];
  const emittedEvents: unknown[] = [];

  const result = await setSelfDeafenCommand({
    presenceRegistry,
    voiceStateRegistry,
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    deafened: true,
    applyVoiceState(nextState) {
      appliedVoiceStates.push(nextState);
      return Promise.resolve();
    },
    emitVoiceStateUpdated(payload) {
      emittedEvents.push(payload);
      return Promise.resolve();
    },
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(voiceStateRegistry.getUserState("user-1"), {
    userId: "user-1",
    serverId: "server-1",
    channelId: "channel-1",
    muted: true,
    deafened: true,
  });
  assert.deepEqual(appliedVoiceStates, [
    {
      userId: "user-1",
      serverId: "server-1",
      channelId: "channel-1",
      muted: true,
      deafened: true,
    },
  ]);
  assert.equal((emittedEvents.at(0) as { deafened: boolean }).deafened, true);
});
