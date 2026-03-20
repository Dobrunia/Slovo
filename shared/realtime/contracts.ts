import {
  REALTIME_CHANNEL_NAMES,
  REALTIME_COMMAND_NAMES,
  REALTIME_EVENT_NAMES,
} from "./names.js";

/**
 * Максимальная длина типа signaling-сообщения realtime-voice session.
 */
export const REALTIME_SIGNAL_TYPE_MAX_LENGTH = 120;

/**
 * Максимальная длина JSON-payload signaling-сообщения realtime-voice session.
 */
export const REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH = 200_000;

/**
 * Канонические имена realtime-каналов проекта.
 */
export type SlovoRealtimeChannelNames = {
  serverStructure: typeof REALTIME_CHANNEL_NAMES.serverStructure;
  serverPresence: typeof REALTIME_CHANNEL_NAMES.serverPresence;
  userProfile: typeof REALTIME_CHANNEL_NAMES.userProfile;
  voiceSession: typeof REALTIME_CHANNEL_NAMES.voiceSession;
  voiceSignaling: typeof REALTIME_CHANNEL_NAMES.voiceSignaling;
};

/**
 * Канонические имена realtime-команд проекта.
 */
export type SlovoRealtimeCommandNames = {
  joinVoiceChannel: typeof REALTIME_COMMAND_NAMES.joinVoiceChannel;
  leaveVoiceChannel: typeof REALTIME_COMMAND_NAMES.leaveVoiceChannel;
  moveVoiceChannel: typeof REALTIME_COMMAND_NAMES.moveVoiceChannel;
  setSelfMute: typeof REALTIME_COMMAND_NAMES.setSelfMute;
  setSelfDeafen: typeof REALTIME_COMMAND_NAMES.setSelfDeafen;
  setScreenShareActive: typeof REALTIME_COMMAND_NAMES.setScreenShareActive;
  signalVoiceSession: typeof REALTIME_COMMAND_NAMES.signalVoiceSession;
};

/**
 * Канонические имена realtime-событий проекта.
 */
export type SlovoRealtimeEventNames = {
  serverUpdated: typeof REALTIME_EVENT_NAMES.serverUpdated;
  channelsUpdated: typeof REALTIME_EVENT_NAMES.channelsUpdated;
  presenceUpdated: typeof REALTIME_EVENT_NAMES.presenceUpdated;
  userServersUpdated: typeof REALTIME_EVENT_NAMES.userServersUpdated;
  profileUpdated: typeof REALTIME_EVENT_NAMES.profileUpdated;
  voiceSessionSignaled: typeof REALTIME_EVENT_NAMES.voiceSessionSignaled;
  voiceStateUpdated: typeof REALTIME_EVENT_NAMES.voiceStateUpdated;
  screenShareUpdated: typeof REALTIME_EVENT_NAMES.screenShareUpdated;
  forcedDisconnect: typeof REALTIME_EVENT_NAMES.forcedDisconnect;
};

/**
 * Плоский shared source of truth для realtime names, от которого локальные
 * client/server wrappers собирают уже конкретные Zod/LiveRail contracts.
 */
export type SlovoRealtimeContractDefinitions = {
  channels: SlovoRealtimeChannelNames;
  commands: SlovoRealtimeCommandNames;
  events: SlovoRealtimeEventNames;
};

/**
 * Возвращает канонические realtime definitions проекта без привязки к package-local
 * runtime-зависимостям. Локальные wrappers поверх этого объекта создают реальные
 * contract registry с точными типами для client и server.
 */
export function createSlovoRealtimeContractDefinitions(): SlovoRealtimeContractDefinitions {
  return {
    channels: {
      serverStructure: REALTIME_CHANNEL_NAMES.serverStructure,
      serverPresence: REALTIME_CHANNEL_NAMES.serverPresence,
      userProfile: REALTIME_CHANNEL_NAMES.userProfile,
      voiceSession: REALTIME_CHANNEL_NAMES.voiceSession,
      voiceSignaling: REALTIME_CHANNEL_NAMES.voiceSignaling,
    },
    commands: {
      joinVoiceChannel: REALTIME_COMMAND_NAMES.joinVoiceChannel,
      leaveVoiceChannel: REALTIME_COMMAND_NAMES.leaveVoiceChannel,
      moveVoiceChannel: REALTIME_COMMAND_NAMES.moveVoiceChannel,
      setSelfMute: REALTIME_COMMAND_NAMES.setSelfMute,
      setSelfDeafen: REALTIME_COMMAND_NAMES.setSelfDeafen,
      setScreenShareActive: REALTIME_COMMAND_NAMES.setScreenShareActive,
      signalVoiceSession: REALTIME_COMMAND_NAMES.signalVoiceSession,
    },
    events: {
      serverUpdated: REALTIME_EVENT_NAMES.serverUpdated,
      channelsUpdated: REALTIME_EVENT_NAMES.channelsUpdated,
      presenceUpdated: REALTIME_EVENT_NAMES.presenceUpdated,
      userServersUpdated: REALTIME_EVENT_NAMES.userServersUpdated,
      profileUpdated: REALTIME_EVENT_NAMES.profileUpdated,
      voiceSessionSignaled: REALTIME_EVENT_NAMES.voiceSessionSignaled,
      voiceStateUpdated: REALTIME_EVENT_NAMES.voiceStateUpdated,
      screenShareUpdated: REALTIME_EVENT_NAMES.screenShareUpdated,
      forcedDisconnect: REALTIME_EVENT_NAMES.forcedDisconnect,
    },
  };
}
