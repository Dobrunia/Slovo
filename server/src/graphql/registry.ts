import { buildSchema } from "strictql";
import {
  GRAPHQL_MAX_NESTED_LIST_DEPTH,
  GRAPHQL_MAX_QUERY_COMPLEXITY,
  GRAPHQL_MAX_QUERY_DEPTH,
} from "../config/constants.js";
import { createServerMutation } from "./operations/create-server.js";
import { healthQuery } from "./operations/health.js";
import { meQuery } from "./operations/me.js";
import { myServersQuery } from "./operations/my-servers.js";
import { loginMutation } from "./operations/login.js";
import { registerMutation } from "./operations/register.js";
import { serverSnapshotQuery } from "./operations/server-snapshot.js";

/**
 * Реестр read-операций текущего GraphQL foundation.
 */
export const queries = [healthQuery, meQuery, myServersQuery, serverSnapshotQuery];

/**
 * Реестр write-операций, который будет расширяться следующими задачами.
 */
export const mutations = [registerMutation, loginMutation, createServerMutation];

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
