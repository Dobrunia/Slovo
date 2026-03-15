import {
  DEFAULT_CLIENT_GRAPHQL_URL,
  DEFAULT_CLIENT_REALTIME_URL,
} from "../constants";

/**
 * Возвращает актуальные клиентские endpoint-ы с учетом env и стандартных значений.
 */
export function useClientEndpoints() {
  return {
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || DEFAULT_CLIENT_GRAPHQL_URL,
    realtimeUrl: import.meta.env.VITE_REALTIME_URL || DEFAULT_CLIENT_REALTIME_URL,
  };
}
