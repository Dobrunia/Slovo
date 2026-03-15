import { buildSchema } from "strictql";
import { healthQuery } from "./operations/health.js";

/**
 * Реестр read-операций текущего GraphQL foundation.
 */
export const queries = [healthQuery];

/**
 * Реестр write-операций, который будет расширяться следующими задачами.
 */
export const mutations: [] = [];

/**
 * Единая StrictQL-схема с базовыми лимитами безопасности.
 */
export const strictqlApiSchema = buildSchema({
  strictAccessMode: true,
  maxQueryDepth: 6,
  maxQueryComplexity: 50,
  maxNestedListDepth: 2,
  queries,
  mutations,
});
