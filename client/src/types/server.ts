/**
 * Роль пользователя внутри сервера.
 */
export type ServerMembershipRole = "OWNER" | "MEMBER";

/**
 * Краткая клиентская форма сервера для списков и навигации.
 */
export interface ClientServerListItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isPublic: boolean;
  role: ServerMembershipRole;
}

/**
 * Краткая клиентская форма публичного сервера для discovery-списков.
 */
export interface ClientPublicServerDiscoveryItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isPublic: true;
}

/**
 * Входные данные для создания нового сервера на клиенте.
 */
export interface ClientCreateServerInput {
  name: string;
}

/**
 * Результат успешного создания сервера через GraphQL.
 */
export interface ClientCreateServerResult {
  server: ClientServerListItem;
}

/**
 * Входные данные для вступления пользователя в сервер.
 */
export interface ClientJoinServerInput {
  serverId?: string;
  inviteToken?: string;
}

/**
 * Результат успешного вступления пользователя в сервер.
 */
export interface ClientJoinServerResult {
  server: ClientServerListItem;
}

/**
 * Краткая клиентская форма голосового канала сервера.
 */
export interface ClientVoiceChannel {
  id: string;
  name: string;
  sortOrder: number;
}

/**
 * Initial snapshot выбранного сервера для client-side модуля сервера.
 */
export interface ClientServerSnapshot {
  server: ClientServerListItem;
  channels: ClientVoiceChannel[];
}

/**
 * Публичный payload структуры каналов сервера после channel CRUD-операции.
 */
export interface ClientServerChannelsPayload {
  channels: ClientVoiceChannel[];
}

/**
 * Входные данные для создания voice-канала.
 */
export interface ClientCreateVoiceChannelInput {
  serverId: string;
  name: string;
}

/**
 * Входные данные для переименования voice-канала.
 */
export interface ClientUpdateVoiceChannelInput {
  serverId: string;
  channelId: string;
  name: string;
}

/**
 * Входные данные для удаления voice-канала.
 */
export interface ClientDeleteVoiceChannelInput {
  serverId: string;
  channelId: string;
}

/**
 * Входные данные для перестановки voice-каналов.
 */
export interface ClientReorderVoiceChannelsInput {
  serverId: string;
  channelIds: string[];
}

/**
 * Входные данные для обновления названия и аватара сервера.
 */
export interface ClientUpdateServerInput {
  name: string;
  avatarUrl: string | null;
}

/**
 * Результат успешного обновления сервера через GraphQL.
 */
export interface ClientUpdateServerResult {
  server: ClientServerListItem;
}

/**
 * Invite-ссылка текущего сервера для настроек и direct invite flow.
 */
export interface ClientServerInviteLink {
  serverId: string;
  inviteLink: string;
}

/**
 * Результат успешного удаления сервера.
 */
export interface ClientDeleteServerResult {
  serverId: string;
}

/**
 * Live-payload обновления метаданных сервера.
 */
export interface ClientServerUpdatedEventPayload {
  serverId: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
  updatedAt: string;
}

/**
 * Live-payload изменения доступности сервера для конкретного пользователя.
 */
export interface ClientUserServersUpdatedEventPayload {
  userId: string;
  serverId: string;
  action: "created" | "joined" | "deleted";
  occurredAt: string;
}

/**
 * Live-payload обновления структуры каналов сервера.
 */
export interface ClientChannelsUpdatedEventPayload {
  serverId: string;
  channels: ClientVoiceChannel[];
  updatedAt: string;
}

/**
 * Runtime-форма участника голосового канала на клиенте.
 */
export interface ClientRuntimePresenceMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  channelId: string;
  joinedAt: string;
}

/**
 * Глобальное клиентское присутствие текущего пользователя в голосовом канале.
 */
export interface ClientActiveVoicePresence extends ClientRuntimePresenceMember {
  serverId: string;
}

/**
 * Live-payload изменения presence внутри сервера.
 */
export interface ClientPresenceUpdatedEventPayload {
  serverId: string;
  member: ClientRuntimePresenceMember;
  previousChannelId: string | null;
  action: "joined" | "left" | "moved";
  occurredAt: string;
}

/**
 * Initial snapshot runtime presence выбранного сервера.
 */
export interface ClientServerPresenceSnapshot {
  members: ClientRuntimePresenceMember[];
}

/**
 * Публичная форма участника сервера для owner-only moderation UI.
 */
export interface ClientServerMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ServerMembershipRole;
}

/**
 * Snapshot участников сервера для owner-only moderation UI.
 */
export interface ClientServerMembersSnapshot {
  serverId: string;
  members: ClientServerMember[];
}

/**
 * Live-payload signaling-события voice session.
 */
export interface ClientVoiceSessionSignaledEventPayload {
  serverId: string;
  channelId: string;
  sourceUserId: string;
  targetUserId: string | null;
  signalType: string;
  payloadJson: string;
  occurredAt: string;
}

/**
 * Live-payload изменения voice state внутри канала.
 */
export interface ClientVoiceStateUpdatedEventPayload {
  serverId: string;
  userId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  occurredAt: string;
}

/**
 * Локальное voice state текущего пользователя.
 */
export interface ClientCurrentVoiceState {
  muted: boolean;
  deafened: boolean;
}

/**
 * Runtime-форма активной демонстрации экрана внутри канала.
 */
export interface ClientRuntimeScreenShareState {
  userId: string;
  serverId: string;
  channelId: string;
}

/**
 * Live-payload изменения состояния демонстрации экрана.
 */
export interface ClientScreenShareUpdatedEventPayload {
  serverId: string;
  userId: string;
  channelId: string;
  active: boolean;
  occurredAt: string;
}

/**
 * Live-payload принудительного disconnect пользователя из active voice presence.
 */
export interface ClientForcedDisconnectEventPayload {
  serverId: string;
  userId: string;
  reason: string;
  occurredAt: string;
}

/**
 * Результат успешного moderation-действия над участником сервера.
 */
export interface ClientModerationResult {
  serverId: string;
  userId: string;
}

/**
 * Локально доступный screen-share stream текущей voice session.
 */
export interface ClientVoiceScreenShareStream {
  userId: string;
  stream: MediaStream;
  isCurrentUser: boolean;
}

/**
 * Область realtime runtime-ошибки на клиенте.
 */
export type ClientRealtimeRuntimeErrorScope =
  | "transport"
  | "subscription"
  | "command"
  | "media-playback";

/**
 * Структурированная realtime-ошибка для app-side recovery и UI.
 */
export interface ClientRealtimeRuntimeError {
  scope: ClientRealtimeRuntimeErrorScope;
  message: string;
  recoverable: boolean;
  occurredAt: string;
}
