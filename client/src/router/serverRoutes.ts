import type { RouteParamsGeneric } from "vue-router";
import { APP_HOME_ROUTE_PATH, SERVER_INVITE_ROUTE_PATH } from "../constants";

/**
 * Имя маршрута защищенного home shell.
 */
export const APP_HOME_ROUTE_NAME = "app-home";

/**
 * Имя маршрута выбранного сервера.
 */
export const APP_SERVER_ROUTE_NAME = "app-server";

/**
 * Имя маршрута выбранного канала внутри сервера.
 */
export const APP_SERVER_CHANNEL_ROUTE_NAME = "app-server-channel";

/**
 * Имя маршрута client-side invite-ссылки сервера.
 */
export const SERVER_INVITE_ROUTE_NAME = "server-invite";

/**
 * URL-шаблон маршрута выбранного сервера.
 */
export const APP_SERVER_ROUTE_PATH = `${APP_HOME_ROUTE_PATH}/servers/:serverId`;

/**
 * URL-шаблон маршрута выбранного канала.
 */
export const APP_SERVER_CHANNEL_ROUTE_PATH =
  `${APP_HOME_ROUTE_PATH}/servers/:serverId/channels/:channelId`;

/**
 * URL-шаблон invite-маршрута сервера.
 */
export const SERVER_INVITE_ROUTE_PATTERN = SERVER_INVITE_ROUTE_PATH;

/**
 * Собирает route location для открытия выбранного сервера.
 */
export function buildAppServerRoute(serverId: string): string {
  const normalizedServerId = encodeURIComponent(serverId);

  return `${APP_HOME_ROUTE_PATH}/servers/${normalizedServerId}`;
}

/**
 * Собирает route location для открытия выбранного канала внутри сервера.
 */
export function buildAppServerChannelRoute(
  serverId: string,
  channelId: string,
): string {
  const normalizedServerId = encodeURIComponent(serverId);
  const normalizedChannelId = encodeURIComponent(channelId);

  return `${APP_HOME_ROUTE_PATH}/servers/${normalizedServerId}/channels/${normalizedChannelId}`;
}

/**
 * Собирает route location для открытия invite-ссылки сервера.
 */
export function buildServerInviteRoute(inviteToken: string): string {
  const normalizedInviteToken = encodeURIComponent(inviteToken);

  return `/invite/${normalizedInviteToken}`;
}

/**
 * Извлекает выбранный `serverId` из params активного маршрута.
 */
export function readSelectedServerIdFromRouteParams(
  params: RouteParamsGeneric,
): string | null {
  const serverId = params.serverId;

  return typeof serverId === "string" && serverId.trim() ? serverId : null;
}

/**
 * Извлекает выбранный `channelId` из params активного маршрута.
 */
export function readSelectedChannelIdFromRouteParams(
  params: RouteParamsGeneric,
): string | null {
  const channelId = params.channelId;

  return typeof channelId === "string" && channelId.trim() ? channelId : null;
}

/**
 * Извлекает `inviteToken` из params активного invite-маршрута.
 */
export function readInviteTokenFromRouteParams(
  params: RouteParamsGeneric,
): string | null {
  const inviteToken = params.inviteToken;

  return typeof inviteToken === "string" && inviteToken.trim() ? inviteToken : null;
}
