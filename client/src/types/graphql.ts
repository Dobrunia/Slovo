/**
 * Ошибка GraphQL-ответа, приходящая от сервера.
 */
export interface GraphqlErrorPayload {
  message: string;
}

/**
 * Унифицированный GraphQL-ответ клиента.
 */
export interface GraphqlResponse<TData> {
  data?: TData;
  errors?: GraphqlErrorPayload[];
}

/**
 * GraphQL-payload клиента.
 */
export interface GraphqlRequestPayload<TVariables extends Record<string, unknown>> {
  query: string;
  variables: TVariables;
}
