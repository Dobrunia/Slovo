import type { RuntimePresenceRegistry } from "./presence.js";
import type {
  RuntimeScreenShareRegistry,
  RuntimeScreenShareState,
} from "./screen-share.js";

type ScreenShareCommandAck = {
  accepted: boolean;
  acknowledgedAt: string;
};

type EmitScreenShareUpdated = (payload: {
  serverId: string;
  userId: string;
  channelId: string;
  active: boolean;
  occurredAt: string;
}) => Promise<unknown>;

type TeardownScreenShare = (input: {
  userId: string;
  serverId: string;
  channelId: string;
}) => Promise<void>;

type BaseScreenShareCommandInput = {
  presenceRegistry: RuntimePresenceRegistry;
  screenShareRegistry: RuntimeScreenShareRegistry;
  userId: string;
  serverId: string;
  channelId: string;
  emitScreenShareUpdated: EmitScreenShareUpdated;
  teardownScreenShare: TeardownScreenShare;
};

type SetScreenShareActiveCommandInput = BaseScreenShareCommandInput & {
  active: boolean;
};

/**
 * Обновляет server-authoritative состояние демонстрации экрана пользователя.
 */
export async function setScreenShareActiveCommand(
  input: SetScreenShareActiveCommandInput,
): Promise<ScreenShareCommandAck> {
  const currentPresence = requireActivePresence(input);
  const previousState = input.screenShareRegistry.getUserState(input.userId);
  const occurredAt = new Date().toISOString();

  if (input.active) {
    const nextState = input.screenShareRegistry.setState({
      userId: input.userId,
      serverId: currentPresence.serverId,
      channelId: currentPresence.channelId,
    });

    if (
      !previousState ||
      previousState.serverId !== nextState.serverId ||
      previousState.channelId !== nextState.channelId
    ) {
      await input.emitScreenShareUpdated({
        serverId: nextState.serverId,
        userId: nextState.userId,
        channelId: nextState.channelId,
        active: true,
        occurredAt,
      });
    }

    return {
      accepted: true,
      acknowledgedAt: occurredAt,
    };
  }

  await clearActiveScreenShare({
    screenShareRegistry: input.screenShareRegistry,
    userId: input.userId,
    serverId: currentPresence.serverId,
    channelId: currentPresence.channelId,
    emitScreenShareUpdated: input.emitScreenShareUpdated,
    teardownScreenShare: input.teardownScreenShare,
  });

  return {
    accepted: true,
    acknowledgedAt: occurredAt,
  };
}

/**
 * Гарантированно очищает активную демонстрацию пользователя при leave/move/disconnect.
 */
export async function clearActiveScreenShare(input: {
  screenShareRegistry: RuntimeScreenShareRegistry;
  userId: string;
  serverId: string;
  channelId: string;
  emitScreenShareUpdated: EmitScreenShareUpdated;
  teardownScreenShare: TeardownScreenShare;
}): Promise<RuntimeScreenShareState | null> {
  const previousState = input.screenShareRegistry.getUserState(input.userId);

  if (
    !previousState ||
    previousState.serverId !== input.serverId ||
    previousState.channelId !== input.channelId
  ) {
    return null;
  }

  input.screenShareRegistry.clearState(input.userId);
  await input.teardownScreenShare({
    userId: input.userId,
    serverId: input.serverId,
    channelId: input.channelId,
  });

  await input.emitScreenShareUpdated({
    serverId: previousState.serverId,
    userId: previousState.userId,
    channelId: previousState.channelId,
    active: false,
    occurredAt: new Date().toISOString(),
  });

  return previousState;
}

function requireActivePresence(input: {
  presenceRegistry: RuntimePresenceRegistry;
  userId: string;
  serverId: string;
  channelId: string;
}) {
  const currentPresence = input.presenceRegistry.getUserPresence(input.userId);

  if (
    !currentPresence ||
    currentPresence.serverId !== input.serverId ||
    currentPresence.channelId !== input.channelId
  ) {
    throw new Error("Управление демонстрацией экрана доступно только из активного канала.");
  }

  return currentPresence;
}
