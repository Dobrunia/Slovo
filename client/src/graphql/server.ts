import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type { ClientServerSnapshot } from "../types/server";

type FetchImplementation = typeof fetch;

type GraphqlError = {
  message: string;
};

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: GraphqlError[];
};

const SERVER_SNAPSHOT_FIELDS = `
  server {
    id
    name
    avatarUrl
    isPublic
    role
  }
  channels {
    id
    name
    sortOrder
  }
`;

/**
 * Опции создания GraphQL-клиента модуля сервера.
 */
export interface CreateServerApiClientOptions {
  graphqlUrl?: string;
  fetchImplementation?: FetchImplementation;
}

/**
 * Контракт GraphQL-клиента initial snapshot-а выбранного сервера.
 */
export interface ServerApiClient {
  serverSnapshot(sessionToken: string, serverId: string): Promise<ClientServerSnapshot>;
}

/**
 * Создает GraphQL-клиент для initial load выбранного сервера.
 */
export function createServerApiClient(
  options: CreateServerApiClientOptions = {},
): ServerApiClient {
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
    async serverSnapshot(sessionToken, serverId) {
      const data = await request<{ serverSnapshot: ClientServerSnapshot }>(
        buildServerSnapshotQuery(serverId),
        sessionToken,
      );

      return data.serverSnapshot;
    },
  };
}

/**
 * Строит GraphQL-query initial snapshot-а выбранного сервера.
 */
function buildServerSnapshotQuery(serverId: string): string {
  return `
    query {
      serverSnapshot(
        input: {
          serverId: ${toGraphqlString(serverId)}
        }
      ) {
        ${SERVER_SNAPSHOT_FIELDS}
      }
    }
  `;
}

/**
 * Безопасно сериализует строку для inline GraphQL-литерала.
 */
function toGraphqlString(value: string): string {
  return JSON.stringify(value);
}
