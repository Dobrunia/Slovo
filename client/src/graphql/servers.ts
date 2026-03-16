import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type { ClientServerListItem } from "../types/server";
import type { GraphqlResponse } from "../types/graphql";

const MY_SERVERS_QUERY = `
  query {
    myServers(input: {}) {
      id
      name
      avatarUrl
      isPublic
      role
    }
  }
`;

type FetchImplementation = typeof fetch;

/**
 * Опции создания GraphQL-клиента списка серверов.
 */
export interface CreateServersApiClientOptions {
  graphqlUrl?: string;
  fetchImplementation?: FetchImplementation;
}

/**
 * Контракт GraphQL-клиента для чтения списка серверов пользователя.
 */
export interface ServersApiClient {
  myServers(sessionToken: string): Promise<ClientServerListItem[]>;
}

/**
 * Создает GraphQL-клиент для чтения серверов текущего пользователя.
 */
export function createServersApiClient(
  options: CreateServersApiClientOptions = {},
): ServersApiClient {
  const graphqlUrl = options.graphqlUrl ?? DEFAULT_CLIENT_GRAPHQL_URL;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  return {
    async myServers(sessionToken) {
      const response = await fetchImplementation(graphqlUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `${AUTHORIZATION_BEARER_PREFIX}${sessionToken}`,
          [SESSION_TOKEN_HEADER]: sessionToken,
        },
        body: JSON.stringify({
          query: MY_SERVERS_QUERY,
        }),
      });

      const result = (await response.json()) as GraphqlResponse<{
        myServers: ClientServerListItem[];
      }>;
      const graphqlMessage = result.errors?.[0]?.message;

      if (!response.ok) {
        throw new Error(graphqlMessage ?? `GraphQL request failed with status ${response.status}.`);
      }

      if (graphqlMessage) {
        throw new Error(graphqlMessage);
      }

      if (!result.data) {
        throw new Error("GraphQL response does not contain data.");
      }

      return result.data.myServers;
    },
  };
}
