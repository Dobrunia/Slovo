import { z } from "zod";
import {
  channel,
  command,
  createContractRegistry,
  event,
} from "dobrunia-liverail-contracts";
import {
  REALTIME_CHANNEL_NAMES,
  REALTIME_COMMAND_NAMES,
  REALTIME_EVENT_NAMES,
} from "../../../shared/realtime/names";

const serverKeySchema = z.object({
  serverId: z.string().min(1),
});

const userProfileKeySchema = z.object({
  userId: z.string().min(1),
});

const voiceSessionKeySchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
});

const signalingKeySchema = z.object({
  serverId: z.string().min(1),
  channelId: z.string().min(1),
});

const commandAckSchema = z.object({
  accepted: z.boolean(),
  acknowledgedAt: z.string().min(1),
});

const channelSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

const presenceMemberSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
  channelId: z.string().min(1),
  joinedAt: z.string().min(1),
});

/**
 * Типизированные realtime-каналы проекта.
 */
export const realtimeChannels = [
  channel(REALTIME_CHANNEL_NAMES.serverStructure, {
    key: serverKeySchema,
  }),
  channel(REALTIME_CHANNEL_NAMES.serverPresence, {
    key: serverKeySchema,
  }),
  channel(REALTIME_CHANNEL_NAMES.userProfile, {
    key: userProfileKeySchema,
  }),
  channel(REALTIME_CHANNEL_NAMES.voiceSession, {
    key: voiceSessionKeySchema,
  }),
  channel(REALTIME_CHANNEL_NAMES.voiceSignaling, {
    key: signalingKeySchema,
  }),
] as const;

/**
 * Типизированные realtime-события проекта.
 */
export const realtimeEvents = [
  event(REALTIME_EVENT_NAMES.profileUpdated, {
    payload: z.object({
      userId: z.string().min(1),
      displayName: z.string().min(1),
      avatarUrl: z.string().url().nullable(),
      updatedAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.userServersUpdated, {
    payload: z.object({
      userId: z.string().min(1),
      serverId: z.string().min(1),
      action: z.enum(["created", "joined", "deleted"]),
      occurredAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.serverUpdated, {
    payload: z.object({
      serverId: z.string().min(1),
      name: z.string().min(1),
      avatarUrl: z.string().url().nullable(),
      isPublic: z.boolean(),
      updatedAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.channelsUpdated, {
    payload: z.object({
      serverId: z.string().min(1),
      channels: z.array(channelSnapshotSchema),
      updatedAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.presenceUpdated, {
    payload: z.object({
      serverId: z.string().min(1),
      member: presenceMemberSchema,
      previousChannelId: z.string().min(1).nullable(),
      action: z.enum(["joined", "left", "moved"]),
      occurredAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.voiceSessionSignaled, {
    payload: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      sourceUserId: z.string().min(1),
      targetUserId: z.string().min(1).nullable(),
      signalType: z.string().min(1),
      payloadJson: z.string().min(1),
      occurredAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.voiceStateUpdated, {
    payload: z.object({
      serverId: z.string().min(1),
      userId: z.string().min(1),
      channelId: z.string().min(1),
      muted: z.boolean(),
      deafened: z.boolean(),
      occurredAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.screenShareUpdated, {
    payload: z.object({
      serverId: z.string().min(1),
      userId: z.string().min(1),
      channelId: z.string().min(1),
      active: z.boolean(),
      occurredAt: z.string().min(1),
    }),
  }),
  event(REALTIME_EVENT_NAMES.forcedDisconnect, {
    payload: z.object({
      serverId: z.string().min(1),
      userId: z.string().min(1),
      reason: z.string().min(1),
      occurredAt: z.string().min(1),
    }),
  }),
] as const;

/**
 * Типизированные realtime-команды проекта.
 */
export const realtimeCommands = [
  command(REALTIME_COMMAND_NAMES.joinVoiceChannel, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.leaveVoiceChannel, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.moveVoiceChannel, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      targetChannelId: z.string().min(1),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.setSelfMute, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      muted: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.setSelfDeafen, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      deafened: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.setScreenShareActive, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      active: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(REALTIME_COMMAND_NAMES.signalVoiceSession, {
    input: z.object({
      serverId: z.string().min(1),
      channelId: z.string().min(1),
      targetUserId: z.string().min(1).nullable(),
      signalType: z.string().min(1),
      payloadJson: z.string().min(1),
    }),
    ack: commandAckSchema,
  }),
] as const;

/**
 * Единый registry клиентского realtime-слоя.
 */
export const slovoRealtimeRegistry = createContractRegistry({
  channels: realtimeChannels,
  events: realtimeEvents,
  commands: realtimeCommands,
  policies: [],
});
