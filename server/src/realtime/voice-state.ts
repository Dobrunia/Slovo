export type RuntimeVoiceState = {
  userId: string;
  serverId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
};

type SetRuntimeVoiceStateInput = RuntimeVoiceState;

/**
 * Создает in-memory registry voice state для активных пользователей каналов.
 */
export function createRuntimeVoiceStateRegistry() {
  const stateByUserId = new Map<string, RuntimeVoiceState>();

  /**
   * Возвращает текущее voice state пользователя или `null`.
   */
  function getUserState(userId: string): RuntimeVoiceState | null {
    return stateByUserId.get(userId) ?? null;
  }

  /**
   * Синхронизирует voice state с новым активным presence пользователя.
   * Если состояние уже было, сохраняет текущие mute/deafen-флаги.
   */
  function syncPresence(input: {
    userId: string;
    serverId: string;
    channelId: string;
  }): RuntimeVoiceState {
    const previousState = stateByUserId.get(input.userId);
    const nextState: RuntimeVoiceState = {
      userId: input.userId,
      serverId: input.serverId,
      channelId: input.channelId,
      muted: previousState?.muted ?? false,
      deafened: previousState?.deafened ?? false,
    };

    stateByUserId.set(input.userId, nextState);
    return nextState;
  }

  /**
   * Явно записывает voice state пользователя.
   */
  function setState(input: SetRuntimeVoiceStateInput): RuntimeVoiceState {
    const nextState: RuntimeVoiceState = {
      userId: input.userId,
      serverId: input.serverId,
      channelId: input.channelId,
      muted: input.muted,
      deafened: input.deafened,
    };

    stateByUserId.set(input.userId, nextState);
    return nextState;
  }

  /**
   * Удаляет voice state пользователя при выходе из канала или disconnect.
   */
  function clearState(userId: string): RuntimeVoiceState | null {
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
    syncPresence,
    setState,
    clearState,
    reset,
  };
}

/**
 * Публичный тип runtime voice state registry проекта.
 */
export type RuntimeVoiceStateRegistry = ReturnType<typeof createRuntimeVoiceStateRegistry>;
