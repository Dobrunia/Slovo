import {
  createClientRuntime,
  type ClientConnectionLifecycleSnapshot,
} from "dobrunia-liverail-client";
import { createSocketIoClientTransport } from "dobrunia-liverail-client/socket-io";
import { DEFAULT_CLIENT_REALTIME_URL } from "../constants";
import { slovoRealtimeRegistry } from "./contracts";
import {
  clearRealtimeError,
  createRealtimeRuntimeError,
  reportRealtimeError,
  subscribeToRealtimeErrors,
} from "./errors";
import type {
  ClientForcedDisconnectEventPayload,
  ClientPresenceUpdatedEventPayload,
  ClientChannelsUpdatedEventPayload,
  ClientRealtimeRuntimeError,
  ClientScreenShareUpdatedEventPayload,
  ClientServerUpdatedEventPayload,
  ClientUserServersUpdatedEventPayload,
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

type UserProfileSubscriptionInput = {
  sessionToken: string | null;
  userId: string;
  onUserServersUpdated: (payload: ClientUserServersUpdatedEventPayload) => void;
  onForcedDisconnect: (payload: ClientForcedDisconnectEventPayload) => void;
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
  onScreenShareUpdated: (payload: ClientScreenShareUpdatedEventPayload) => void;
};

type RealtimeConnectionStateSubscriptionInput = {
  sessionToken: string | null;
  onConnectionState: (snapshot: ClientConnectionLifecycleSnapshot) => void;
};

let runtime: SlovoRealtimeRuntime | null = null;
let runtimeSessionToken: string | null = null;

export { subscribeToRealtimeErrors };

/**
 * Полностью уничтожает текущий client-side realtime runtime.
 */
export function resetRealtimeRuntime(): void {
  runtime?.destroy();
  runtime = null;
  runtimeSessionToken = null;
}

/**
 * Очищает последнее app-side realtime runtime сообщение об ошибке.
 */
export function clearRealtimeRuntimeError(
  scope?: ClientRealtimeRuntimeError["scope"],
): void {
  clearRealtimeError(scope);
}

/**
 * Подписывает клиента на transport-agnostic lifecycle realtime-соединения.
 */
export function subscribeToRealtimeConnectionState(
  input: RealtimeConnectionStateSubscriptionInput,
): () => void {
  if (!input.sessionToken) {
    return () => undefined;
  }

  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  input.onConnectionState(currentRuntime.inspectConnection());

  return currentRuntime.onConnectionState(input.onConnectionState);
}

/**
 * Подписывает клиента на live-структуру конкретного сервера.
 */
export async function subscribeToServerStructure(
  input: ServerStructureSubscriptionInput,
): Promise<() => Promise<void>> {
  return subscribeToChannelEvents({
    sessionToken: input.sessionToken,
    channelName: "server.structure",
    channelKey: {
      serverId: input.serverId,
    },
    fallbackMessage: "Не удалось подписаться на realtime структуры сервера.",
    registerListeners: (currentRuntime) => [
      currentRuntime.onEvent("server.updated", (payload) => {
        if (payload.serverId === input.serverId) {
          input.onServerUpdated(payload);
        }
      }),
      currentRuntime.onEvent("channels.updated", (payload) => {
        if (payload.serverId === input.serverId) {
          input.onChannelsUpdated(payload);
        }
      }),
    ],
  });
}

/**
 * Подписывает клиента на runtime presence конкретного сервера.
 */
export async function subscribeToServerPresence(
  input: ServerPresenceSubscriptionInput,
): Promise<() => Promise<void>> {
  return subscribeToChannelEvents({
    sessionToken: input.sessionToken,
    channelName: "server.presence",
    channelKey: {
      serverId: input.serverId,
    },
    fallbackMessage: "Не удалось подписаться на realtime присутствия сервера.",
    registerListeners: (currentRuntime) => [
      currentRuntime.onEvent("presence.updated", (payload) => {
        if (payload.serverId === input.serverId) {
          input.onPresenceUpdated(payload);
        }
      }),
    ],
  });
}

/**
 * Подписывает клиента на user-level realtime события текущего пользователя.
 */
export async function subscribeToCurrentUserProfile(
  input: UserProfileSubscriptionInput,
): Promise<() => Promise<void>> {
  return subscribeToChannelEvents({
    sessionToken: input.sessionToken,
    channelName: "user.profile",
    channelKey: {
      userId: input.userId,
    },
    fallbackMessage: "Не удалось подписаться на пользовательский realtime-профиль.",
    registerListeners: (currentRuntime) => [
      currentRuntime.onEvent("user-servers.updated", (payload) => {
        if (payload.userId === input.userId) {
          input.onUserServersUpdated(payload);
        }
      }),
      currentRuntime.onEvent("forced-disconnect", (payload) => {
        if (payload.userId === input.userId) {
          input.onForcedDisconnect(payload);
        }
      }),
    ],
  });
}

/**
 * Подписывает клиента на signaling-события активного voice-канала.
 */
export async function subscribeToVoiceSignaling(
  input: VoiceSignalingSubscriptionInput,
): Promise<() => Promise<void>> {
  return subscribeToChannelEvents({
    sessionToken: input.sessionToken,
    channelName: "voice.signaling",
    channelKey: {
      serverId: input.serverId,
      channelId: input.channelId,
    },
    fallbackMessage: "Не удалось подписаться на voice signaling канала.",
    registerListeners: (currentRuntime) => [
      currentRuntime.onEvent("voice-session.signaled", (payload) => {
        if (
          payload.serverId === input.serverId &&
          payload.channelId === input.channelId
        ) {
          input.onVoiceSessionSignaled(payload);
        }
      }),
    ],
  });
}

/**
 * Подписывает клиента на voice session state активного канала.
 */
export async function subscribeToVoiceSession(
  input: VoiceSessionSubscriptionInput,
): Promise<() => Promise<void>> {
  return subscribeToChannelEvents({
    sessionToken: input.sessionToken,
    channelName: "voice.session",
    channelKey: {
      serverId: input.serverId,
      channelId: input.channelId,
    },
    fallbackMessage: "Не удалось подписаться на voice session канала.",
    registerListeners: (currentRuntime) => [
      currentRuntime.onEvent("voice-state.updated", (payload) => {
        if (
          payload.serverId === input.serverId &&
          payload.channelId === input.channelId
        ) {
          input.onVoiceStateUpdated(payload);
        }
      }),
      currentRuntime.onEvent("screen-share.updated", (payload) => {
        if (
          payload.serverId === input.serverId &&
          payload.channelId === input.channelId
        ) {
          input.onScreenShareUpdated(payload);
        }
      }),
    ],
  });
}

/**
 * Выполняет realtime-команду входа в голосовой канал.
 */
export async function executeJoinVoiceChannelCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
}) {
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.join-channel",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
    },
    fallbackMessage: "Не удалось выполнить вход в голосовой канал.",
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
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.leave-channel",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
    },
    fallbackMessage: "Не удалось выполнить выход из голосового канала.",
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
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.move-channel",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
      targetChannelId: input.targetChannelId,
    },
    fallbackMessage: "Не удалось выполнить переход между голосовыми каналами.",
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
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.set-self-mute",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
      muted: input.muted,
    },
    fallbackMessage: "Не удалось изменить состояние микрофона.",
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
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.set-self-deafen",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
      deafened: input.deafened,
    },
    fallbackMessage: "Не удалось изменить состояние наушников.",
  });
}

