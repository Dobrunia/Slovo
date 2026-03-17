export type RuntimePresenceMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  serverId: string;
  channelId: string;
  joinedAt: string;
};

export type RuntimePresenceMutation = {
  current: RuntimePresenceMember;
  previous: RuntimePresenceMember | null;
  currentServerPresence: RuntimePresenceMember[];
  previousServerPresence: RuntimePresenceMember[] | null;
};

export type RuntimePresenceRemoval = {
  previous: RuntimePresenceMember;
  previousServerPresence: RuntimePresenceMember[];
};

type SetRuntimePresenceInput = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  serverId: string;
  channelId: string;
  occurredAt?: string;
};

/**
 * Создает in-memory runtime registry присутствий пользователей в voice-каналах.
 */
export function createRuntimePresenceRegistry() {
  const presenceByUserId = new Map<string, RuntimePresenceMember>();
  const presenceByServerId = new Map<string, Map<string, RuntimePresenceMember>>();

  /**
   * Возвращает текущее presence пользователя или `null`, если он не находится в канале.
   */
  function getUserPresence(userId: string): RuntimePresenceMember | null {
    return presenceByUserId.get(userId) ?? null;
  }

  /**
   * Возвращает актуальный snapshot присутствий внутри конкретного сервера.
   */
  function getServerPresence(serverId: string): RuntimePresenceMember[] {
    const members = presenceByServerId.get(serverId);

    if (!members) {
      return [];
    }

    return Array.from(members.values()).sort((left, right) =>
      left.joinedAt.localeCompare(right.joinedAt),
    );
  }

  /**
   * Помещает пользователя в канал или перемещает его между каналами.
   */
  function setPresence(input: SetRuntimePresenceInput): RuntimePresenceMutation {
    const previous = presenceByUserId.get(input.userId) ?? null;
    const joinedAt =
      previous &&
      previous.serverId === input.serverId &&
      previous.channelId === input.channelId
        ? previous.joinedAt
        : input.occurredAt ?? new Date().toISOString();
    const current: RuntimePresenceMember = {
      userId: input.userId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      serverId: input.serverId,
      channelId: input.channelId,
      joinedAt,
    };

    if (previous) {
      deleteServerPresence(previous.serverId, previous.userId);
    }

    presenceByUserId.set(current.userId, current);
    setServerPresence(current);

    return {
      current,
      previous,
      currentServerPresence: getServerPresence(current.serverId),
      previousServerPresence:
        previous && previous.serverId !== current.serverId
          ? getServerPresence(previous.serverId)
          : null,
    };
  }

  /**
   * Удаляет пользователя из текущего voice-присутствия.
   */
  function clearPresence(userId: string): RuntimePresenceRemoval | null {
    const previous = presenceByUserId.get(userId);

    if (!previous) {
      return null;
    }

    presenceByUserId.delete(userId);
    deleteServerPresence(previous.serverId, previous.userId);

    return {
      previous,
      previousServerPresence: getServerPresence(previous.serverId),
    };
  }

  /**
   * Полностью очищает runtime presence registry.
   */
  function reset(): void {
    presenceByUserId.clear();
    presenceByServerId.clear();
  }

  return {
    getUserPresence,
    getServerPresence,
    setPresence,
    clearPresence,
    reset,
  };

  /**
   * Записывает пользователя в snapshot конкретного сервера.
   */
  function setServerPresence(member: RuntimePresenceMember): void {
    const members = presenceByServerId.get(member.serverId) ?? new Map<string, RuntimePresenceMember>();
    members.set(member.userId, member);
    presenceByServerId.set(member.serverId, members);
  }

  /**
   * Удаляет пользователя из snapshot конкретного сервера.
   */
  function deleteServerPresence(serverId: string, userId: string): void {
    const members = presenceByServerId.get(serverId);

    if (!members) {
      return;
    }

    members.delete(userId);

    if (members.size === 0) {
      presenceByServerId.delete(serverId);
    }
  }
}

/**
 * Публичный тип runtime presence registry проекта.
 */
export type RuntimePresenceRegistry = ReturnType<typeof createRuntimePresenceRegistry>;
