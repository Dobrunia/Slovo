import type { MediaSignalingBridge } from "../media/signaling-bridge.js";
import type { RuntimePresenceRegistry } from "./presence.js";
import { clearActiveScreenShare } from "./screen-share-commands.js";
import type { RuntimeScreenShareRegistry } from "./screen-share.js";
import type { RuntimeVoiceStateRegistry } from "./voice-state.js";

/**
 * Параметры принудительного отключения пользователя из активного voice-канала сервера.
 */
export interface ForceDisconnectRealtimeUserInput {
  userId: string;
  serverId: string;
  reason: string;
  presenceRegistry: RuntimePresenceRegistry;
  voiceStateRegistry: RuntimeVoiceStateRegistry;
  screenShareRegistry: RuntimeScreenShareRegistry;
  mediaSignalingBridge: MediaSignalingBridge;
  emitPresenceUpdated(payload: {
    serverId: string;
    member: {
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      channelId: string;
      joinedAt: string;
    };
    previousChannelId: string | null;
    action: "left";
    occurredAt: string;
  }): Promise<unknown> | unknown;
  emitScreenShareUpdated(payload: {
    serverId: string;
    userId: string;
    channelId: string;
    active: boolean;
    occurredAt: string;
  }): Promise<unknown> | unknown;
  emitForcedDisconnect(payload: {
    serverId: string;
    userId: string;
    reason: string;
    occurredAt: string;
  }): Promise<unknown> | unknown;
}

/**
 * Принудительно выкидывает пользователя из активного voice presence конкретного сервера
 * и гарантированно teardown-ит screen share, media session и локальное voice state.
 */
export async function forceDisconnectRealtimeUser(
  input: ForceDisconnectRealtimeUserInput,
): Promise<boolean> {
  const currentPresence = input.presenceRegistry.getUserPresence(input.userId);

  if (!currentPresence || currentPresence.serverId !== input.serverId) {
    return false;
  }

  await clearActiveScreenShare({
    screenShareRegistry: input.screenShareRegistry,
    userId: input.userId,
    serverId: currentPresence.serverId,
    channelId: currentPresence.channelId,
    teardownScreenShare: (payload) => input.mediaSignalingBridge.teardownUserScreenShare(payload),
    emitScreenShareUpdated: (payload) => Promise.resolve(input.emitScreenShareUpdated(payload)),
  });

  await input.mediaSignalingBridge.teardownUserSession({
    userId: input.userId,
    serverId: currentPresence.serverId,
    channelId: currentPresence.channelId,
  });
  input.voiceStateRegistry.clearState(input.userId);

  const removalResult = input.presenceRegistry.clearPresence(input.userId);
  const occurredAt = new Date().toISOString();

  if (removalResult) {
    await input.emitPresenceUpdated({
      serverId: removalResult.previous.serverId,
      member: {
        userId: removalResult.previous.userId,
        displayName: removalResult.previous.displayName,
        avatarUrl: removalResult.previous.avatarUrl,
        channelId: removalResult.previous.channelId,
        joinedAt: removalResult.previous.joinedAt,
      },
      previousChannelId: removalResult.previous.channelId,
      action: "left",
      occurredAt,
    });
  }

  await Promise.resolve(input.emitForcedDisconnect({
    serverId: currentPresence.serverId,
    userId: input.userId,
    reason: input.reason,
    occurredAt,
  }));

  return true;
}