/**
 * Выполняет realtime-команду изменения состояния демонстрации экрана.
 */
export async function executeSetScreenShareActiveCommand(input: {
  sessionToken: string | null;
  serverId: string;
  channelId: string;
  active: boolean;
}) {
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.set-screen-share-active",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
      active: input.active,
    },
    fallbackMessage: "Не удалось изменить состояние демонстрации экрана.",
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
  return executeRealtimeCommand({
    sessionToken: input.sessionToken,
    commandName: "voice.signal-session",
    payload: {
      serverId: input.serverId,
      channelId: input.channelId,
      targetUserId: input.targetUserId,
      signalType: input.signalType,
      payloadJson: input.payloadJson,
    },
    fallbackMessage: "Не удалось выполнить signaling-команду голосовой сессии.",
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
      reportRealtimeError(
        createRealtimeRuntimeError({
          scope: "transport",
          error,
          fallbackMessage: "Realtime transport завершился ошибкой.",
        }),
      );
    },
  });
  runtimeSessionToken = sessionToken;

  return runtime;
}

async function subscribeToChannelEvents<
  TChannelName extends Parameters<SlovoRealtimeRuntime["subscribeChannel"]>[0],
  TChannelKey extends Parameters<SlovoRealtimeRuntime["subscribeChannel"]>[1],
>(input: {
  sessionToken: string | null;
  channelName: TChannelName;
  channelKey: TChannelKey;
  fallbackMessage: string;
  registerListeners: (runtime: SlovoRealtimeRuntime) => Array<() => void>;
}): Promise<() => Promise<void>> {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);
  let subscribed = false;
  let stopListeners: Array<() => void> = [];

  try {
    await currentRuntime.subscribeChannel(input.channelName, input.channelKey);
    subscribed = true;
    stopListeners = input.registerListeners(currentRuntime);
    clearRealtimeError("subscription");

    return async () => {
      for (const stopListener of stopListeners) {
        stopListener();
      }

      await currentRuntime.unsubscribeChannel(input.channelName, input.channelKey);
    };
  } catch (error) {
    for (const stopListener of stopListeners) {
      stopListener();
    }

    if (subscribed) {
      await currentRuntime.unsubscribeChannel(input.channelName, input.channelKey).catch(
        () => undefined,
      );
    }

    reportRealtimeError(
      createRealtimeRuntimeError({
        scope: "subscription",
        error,
        fallbackMessage: input.fallbackMessage,
      }),
    );
    throw error;
  }
}

async function executeRealtimeCommand<
  TCommandName extends Parameters<SlovoRealtimeRuntime["executeCommand"]>[0],
  TPayload extends Parameters<SlovoRealtimeRuntime["executeCommand"]>[1],
>(input: {
  sessionToken: string | null;
  commandName: TCommandName;
  payload: TPayload;
  fallbackMessage: string;
}) {
  const currentRuntime = ensureRealtimeRuntime(input.sessionToken);

  try {
    const result = await currentRuntime.executeCommand(input.commandName, input.payload);
    clearRealtimeError("command");
    return result;
  } catch (error) {
    reportRealtimeError(
      createRealtimeRuntimeError({
        scope: "command",
        error,
        fallbackMessage: input.fallbackMessage,
      }),
    );
    throw error;
  }
}
