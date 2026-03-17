import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type {
  ClientCreateServerInput,
  ClientCreateServerResult,
  ClientJoinServerInput,
  ClientJoinServerResult,
  ClientPublicServerDiscoveryItem,
  ClientServerListItem,
} from "../types/server";

type FetchImplementation = typeof fetch;

type GraphqlError = {
  message: string;
};

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: GraphqlError[];
};

const SERVER_FIELDS = `
  id
  name
  avatarUrl
  isPublic
  role
`;

const MY_SERVERS_QUERY = `
  query {
    myServers(input: {}) {
      ${SERVER_FIELDS}
    }
  }
`;

/**
 * Опции создания GraphQL-клиента серверов.
 */
export interface CreateServersApiClientOptions {
  graphqlUrl?: string;
  fetchImplementation?: FetchImplementation;
}

/**
 * Контракт GraphQL-клиента серверов текущего пользователя.
 */
export interface ServersApiClient {
  myServers(sessionToken: string): Promise<ClientServerListItem[]>;
  searchPublicServers(
    sessionToken: string,
    query: string,
  ): Promise<ClientPublicServerDiscoveryItem[]>;
  joinServer(
    sessionToken: string,
    input: ClientJoinServerInput,
  ): Promise<ClientJoinServerResult>;
  createServer(
    sessionToken: string,
    input: ClientCreateServerInput,
  ): Promise<ClientCreateServerResult>;
}

/**
 * Создает GraphQL-клиент для запросов списка серверов и создания нового сервера.
 */
export function createServersApiClient(
  options: CreateServersApiClientOptions = {},
): ServersApiClient {
  const graphqlUrl = options.graphqlUrl ?? DEFAULT_CLIENT_GRAPHQL_URL;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  async function request<TData>(query: string, sessionToken: string): Promise<TData> {
    const response = await fetchImplementation(graphqlUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `${AUTHORIZATION_BEARER_PREFIX}${sessionToken}`,
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      body: JSON.stringify({
        query,
      }),
    });

    const result = (await response.json()) as GraphqlResponse<TData>;
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

    return result.data;
  }

  return {
    async myServers(sessionToken) {
      const data = await request<{ myServers: ClientServerListItem[] }>(
        MY_SERVERS_QUERY,
        sessionToken,
      );

      return data.myServers;
    },

    async searchPublicServers(sessionToken, query) {
      const data = await request<{ searchPublicServers: ClientPublicServerDiscoveryItem[] }>(
        buildSearchPublicServersQuery(query),
        sessionToken,
      );

      return data.searchPublicServers;
    },

    async joinServer(sessionToken, input) {
      const data = await request<{ joinServer: ClientJoinServerResult }>(
        buildJoinServerMutation(input),
        sessionToken,
      );

      return data.joinServer;
    },

    async createServer(sessionToken, input) {
      const data = await request<{ createServer: ClientCreateServerResult }>(
        buildCreateServerMutation(input),
        sessionToken,
      );

      return data.createServer;
    },
  };
}

/**
 * Строит GraphQL-мутацию создания сервера в текущем runtime-контракте StrictQL.
 */
function buildCreateServerMutation(input: ClientCreateServerInput): string {
  return `
    mutation {
      createServer(
        input: {
          name: ${toGraphqlString(input.name)}
        }
      ) {
        server {
          ${SERVER_FIELDS}
        }
      }
    }
  `;
}

/**
 * Строит GraphQL-query поиска публичных серверов.
 */
function buildSearchPublicServersQuery(query: string): string {
  return `
    query {
      searchPublicServers(
        input: {
          query: ${toGraphqlString(query)}
        }
      ) {
        id
        name
        avatarUrl
        isPublic
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию вступления в сервер по `serverId` или `inviteToken`.
 */
function buildJoinServerMutation(input: ClientJoinServerInput): string {
  if (input.serverId) {
    return `
      mutation {
        joinServer(
          input: {
            serverId: ${toGraphqlString(input.serverId)}
          }
        ) {
          server {
            ${SERVER_FIELDS}
          }
        }
      }
    `;
  }

  if (input.inviteToken) {
    return `
      mutation {
        joinServer(
          input: {
            inviteToken: ${toGraphqlString(input.inviteToken)}
          }
        ) {
          server {
            ${SERVER_FIELDS}
          }
        }
      }
    `;
  }

  throw new Error("Нужно передать либо serverId, либо inviteToken.");
}

/**
 * Безопасно сериализует строку для inline GraphQL-литерала.
 */
function toGraphqlString(value: string): string {
  return JSON.stringify(value);
}
