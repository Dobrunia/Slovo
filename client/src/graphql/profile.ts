import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type { ClientUser } from "../types/auth";
import type { GraphqlResponse } from "../types/graphql";
import type {
  ClientProfileMutationResult,
  ClientUpdateAvatarInput,
  ClientUpdateDisplayNameInput,
} from "../types/profile";

const PROFILE_USER_FIELDS = `
  id
  email
  username
  displayName
  avatarUrl
`;

type FetchImplementation = typeof fetch;

/**
 * Опции создания GraphQL-клиента профиля.
 */
export interface CreateProfileApiClientOptions {
  graphqlUrl?: string;
  fetchImplementation?: FetchImplementation;
}

/**
 * Контракт GraphQL-клиента для изменения профиля пользователя.
 */
export interface ProfileApiClient {
  updateDisplayName(
    sessionToken: string,
    input: ClientUpdateDisplayNameInput,
  ): Promise<ClientProfileMutationResult>;
  updateAvatar(
    sessionToken: string,
    input: ClientUpdateAvatarInput,
  ): Promise<ClientProfileMutationResult>;
}

/**
 * Создает GraphQL-клиент для операций изменения профиля.
 */
export function createProfileApiClient(
  options: CreateProfileApiClientOptions = {},
): ProfileApiClient {
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
    async updateDisplayName(sessionToken, input) {
      const data = await request<{ updateDisplayName: ClientProfileMutationResult }>(
        buildUpdateDisplayNameMutation(input),
        sessionToken,
      );
      return data.updateDisplayName;
    },

    async updateAvatar(sessionToken, input) {
      const data = await request<{ updateAvatar: ClientProfileMutationResult }>(
        buildUpdateAvatarMutation(input),
        sessionToken,
      );
      return data.updateAvatar;
    },
  };
}

/**
 * Строит GraphQL-мутацию изменения display name.
 */
function buildUpdateDisplayNameMutation(input: ClientUpdateDisplayNameInput): string {
  return `
    mutation {
      updateDisplayName(
        input: {
          displayName: ${toGraphqlString(input.displayName)}
        }
      ) {
        user {
          ${PROFILE_USER_FIELDS}
        }
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию изменения аватара.
 */
function buildUpdateAvatarMutation(input: ClientUpdateAvatarInput): string {
  return `
    mutation {
      updateAvatar(
        input: {
          avatarUrl: ${toGraphqlNullableString(input.avatarUrl)}
        }
      ) {
        user {
          ${PROFILE_USER_FIELDS}
        }
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
 * Безопасно сериализует nullable-строку для inline GraphQL-литерала.
 */
function toGraphqlNullableString(value: string | null): string {
  if (value === null) {
    return "null";
  }

  return JSON.stringify(value);
}
