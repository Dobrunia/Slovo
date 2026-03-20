import { createClientRuntime } from "dobrunia-liverail-client";
import { createSocketIoClientTransport } from "dobrunia-liverail-client/socket-io";
import { DEFAULT_CLIENT_REALTIME_URL } from "../constants";
import { slovoRealtimeRegistry } from "./contracts";
import type {
  ClientPresenceUpdatedEventPayload,
  ClientChannelsUpdatedEventPayload,
  ClientServerUpdatedEventPayload,
  ClientVoiceSessionSignaledEventPayload,
  ClientVoiceStateUpdatedEventPayload,
} from "../types/server";

type SlovoRealtimeRuntime = ReturnType<typeof createClientRuntime<typeof slovoRealtimeRegistry>>;

type ServerStructureSubscriptionInput = {
  sessionToken: string | null;
  serverId: string;
  onServerUpdated: (payload: ClientServerUpdatedEventPayload) => void;
  onChannelsUpdated: (payload: ClientChannelsUpdatedEventPayload) => void;
};

type ServerPresenceSubscriptionInput = {
  sessionToken: string | null;
  serverId: string;
  onPresenceUpdated: (payload: ClientPresenceUpdatedEventPayload) => void;
};

type VoiceSignalingSubscriptionInput = {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  onVoiceSessionSignaled: (payload: ClientVoiceSessionSignaledEventPayload) => void;
};

type VoiceSessionSubscriptionInput = {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  onVoiceStateUpdated: (payload: ClientVoiceStateUpdatedEventPayload) => void;
};

let runtime: SlovoRealtimeRuntime | null = null;
let runtimeSessionToken: string | null = null;

/**
 * Полностью уничтожает текущий client-side realtime runtime.
 */
export function resetRealtimeRuntime(): void {
  runtime?.destroy();
  runtime = null;
  runtimeSessionToken = null;
}

/**
 * Подписывает клиента на live-структуру конкретного сервера.
 */
export async function subscribeToServerStructure(
  input: ServerStructureSubscriptionInput,
): Promise<() => Promise<void>> {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  const channelKey = {
    serverId: input.serverId,
  };

  const stopServerUpdated = currentRuntime.onEvent("server.updated", (payload) => {
    if (payload.serverId === input.serverId) {
      input.onServerUpdated(payload);
    }
  });
  const stopChannelsUpdated = currentRuntime.onEvent("channels.updated", (payload) => {
    if (payload.serverId === input.serverId) {
      input.onChannelsUpdated(payload);
    }
  });

  await currentRuntime.subscribeChannel("server.structure", channelKey);

  return async () => {
    stopServerUpdated();
    stopChannelsUpdated();
    await currentRuntime.unsubscribeChannel("server.structure", channelKey);
  };
}

/**
 * Подписывает клиента на runtime presence конкретного сервера.
 */
export async function subscribeToServerPresence(
  input: ServerPresenceSubscriptionInput,
): Promise<() => Promise<void>> {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  const channelKey = {
    serverId: input.serverId,
  };
  const stopPresenceUpdated = currentRuntime.onEvent("presence.updated", (payload) => {
    if (payload.serverId === input.serverId) {
      input.onPresenceUpdated(payload);
    }
  });

  await currentRuntime.subscribeChannel("server.presence", channelKey);

  return async () => {
    stopPresenceUpdated();
    await currentRuntime.unsubscribeChannel("server.presence", channelKey);
  };
}

/**
 * Подписывает клиента на signaling-события активного voice-канала.
 */
export async function subscribeToVoiceSignaling(
  input: VoiceSignalingSubscriptionInput,
): Promise<() => Promise<void>> {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  const channelKey = {
    serverId: input.serverId,
    channelId: input.channelId,
  };
  const stopVoiceSessionSignaled = currentRuntime.onEvent(
    "voice-session.signaled",
    (payload) => {
      if (
        payload.serverId === input.serverId &&
        payload.channelId === input.channelId
      ) {
        input.onVoiceSessionSignaled(payload);
      }
    },
  );

  await currentRuntime.subscribeChannel("voice.signaling", channelKey);

  return async () => {
    stopVoiceSessionSignaled();
    await currentRuntime.unsubscribeChannel("voice.signaling", channelKey);
  };
}

/**
 * Подписывает клиента на voice session state активного канала.
 */
export async function subscribeToVoiceSession(
  input: VoiceSessionSubscriptionInput,
): Promise<() => Promise<void>> {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  const channelKey = {
    serverId: input.serverId,
    channelId: input.channelId,
  };
  const stopVoiceStateUpdated = currentRuntime.onEvent("voice-state.updated", (payload) => {
    if (
      payload.serverId === input.serverId &&
      payload.channelId === input.channelId
    ) {
      input.onVoiceStateUpdated(payload);
    }
  });

  await currentRuntime.subscribeChannel("voice.session", channelKey);

  return async () => {
    stopVoiceStateUpdated();
    await currentRuntime.unsubscribeChannel("voice.session", channelKey);
  };
}

/**
 * Выполняет realtime-команду входа в голосовой канал.
 */
export async function executeJoinVoiceChannelCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.join-channel", {
    serverId: input.serverId,
    channelId: input.channelId,
  });
}

/**
 * Выполняет realtime-команду выхода из голосового канала.
 */
export async function executeLeaveVoiceChannelCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.leave-channel", {
    serverId: input.serverId,
    channelId: input.channelId,
  });
}

/**
 * Выполняет realtime-команду перехода между голосовыми каналами.
 */
export async function executeMoveVoiceChannelCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  targetChannelId: string;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.move-channel", {
    serverId: input.serverId,
    channelId: input.channelId,
    targetChannelId: input.targetChannelId,
  });
}

/**
 * Выполняет realtime-команду изменения self-mute состояния.
 */
export async function executeSetSelfMuteCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  muted: boolean;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.set-self-mute", {
    serverId: input.serverId,
    channelId: input.channelId,
    muted: input.muted,
  });
}

/**
 * Выполняет realtime-команду изменения self-deafen состояния.
 */
export async function executeSetSelfDeafenCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  deafened: boolean;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.set-self-deafen", {
    serverId: input.serverId,
    channelId: input.channelId,
    deafened: input.deafened,
  });
}

/**
 * Выполняет signaling-команду текущего voice session.
 */
export async function executeSignalVoiceSessionCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  targetUserId: string | null;
  signalType: string;
  payloadJson: string;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  return currentRuntime.executeCommand("voice.signal-session", {
    serverId: input.serverId,
    channelId: input.channelId,
    targetUserId: input.targetUserId,
    signalType: input.signalType,
    payloadJson: input.payloadJson,
  });
}

/**
 * Возвращает singleton realtime runtime для текущей auth-сессии.
 */
export function ensureRealtimeRuntime(sessionToken: string | null): SlovoRealtimeRuntime {
  if (runtime && runtimeSessionToken === sessionToken) {
    return runtime;
  }

  resetRealtimeRuntime();

  runtime = createClientRuntime({
    registry: slovoRealtimeRegistry,
    transport: createSocketIoClientTransport({
      url: import.meta.env.VITE_REALTIME_URL || DEFAULT_CLIENT_REALTIME_URL,
      socketOptions: sessionToken
        ? {
            auth: {
              sessionToken,
            },
          }
        : undefined,
    }),
    onError: (error) => {
      console.error("Realtime runtime error", error);
    },
  });
  runtimeSessionToken = sessionToken;

  return runtime;
}
