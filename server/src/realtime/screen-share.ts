export type RuntimeScreenShareState = {
  userId: string;
  serverId: string;
  channelId: string;
};

type SetRuntimeScreenShareStateInput = RuntimeScreenShareState;

/**
 * Создает in-memory registry активных демонстраций экрана.
 */
export function createRuntimeScreenShareRegistry() {
  const stateByUserId = new Map<string, RuntimeScreenShareState>();

  /**
   * Возвращает активную демонстрацию пользователя или `null`.
   */
  function getUserState(userId: string): RuntimeScreenShareState | null {
    return stateByUserId.get(userId) ?? null;
  }

  /**
   * Активирует демонстрацию пользователя в конкретном канале.
   */
  function setState(input: SetRuntimeScreenShareStateInput): RuntimeScreenShareState {
    const nextState: RuntimeScreenShareState = {
      userId: input.userId,
      serverId: input.serverId,
      channelId: input.channelId,
    };

    stateByUserId.set(input.userId, nextState);
    return nextState;
  }

  /**
   * Убирает активную демонстрацию пользователя.
   */
  function clearState(userId: string): RuntimeScreenShareState | null {
    const previousState = stateByUserId.get(userId) ?? null;

    if (!previousState) {
      return null;
    }

    stateByUserId.delete(userId);
    return previousState;
  }

  /**
   * Полностью очищает registry.
   */
  function reset(): void {
    stateByUserId.clear();
  }

  return {
    getUserState,
    setState,
    clearState,
    reset,
  };
}

/**
 * Публичный тип runtime screen-share registry проекта.
 */
export type RuntimeScreenShareRegistry = ReturnType<typeof createRuntimeScreenShareRegistry>;
