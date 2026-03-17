import { buildSchema } from 'strictql';
import {
  GRAPHQL_MAX_NESTED_LIST_DEPTH,
  GRAPHQL_MAX_QUERY_COMPLEXITY,
  GRAPHQL_MAX_QUERY_DEPTH,
} from '../config/constants.js';
import { createServerMutation } from './operations/create-server.js';
import { healthQuery } from './operations/health.js';
import { meQuery } from './operations/me.js';
import { myServersQuery } from './operations/my-servers.js';
import { loginMutation } from './operations/login.js';
import { joinServerMutation } from './operations/join-server.js';
import { registerMutation } from './operations/register.js';
import { searchPublicServersQuery } from './operations/search-public-servers.js';
import { serverSnapshotQuery } from './operations/server-snapshot.js';
import { serverInviteLinkQuery } from './operations/server-invite-link.js';
import { updateAvatarMutation } from './operations/update-avatar.js';
import { updateDisplayNameMutation } from './operations/update-display-name.js';
import { regenerateServerInviteLinkMutation } from './operations/regenerate-server-invite-link.js';

/**
 * Реестр read-операций текущего GraphQL foundation.
 */
export const queries = [
  healthQuery,
  meQuery,
  myServersQuery,
  searchPublicServersQuery,
  serverSnapshotQuery,
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
  updateDisplayNameMutation,
  updateAvatarMutation,
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
