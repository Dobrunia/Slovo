import type {
  ClientChannelsUpdatedEventPayload,
  ClientPresenceUpdatedEventPayload,
  ClientServerUpdatedEventPayload,
} from "../types/server";
import {
  subscribeToServerPresence,
  subscribeToServerStructure,
} from "./runtime";

type ServerLiveStateSubscriptionInput = {
  sessionToken: string;
  serverId: string;
  onServerUpdated: (payload: ClientServerUpdatedEventPayload) => void;
  onChannelsUpdated: (payload: ClientChannelsUpdatedEventPayload) => void;
  onPresenceUpdated: (payload: ClientPresenceUpdatedEventPayload) => void;
};

/**
 * Поднимает весь live-контур выбранного сервера: структуру и runtime presence.
 */
export async function subscribeToServerLiveState(
  input: ServerLiveStateSubscriptionInput,
): Promise<() => Promise<void>> {
  const stopStructure = await subscribeToServerStructure({
    sessionToken: input.sessionToken,
    serverId: input.serverId,
    onServerUpdated: input.onServerUpdated,
    onChannelsUpdated: input.onChannelsUpdated,
  });
  const stopPresence = await subscribeToServerPresence({
    sessionToken: input.sessionToken,
    serverId: input.serverId,
    onPresenceUpdated: input.onPresenceUpdated,
  });

  return async () => {
    await stopPresence();
    await stopStructure();
  };
}
