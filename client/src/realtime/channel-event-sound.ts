import type {
  ClientActiveVoicePresence,
  ClientRuntimeMemberVoiceState,
  ClientRuntimePresenceMember,
  ClientRuntimeScreenShareState,
} from "../types/server";

/**
 * Канальные UI-звуки, которые должны слышать участники одной voice-сессии.
 */
export type ChannelEventSound =
  | "mute-unmute"
  | "start-stream"
  | "stop-stream";

/**
 * Вычисляет, нужно ли воспроизвести звук mute/unmute для участников текущего канала.
 */
export function collectVoiceStateEventSounds(input: {
  currentUserPresence: ClientActiveVoicePresence | null;
  presenceMembers: ClientRuntimePresenceMember[];
  previousVoiceStates: Record<string, ClientRuntimeMemberVoiceState>;
  nextVoiceStates: Record<string, ClientRuntimeMemberVoiceState>;
}): ChannelEventSound[] {
  const { currentUserPresence, presenceMembers, previousVoiceStates, nextVoiceStates } = input;

  if (!currentUserPresence) {
    return [];
  }

  const currentChannelMemberIds = new Set(
    presenceMembers
      .filter((member) => member.channelId === currentUserPresence.channelId)
      .map((member) => member.userId),
  );
  const allUserIds = new Set([
    ...Object.keys(previousVoiceStates),
    ...Object.keys(nextVoiceStates),
  ]);
  const sounds: ChannelEventSound[] = [];

  for (const userId of allUserIds) {
    if (!currentChannelMemberIds.has(userId)) {
      continue;
    }

    const previousVoiceState = previousVoiceStates[userId];
    const nextVoiceState = nextVoiceStates[userId];

    if (!previousVoiceState || !nextVoiceState) {
      continue;
    }

    const previousMicBlocked =
      previousVoiceState.muted || previousVoiceState.deafened;
    const nextMicBlocked = nextVoiceState.muted || nextVoiceState.deafened;

    if (previousMicBlocked !== nextMicBlocked) {
      sounds.push("mute-unmute");
    }
  }

  return sounds;
}

/**
 * Вычисляет, нужно ли воспроизвести звук старта или остановки стрима в текущем канале.
 */
export function collectScreenShareEventSounds(input: {
  currentUserPresence: ClientActiveVoicePresence | null;
  previousScreenShareStates: ClientRuntimeScreenShareState[];
  nextScreenShareStates: ClientRuntimeScreenShareState[];
}): ChannelEventSound[] {
  const { currentUserPresence, previousScreenShareStates, nextScreenShareStates } = input;

  if (!currentUserPresence) {
    return [];
  }

  const isCurrentChannelState = (state: ClientRuntimeScreenShareState): boolean =>
    state.serverId === currentUserPresence.serverId &&
    state.channelId === currentUserPresence.channelId;

  const previousUserIds = new Set(
    previousScreenShareStates.filter(isCurrentChannelState).map((state) => state.userId),
  );
  const nextUserIds = new Set(
    nextScreenShareStates.filter(isCurrentChannelState).map((state) => state.userId),
  );
  const sounds: ChannelEventSound[] = [];

  for (const userId of nextUserIds) {
    if (!previousUserIds.has(userId)) {
      sounds.push("start-stream");
    }
  }

  for (const userId of previousUserIds) {
    if (!nextUserIds.has(userId)) {
      sounds.push("stop-stream");
    }
  }

  return sounds;
}
