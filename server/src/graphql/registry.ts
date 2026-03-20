import { buildSchema } from 'strictql';
import {
  GRAPHQL_MAX_NESTED_LIST_DEPTH,
  GRAPHQL_MAX_QUERY_COMPLEXITY,
  GRAPHQL_MAX_QUERY_DEPTH,
} from '../config/constants.js';
import { createServerMutation } from './operations/create-server.js';
import { createVoiceChannelMutation } from './operations/create-voice-channel.js';
import { banServerMemberMutation } from './operations/ban-server-member.js';
import { deleteServerMutation } from './operations/delete-server.js';
import { deleteVoiceChannelMutation } from './operations/delete-voice-channel.js';
import { healthQuery } from './operations/health.js';
import { kickServerMemberMutation } from './operations/kick-server-member.js';
import { meQuery } from './operations/me.js';
import { myServersQuery } from './operations/my-servers.js';
import { loginMutation } from './operations/login.js';
import { joinServerMutation } from './operations/join-server.js';
import { reorderVoiceChannelsMutation } from './operations/reorder-voice-channels.js';
import { registerMutation } from './operations/register.js';
import { searchPublicServersQuery } from './operations/search-public-servers.js';
import { serverMembersQuery } from './operations/server-members.js';
import { serverSnapshotQuery } from './operations/server-snapshot.js';
import { serverPresenceSnapshotQuery } from './operations/server-presence-snapshot.js';
import { serverInviteLinkQuery } from './operations/server-invite-link.js';
import { updateAvatarMutation } from './operations/update-avatar.js';
import { updateDisplayNameMutation } from './operations/update-display-name.js';
import { updateServerMutation } from './operations/update-server.js';
import { updateVoiceChannelMutation } from './operations/update-voice-channel.js';
import { regenerateServerInviteLinkMutation } from './operations/regenerate-server-invite-link.js';

/**
 * Реестр read-операций текущего GraphQL foundation.
 */
export const queries = [
  healthQuery,
  meQuery,
  myServersQuery,
  searchPublicServersQuery,
  serverMembersQuery,
  serverSnapshotQuery,
  serverPresenceSnapshotQuery,
  serverInviteLinkQuery,
];

/**
 * Реестр write-операций, который будет расширяться следующими задачами.
 */
export const mutations = [
  registerMutation,
  loginMutation,
  joinServerMutation,
  createServerMutation,
  kickServerMemberMutation,
  banServerMemberMutation,
  deleteServerMutation,
  createVoiceChannelMutation,
  updateVoiceChannelMutation,
  deleteVoiceChannelMutation,
  reorderVoiceChannelsMutation,
  updateDisplayNameMutation,
  updateAvatarMutation,
  updateServerMutation,
  regenerateServerInviteLinkMutation,
];

/**
 * Единая StrictQL-схема с базовыми лимитами безопасности.
 */
export const strictqlApiSchema = buildSchema({
  strictAccessMode: true,
  maxQueryDepth: GRAPHQL_MAX_QUERY_DEPTH,
  maxQueryComplexity: GRAPHQL_MAX_QUERY_COMPLEXITY,
  maxNestedListDepth: GRAPHQL_MAX_NESTED_LIST_DEPTH,
  queries,
  mutations,
});
