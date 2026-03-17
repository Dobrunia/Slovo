import type { ClientPresenceUpdatedEventPayload } from "../types/server";

/**
 * Звуковые cue, которые может породить realtime-изменение presence.
 */
export type PresenceSoundCue = "join" | "leave" | null;

type ResolvePresenceSoundCueInput = {
  payload: ClientPresenceUpdatedEventPayload;
  currentUserId: string | null;
  currentUserChannelId: string | null;
};

/**
 * Вычисляет, должен ли текущий клиент услышать join/leave звук для live-события presence.
 */
export function resolvePresenceSoundCue(
  input: ResolvePresenceSoundCueInput,
): PresenceSoundCue {
  if (!input.currentUserId) {
    return null;
  }

  const isCurrentUserEvent = input.payload.member.userId === input.currentUserId;

  if (isCurrentUserEvent) {
    if (input.payload.action === "joined") {
      return "join";
    }

    if (input.payload.action === "left") {
      return "leave";
    }

    if (input.payload.action === "moved") {
      return "join";
    }

    return null;
  }

  if (!input.currentUserChannelId) {
    return null;
  }

  if (input.payload.action === "joined") {
    return input.payload.member.channelId === input.currentUserChannelId ? "join" : null;
  }

  if (input.payload.action === "left") {
    return input.payload.previousChannelId === input.currentUserChannelId ? "leave" : null;
  }

  if (input.payload.previousChannelId === input.currentUserChannelId) {
    return "leave";
  }

  if (input.payload.member.channelId === input.currentUserChannelId) {
    return "join";
  }

  return null;
}
