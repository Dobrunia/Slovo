import {
  AUTHORIZATION_BEARER_PREFIX,
  DEFAULT_CLIENT_GRAPHQL_URL,
  SESSION_TOKEN_HEADER,
} from "../constants";
import type {
  AuthSessionResult,
  ClientUser,
  LoginInput,
  RegisterInput,
  RegisterResult,
} from "../types/auth";
import type { GraphqlResponse } from "../types/graphql";

const AUTH_USER_FIELDS = `
  id
  email
  username
  displayName
  avatarUrl
`;

const ME_QUERY = `
  query {
    me {
      ${AUTH_USER_FIELDS}
    }
  }
`;

type FetchImplementation = typeof fetch;

/**
 * Опции создания GraphQL auth-клиента.
 */
export interface CreateAuthApiClientOptions {
  graphqlUrl?: string;
  fetchImplementation?: FetchImplementation;
}

/**
 * Контракт GraphQL auth-клиента для login/register/me запросов.
 */
export interface AuthApiClient {
  register(input: RegisterInput): Promise<RegisterResult>;
  login(input: LoginInput): Promise<AuthSessionResult>;
  me(sessionToken: string): Promise<ClientUser>;
}

/**
 * Создает GraphQL-клиент для auth-операций клиента.
 */
export function createAuthApiClient(options: CreateAuthApiClientOptions = {}): AuthApiClient {
  const graphqlUrl = options.graphqlUrl ?? DEFAULT_CLIENT_GRAPHQL_URL;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  async function request<TData>(query: string, sessionToken?: string): Promise<TData> {
    const response = await fetchImplementation(graphqlUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sessionToken
          ? {
              authorization: `${AUTHORIZATION_BEARER_PREFIX}${sessionToken}`,
              [SESSION_TOKEN_HEADER]: sessionToken,
            }
          : {}),
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
    async register(input) {
      const data = await request<{ register: RegisterResult }>(buildRegisterMutation(input));
      return data.register;
    },

    async login(input) {
      const data = await request<{ login: AuthSessionResult }>(buildLoginMutation(input));
      return data.login;
    },

    async me(sessionToken) {
      const data = await request<{ me: ClientUser }>(ME_QUERY, sessionToken);
      return data.me;
    },
  };
}

/**
 * Строит GraphQL-мутацию регистрации в том виде, который ожидает StrictQL runtime.
 */
function buildRegisterMutation(input: RegisterInput): string {
  return `
    mutation {
      register(
        input: {
          email: ${toGraphqlString(input.email)}
          username: ${toGraphqlString(input.username)}
          password: ${toGraphqlString(input.password)}
          displayName: ${toGraphqlString(input.displayName)}
        }
      ) {
        user {
          ${AUTH_USER_FIELDS}
        }
      }
    }
  `;
}

/**
 * Строит GraphQL-мутацию логина в том виде, который ожидает StrictQL runtime.
 */
function buildLoginMutation(input: LoginInput): string {
  return `
    mutation {
      login(
        input: {
          email: ${toGraphqlString(input.email)}
          password: ${toGraphqlString(input.password)}
        }
      ) {
        sessionToken
        user {
          ${AUTH_USER_FIELDS}
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
