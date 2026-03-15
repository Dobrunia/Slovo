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
import type {
  GraphqlRequestPayload,
  GraphqlResponse,
} from "../types/graphql";

const AUTH_USER_FIELDS = `
  id
  email
  username
  displayName
`;

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        ${AUTH_USER_FIELDS}
      }
    }
  }
`;

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      sessionToken
      user {
        ${AUTH_USER_FIELDS}
      }
    }
  }
`;

const ME_QUERY = `
  query Me {
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

  async function request<TData, TVariables extends Record<string, unknown>>(
    payload: GraphqlRequestPayload<TVariables>,
    sessionToken?: string,
  ): Promise<TData> {
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
      body: JSON.stringify(payload),
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
      const data = await request<{ register: RegisterResult }, { input: RegisterInput }>({
        query: REGISTER_MUTATION,
        variables: {
          input,
        },
      });

      return data.register;
    },

    async login(input) {
      const data = await request<{ login: AuthSessionResult }, { input: LoginInput }>({
        query: LOGIN_MUTATION,
        variables: {
          input,
        },
      });

      return data.login;
    },

    async me(sessionToken) {
      const data = await request<{ me: ClientUser }, Record<string, never>>(
        {
          query: ME_QUERY,
          variables: {},
        },
        sessionToken,
      );

      return data.me;
    },
  };
}
