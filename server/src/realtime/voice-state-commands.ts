import type { RuntimePresenceRegistry } from "./presence.js";
import type { RuntimeVoiceStateRegistry, RuntimeVoiceState } from "./voice-state.js";

type VoiceCommandAck = {
  accepted: boolean;
  acknowledgedAt: string;
};

type EmitVoiceStateUpdated = (payload: {
  serverId: string;
  userId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  occurredAt: string;
}) => Promise<unknown>;

type ApplyVoiceState = (state: {
  userId: string;
  serverId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
}) => Promise<void>;

type BaseVoiceStateCommandInput = {
  presenceRegistry: RuntimePresenceRegistry;
  voiceStateRegistry: RuntimeVoiceStateRegistry;
  userId: string;
  connectionId: string;
  serverId: string;
  channelId: string;
  applyVoiceState: ApplyVoiceState;
  emitVoiceStateUpdated: EmitVoiceStateUpdated;
};

type SetSelfMuteCommandInput = BaseVoiceStateCommandInput & {
  muted: boolean;
};

type SetSelfDeafenCommandInput = BaseVoiceStateCommandInput & {
  deafened: boolean;
};

/**
 * Обновляет server-authoritative self-mute состояние активного пользователя.
 */
export async function setSelfMuteCommand(
  input: SetSelfMuteCommandInput,
): Promise<VoiceCommandAck> {
  const currentPresence = requireActivePresence(input);
  const occurredAt = new Date().toISOString();
  const previousState = input.voiceStateRegistry.getUserState(input.userId);
  const nextState = input.voiceStateRegistry.setState({
    userId: input.userId,
    serverId: currentPresence.serverId,
    channelId: currentPresence.channelId,
    muted: input.muted,
    deafened: previousState?.deafened ?? false,
  });

  await emitVoiceStateChange(input, nextState, occurredAt);

  return {
    accepted: true,
    acknowledgedAt: occurredAt,
  };
}

/**
 * Обновляет server-authoritative self-deafen состояние активного пользователя.
 */
export async function setSelfDeafenCommand(
  input: SetSelfDeafenCommandInput,
): Promise<VoiceCommandAck> {
  const currentPresence = requireActivePresence(input);
  const occurredAt = new Date().toISOString();
  const previousState = input.voiceStateRegistry.getUserState(input.userId);
  const nextState = input.voiceStateRegistry.setState({
    userId: input.userId,
    serverId: currentPresence.serverId,
    channelId: currentPresence.channelId,
    muted: previousState?.muted ?? false,
    deafened: input.deafened,
  });

  await emitVoiceStateChange(input, nextState, occurredAt);

  return {
    accepted: true,
    acknowledgedAt: occurredAt,
  };
}

function requireActivePresence(input: {
  presenceRegistry: RuntimePresenceRegistry;
  userId: string;
  connectionId: string;
  serverId: string;
  channelId: string;
}) {
  const currentPresence = input.presenceRegistry.getUserPresenceRecord(input.userId);

  if (
    !currentPresence ||
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId ||
    currentPresence.connectionId !== input.connectionId
  ) {
    throw new Error("Изменение voice state доступно только из активного канала.");
  }

  return currentPresence;
}

async function emitVoiceStateChange(
  input: BaseVoiceStateCommandInput,
  nextState: RuntimeVoiceState,
  occurredAt: string,
): Promise<void> {
  await input.applyVoiceState({
    userId: nextState.userId,
    serverId: nextState.serverId,
    channelId: nextState.channelId,
    muted: nextState.muted,
    deafened: nextState.deafened,
  });
  await input.emitVoiceStateUpdated({
    serverId: nextState.serverId,
    userId: nextState.userId,
    channelId: nextState.channelId,
    muted: nextState.muted,
    deafened: nextState.deafened,
    occurredAt,
  });
}
