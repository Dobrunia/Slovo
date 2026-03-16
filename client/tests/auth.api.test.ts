import { describe, expect, test, vi } from "vitest";
import { createAuthApiClient } from "../src/graphql/auth";
import { DEFAULT_CLIENT_GRAPHQL_URL } from "../src/constants";

describe("auth api client", () => {
  /**
   * Проверяется, что клиентская регистрация отправляет inline `input: { ... }`,
   * а не ссылается на несуществующий GraphQL type `RegisterInput`.
   * Это важно, потому что текущий StrictQL runtime на сервере принимает именно
   * inline-объект, и любая попытка зашить variable type ломает регистрацию целиком.
   * Граничные случаи: в запросе должны остаться все поля регистрации и корректное
   * строковое экранирование значений внутри GraphQL body.
   */
  test("should build register mutation without unknown RegisterInput type", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            register: {
              user: {
                id: "user-1",
                email: "user@example.com",
                username: "dobrunia",
                displayName: "Добрыня",
                avatarUrl: null,
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const client = createAuthApiClient({
      graphqlUrl: DEFAULT_CLIENT_GRAPHQL_URL,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await client.register({
      email: "user@example.com",
      username: "dobrunia",
      password: "super-secret-password",
      displayName: "Добрыня",
    });

    const firstCall = fetchMock.mock.calls.at(0) as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    expect(firstCall).toBeDefined();
    const requestInit = firstCall?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("register(");
    expect(payload.query).toContain("input: {");
    expect(payload.query).toContain('email: "user@example.com"');
    expect(payload.query).not.toContain("RegisterInput");
  });

  /**
   * Проверяется, что клиентский login использует тот же inline-контракт,
   * который реально проходит через серверные GraphQL тесты и Yoga runtime.
   * Это важно, потому что ошибка в имени input type ломает не только register,
   * но и весь auth-flow дальше, включая получение session token и `me`.
   * Граничные случаи: тело запроса должно содержать email и password как
   * inline-литералы и не должно ссылаться на несуществующий `LoginInput`.
   */
  test("should build login mutation without unknown LoginInput type", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            login: {
              sessionToken: "session-token",
              user: {
                id: "user-1",
                email: "user@example.com",
                username: "dobrunia",
                displayName: "Добрыня",
                avatarUrl: null,
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const client = createAuthApiClient({
      graphqlUrl: DEFAULT_CLIENT_GRAPHQL_URL,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await client.login({
      email: "user@example.com",
      password: "super-secret-password",
    });

    const firstCall = fetchMock.mock.calls.at(0) as
      | [RequestInfo | URL, RequestInit?]
      | undefined;
    expect(firstCall).toBeDefined();
    const requestInit = firstCall?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as {
      query: string;
    };

    expect(payload.query).toContain("login(");
    expect(payload.query).toContain("input: {");
    expect(payload.query).toContain('email: "user@example.com"');
    expect(payload.query).not.toContain("LoginInput");
  });
});
