/**
 * Имена realtime-каналов проекта.
 * Этот файл остается нейтральным: без зависимостей на LiveRail, Zod или runtime конкретного пакета.
 */
export const REALTIME_CHANNEL_NAMES = {
  serverStructure: "server.structure",
  serverPresence: "server.presence",
  userProfile: "user.profile",
  voiceSession: "voice.session",
  voiceSignaling: "voice.signaling",
} as const;

/**
 * Имена realtime-событий проекта.
 */
export const REALTIME_EVENT_NAMES = {
  profileUpdated: "profile.updated",
  userServersUpdated: "user-servers.updated",
  serverUpdated: "server.updated",
  channelsUpdated: "channels.updated",
  presenceUpdated: "presence.updated",
  voiceStateUpdated: "voice-state.updated",
  screenShareUpdated: "screen-share.updated",
  forcedDisconnect: "forced-disconnect",
} as const;

/**
 * Имена realtime-команд проекта.
 */
export const REALTIME_COMMAND_NAMES = {
  joinVoiceChannel: "voice.join-channel",
  leaveVoiceChannel: "voice.leave-channel",
  moveVoiceChannel: "voice.move-channel",
  setSelfMute: "voice.set-self-mute",
  setSelfDeafen: "voice.set-self-deafen",
  setScreenShareActive: "voice.set-screen-share-active",
  signalVoiceSession: "voice.signal-session",
} as const;

/**
 * Имена app-side Socket.IO-событий для подписки на runtime-каналы.
 */
export const SOCKET_RUNTIME_EVENT_NAMES = {
  subscribeServerStructure: "runtime.subscribe-server-structure",
  unsubscribeServerStructure: "runtime.unsubscribe-server-structure",
  subscribeServerPresence: "runtime.subscribe-server-presence",
  unsubscribeServerPresence: "runtime.unsubscribe-server-presence",
} as const;

/**
 * Строит имя Socket.IO-room для live-структуры конкретного сервера.
 */
export function buildServerStructureRoom(serverId: string): string {
  return `${REALTIME_CHANNEL_NAMES.serverStructure}:${serverId}`;
}

/**
 * Строит имя Socket.IO-room для runtime presence конкретного сервера.
 */
export function buildServerPresenceRoom(serverId: string): string {
  return `${REALTIME_CHANNEL_NAMES.serverPresence}:${serverId}`;
}

/**
 * Возвращает детерминированный каталог имен realtime-контрактов.
 */
export function describeRealtimeContracts() {
  return {
    channels: Object.values(REALTIME_CHANNEL_NAMES),
    events: Object.values(REALTIME_EVENT_NAMES),
    commands: Object.values(REALTIME_COMMAND_NAMES),
  };
}
