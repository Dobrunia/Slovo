import { z } from "zod";
import {
  channel,
  command,
  createContractRegistry,
  event,
} from "dobrunia-liverail-contracts";
import {
  createSlovoRealtimeContractDefinitions,
  REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH,
  REALTIME_SIGNAL_TYPE_MAX_LENGTH,
} from "../../../shared/realtime/contracts";

export {
  REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH,
  REALTIME_SIGNAL_TYPE_MAX_LENGTH,
};

const realtimeNames = createSlovoRealtimeContractDefinitions();

const serverIdSchema = z.string().min(1);
const channelIdSchema = z.string().min(1);
const userIdSchema = z.string().min(1);
const occurredAtSchema = z.string().min(1);
const updatedAtSchema = z.string().min(1);
const avatarUrlSchema = z.string().url().nullable();
const nullableUserIdSchema = z.string().min(1).nullable();
const signalTypeSchema = z.string().min(1).max(REALTIME_SIGNAL_TYPE_MAX_LENGTH);
const payloadJsonSchema = z
  .string()
  .min(1)
  .max(REALTIME_SIGNAL_PAYLOAD_JSON_MAX_LENGTH);
const connectionQualitySchema = z.enum(["low", "med", "good"]).nullable();

const serverMembershipRoleSchema = z.enum(["OWNER", "MEMBER"]);
const userServersActionSchema = z.enum(["created", "joined", "deleted"]);
const presenceActionSchema = z.enum(["joined", "left", "moved"]);

const voiceChannelSchema = z.object({
  id: channelIdSchema,
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

const runtimePresenceMemberSchema = z.object({
  userId: userIdSchema,
  displayName: z.string().min(1),
  avatarUrl: avatarUrlSchema,
  channelId: channelIdSchema,
  joinedAt: occurredAtSchema,
});

const commandAckSchema = z.object({
  accepted: z.literal(true),
  acknowledgedAt: occurredAtSchema,
});

export const realtimeChannels: ReturnType<typeof channel>[] = [
  channel(realtimeNames.channels.serverStructure, {
    key: z.object({
      serverId: serverIdSchema,
    }),
  }),
  channel(realtimeNames.channels.serverPresence, {
    key: z.object({
      serverId: serverIdSchema,
    }),
  }),
  channel(realtimeNames.channels.userProfile, {
    key: z.object({
      userId: userIdSchema,
    }),
  }),
  channel(realtimeNames.channels.voiceSession, {
    key: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
    }),
  }),
  channel(realtimeNames.channels.voiceSignaling, {
    key: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
    }),
  }),
];

export const realtimeCommands: ReturnType<typeof command>[] = [
  command(realtimeNames.commands.joinVoiceChannel, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.leaveVoiceChannel, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.moveVoiceChannel, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      targetChannelId: channelIdSchema,
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.setSelfMute, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      muted: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.setSelfDeafen, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      deafened: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.setScreenShareActive, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      active: z.boolean(),
    }),
    ack: commandAckSchema,
  }),
  command(realtimeNames.commands.signalVoiceSession, {
    input: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      targetUserId: nullableUserIdSchema,
      signalType: signalTypeSchema,
      payloadJson: payloadJsonSchema,
    }),
    ack: commandAckSchema,
  }),
];

export const realtimeEvents = [
  event(realtimeNames.events.serverUpdated, {
    payload: z.object({
      serverId: serverIdSchema,
      name: z.string().min(1),
      avatarUrl: avatarUrlSchema,
      isPublic: z.boolean(),
      updatedAt: updatedAtSchema,
    }),
  }),
  event(realtimeNames.events.channelsUpdated, {
    payload: z.object({
      serverId: serverIdSchema,
      channels: z.array(voiceChannelSchema),
      updatedAt: updatedAtSchema,
    }),
  }),
  event(realtimeNames.events.presenceUpdated, {
    payload: z.object({
      serverId: serverIdSchema,
      member: runtimePresenceMemberSchema,
      previousChannelId: channelIdSchema.nullable(),
      action: presenceActionSchema,
      occurredAt: occurredAtSchema,
    }),
  }),
  event(realtimeNames.events.userServersUpdated, {
    payload: z.object({
      userId: userIdSchema,
      serverId: serverIdSchema,
      action: userServersActionSchema,
      occurredAt: occurredAtSchema,
    }),
  }),
  event(realtimeNames.events.profileUpdated, {
    payload: z.object({
      userId: userIdSchema,
      displayName: z.string().min(1),
      avatarUrl: avatarUrlSchema,
      updatedAt: updatedAtSchema,
    }),
  }),
  event(realtimeNames.events.voiceSessionSignaled, {
    payload: z.object({
      serverId: serverIdSchema,
      channelId: channelIdSchema,
      sourceUserId: userIdSchema,
      targetUserId: nullableUserIdSchema,
      signalType: signalTypeSchema,
      payloadJson: payloadJsonSchema,
      occurredAt: occurredAtSchema,
    }),
  }),
  event(realtimeNames.events.voiceStateUpdated, {
    payload: z.object({
      serverId: serverIdSchema,
      userId: userIdSchema,
      channelId: channelIdSchema,
      muted: z.boolean(),
      deafened: z.boolean(),
      speaking: z.boolean().optional(),
      connectionQuality: connectionQualitySchema.optional(),
      occurredAt: occurredAtSchema,
    }),
  }),
  event(realtimeNames.events.screenShareUpdated, {
    payload: z.object({
      serverId: serverIdSchema,
      userId: userIdSchema,
      channelId: channelIdSchema,
      active: z.boolean(),
      occurredAt: occurredAtSchema,
    }),
  }),
  event(realtimeNames.events.forcedDisconnect, {
    payload: z.object({
      serverId: serverIdSchema,
      userId: userIdSchema,
      reason: z.string().min(1),
      occurredAt: occurredAtSchema,
    }),
  }),
] as const;

export const slovoRealtimeRegistry = createContractRegistry({
  channels: realtimeChannels,
  events: realtimeEvents,
  commands: realtimeCommands,
  policies: [],
});
