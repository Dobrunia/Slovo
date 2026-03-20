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
  connectionId: string;
}

/**
 * Минимальный контракт presence registry, необходимый для disconnect cleanup.
 */
export interface DisconnectPresenceRegistry {
  getUserPresenceRecord(userId: string): DisconnectPresenceMember | null;
  clearPresenceForConnection(input: {
    userId: string;
    connectionId: string;
  }): unknown | null;
}

/**
 * Параметры disconnect cleanup для realtime runtime presence.
 */
export interface HandleRealtimeDisconnectCleanupInput {
  userId: string;
  connectionId: string;
  presenceRegistry: DisconnectPresenceRegistry;
  emitPresenceUpdated(payload: {
    serverId: string;
    member: Omit<DisconnectPresenceMember, "connectionId">;
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
  const previousPresence = input.presenceRegistry.getUserPresenceRecord(input.userId);

  if (!previousPresence || previousPresence.connectionId !== input.connectionId) {
    return false;
  }

  const removalResult = input.presenceRegistry.clearPresenceForConnection({
    userId: input.userId,
    connectionId: input.connectionId,
  });

  if (!removalResult) {
    return false;
  }

  await input.emitPresenceUpdated({
    serverId: previousPresence.serverId,
    member: {
      userId: previousPresence.userId,
      displayName: previousPresence.displayName,
      avatarUrl: previousPresence.avatarUrl,
      channelId: previousPresence.channelId,
      joinedAt: previousPresence.joinedAt,
      serverId: previousPresence.serverId,
    },
    previousChannelId: previousPresence.channelId,
    action: "left",
    occurredAt: new Date().toISOString(),
  });

  return true;
}
