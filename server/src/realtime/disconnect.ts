/**
 * Минимальная серверная форма runtime presence, достаточная для cleanup при disconnect.
 */
export interface DisconnectPresenceMember {
  userId: string;
  serverId: string;
  channelId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
}

/**
 * Минимальный контракт presence registry, необходимый для disconnect cleanup.
 */
export interface DisconnectPresenceRegistry {
  getUserPresence(userId: string): DisconnectPresenceMember | null;
  clearPresence(userId: string): unknown | null;
}

/**
 * Параметры disconnect cleanup для realtime runtime presence.
 */
export interface HandleRealtimeDisconnectCleanupInput {
  userId: string;
  presenceRegistry: DisconnectPresenceRegistry;
  emitPresenceUpdated(payload: {
    serverId: string;
    member: DisconnectPresenceMember;
    previousChannelId: string | null;
    action: "left";
    occurredAt: string;
  }): Promise<unknown> | unknown;
}

/**
 * Очищает runtime presence пользователя при потере realtime-соединения
 * и рассылает остальным участникам сервера событие `left`.
 */
export async function handleRealtimeDisconnectCleanup(
  input: HandleRealtimeDisconnectCleanupInput,
): Promise<boolean> {
  const previousPresence = input.presenceRegistry.getUserPresence(input.userId);

  if (!previousPresence) {
    return false;
  }

  const removalResult = input.presenceRegistry.clearPresence(input.userId);

  if (!removalResult) {
    return false;
  }

  await input.emitPresenceUpdated({
    serverId: previousPresence.serverId,
    member: previousPresence,
    previousChannelId: previousPresence.channelId,
    action: "left",
    occurredAt: new Date().toISOString(),
  });

  return true;
}
