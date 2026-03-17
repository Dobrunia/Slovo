import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type {
  ClientCreateVoiceChannelInput,
  ClientDeleteServerResult,
  ClientDeleteVoiceChannelInput,
  ClientReorderVoiceChannelsInput,
  ClientServerInviteLink,
  ClientServerChannelsPayload,
  ClientServerPresenceSnapshot,
  ClientServerSnapshot,
  ClientUpdateServerInput,
  ClientUpdateServerResult,
  ClientUpdateVoiceChannelInput,
} from "../types/server";

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

const SERVER_CHANNELS_FIELDS = `
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
  serverPresenceSnapshot(
    sessionToken: string,
    serverId: string,
  ): Promise<ClientServerPresenceSnapshot>;
  createVoiceChannel(
    sessionToken: string,
    input: ClientCreateVoiceChannelInput,
  ): Promise<ClientServerChannelsPayload>;
  updateVoiceChannel(
    sessionToken: string,
    input: ClientUpdateVoiceChannelInput,
  ): Promise<ClientServerChannelsPayload>;
  deleteVoiceChannel(
    sessionToken: string,
    input: ClientDeleteVoiceChannelInput,
  ): Promise<ClientServerChannelsPayload>;
  reorderVoiceChannels(
    sessionToken: string,
    input: ClientReorderVoiceChannelsInput,
  ): Promise<ClientServerChannelsPayload>;
  serverInviteLink(sessionToken: string, serverId: string): Promise<ClientServerInviteLink>;
  regenerateServerInviteLink(
    sessionToken: string,
    serverId: string,
  ): Promise<ClientServerInviteLink>;
  updateServer(
    sessionToken: string,
    serverId: string,
    input: ClientUpdateServerInput,
  ): Promise<ClientUpdateServerResult>;
  deleteServer(sessionToken: string, serverId: string): Promise<ClientDeleteServerResult>;
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
    async serverPresenceSnapshot(sessionToken, serverId) {
      const data = await request<{ serverPresenceSnapshot: ClientServerPresenceSnapshot }>(
        buildServerPresenceSnapshotQuery(serverId),
        sessionToken,
      );

      return data.serverPresenceSnapshot;
    },
    async createVoiceChannel(sessionToken, input) {
      const data = await request<{ createVoiceChannel: ClientServerChannelsPayload }>(
        buildCreateVoiceChannelMutation(input),
        sessionToken,
      );

      return data.createVoiceChannel;
    },
    async updateVoiceChannel(sessionToken, input) {
      const data = await request<{ updateVoiceChannel: ClientServerChannelsPayload }>(
        buildUpdateVoiceChannelMutation(input),
        sessionToken,
      );

      return data.updateVoiceChannel;
    },
    async deleteVoiceChannel(sessionToken, input) {
      const data = await request<{ deleteVoiceChannel: ClientServerChannelsPayload }>(
        buildDeleteVoiceChannelMutation(input),
        sessionToken,
      );

      return data.deleteVoiceChannel;
    },
    async reorderVoiceChannels(sessionToken, input) {
      const data = await request<{ reorderVoiceChannels: ClientServerChannelsPayload }>(
        buildReorderVoiceChannelsMutation(input),
        sessionToken,
      );

      return data.reorderVoiceChannels;
    },
    async serverInviteLink(sessionToken, serverId) {
      const data = await request<{ serverInviteLink: ClientServerInviteLink }>(
        buildServerInviteLinkQuery(serverId),
        sessionToken,
      );

      return data.serverInviteLink;
    },
    async regenerateServerInviteLink(sessionToken, serverId) {
      const data = await request<{ regenerateServerInviteLink: ClientServerInviteLink }>(
        buildRegenerateServerInviteLinkMutation(serverId),
        sessionToken,
      );

      return data.regenerateServerInviteLink;
    },
    async updateServer(sessionToken, serverId, input) {
      const data = await request<{ updateServer: ClientUpdateServerResult }>(
        buildUpdateServerMutation(serverId, input),
        sessionToken,
      );

      return data.updateServer;
    },
    async deleteServer(sessionToken, serverId) {
      const data = await request<{ deleteServer: ClientDeleteServerResult }>(
        buildDeleteServerMutation(serverId),
        sessionToken,
      );

      return data.deleteServer;
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
 * Строит GraphQL-query initial snapshot-а runtime presence выбранного сервера.
 */
function buildServerPresenceSnapshotQuery(serverId: string): string {
  return `
    query {
      serverPresenceSnapshot(
        input: {
          serverId: ${toGraphqlString(serverId)}
        }
      ) {
        members {
          userId
          displayName
          avatarUrl
          channelId
          joinedAt
        }
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию создания voice-канала.
 */
function buildCreateVoiceChannelMutation(input: ClientCreateVoiceChannelInput): string {
  return `
    mutation {
      createVoiceChannel(
        input: {
          serverId: ${toGraphqlString(input.serverId)}
          name: ${toGraphqlString(input.name.trim())}
        }
      ) {
        ${SERVER_CHANNELS_FIELDS}
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию переименования voice-канала.
 */
function buildUpdateVoiceChannelMutation(input: ClientUpdateVoiceChannelInput): string {
  return `
    mutation {
      updateVoiceChannel(
        input: {
          serverId: ${toGraphqlString(input.serverId)}
          channelId: ${toGraphqlString(input.channelId)}
          name: ${toGraphqlString(input.name.trim())}
        }
      ) {
        ${SERVER_CHANNELS_FIELDS}
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию удаления voice-канала.
 */
function buildDeleteVoiceChannelMutation(input: ClientDeleteVoiceChannelInput): string {
  return `
    mutation {
      deleteVoiceChannel(
        input: {
          serverId: ${toGraphqlString(input.serverId)}
          channelId: ${toGraphqlString(input.channelId)}
        }
      ) {
        ${SERVER_CHANNELS_FIELDS}
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию перестановки voice-каналов.
 */
function buildReorderVoiceChannelsMutation(input: ClientReorderVoiceChannelsInput): string {
  return `
    mutation {
      reorderVoiceChannels(
        input: {
          serverId: ${toGraphqlString(input.serverId)}
          channelIds: ${toGraphqlStringArray(input.channelIds)}
        }
      ) {
        ${SERVER_CHANNELS_FIELDS}
      }
    }
  `;
}

/**
 * Строит GraphQL-query текущей invite-ссылки сервера.
 */
function buildServerInviteLinkQuery(serverId: string): string {
  return `
    query {
      serverInviteLink(
        input: {
          serverId: ${toGraphqlString(serverId)}
        }
      ) {
        serverId
        inviteLink
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию перевыпуска invite-ссылки сервера.
 */
function buildRegenerateServerInviteLinkMutation(serverId: string): string {
  return `
    mutation {
      regenerateServerInviteLink(
        input: {
          serverId: ${toGraphqlString(serverId)}
        }
      ) {
        serverId
        inviteLink
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию обновления названия и аватара сервера.
 */
function buildUpdateServerMutation(
  serverId: string,
  input: ClientUpdateServerInput,
): string {
  return `
    mutation {
      updateServer(
        input: {
          serverId: ${toGraphqlString(serverId)}
          name: ${toGraphqlString(input.name.trim())}
          avatarUrl: ${toGraphqlNullableString(input.avatarUrl)}
        }
      ) {
        server {
          id
          name
          avatarUrl
          isPublic
          role
        }
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию удаления сервера.
 */
function buildDeleteServerMutation(serverId: string): string {
  return `
    mutation {
      deleteServer(
        input: {
          serverId: ${toGraphqlString(serverId)}
        }
      ) {
        serverId
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

/**
 * Безопасно сериализует список строк для inline GraphQL-массива.
 */
function toGraphqlStringArray(values: string[]): string {
  return `[${values.map((value) => toGraphqlString(value)).join(",")}]`;
}

/**
 * Безопасно сериализует nullable-строку для inline GraphQL-литерала.
 */
function toGraphqlNullableString(value: string | null): string {
  return value === null ? "null" : toGraphqlString(value);
}
