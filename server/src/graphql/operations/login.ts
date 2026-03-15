import { z } from "zod";
import { mutation, publicPolicy } from "strictql";
import { createAuthSession } from "../../auth/session.js";
import { publicUserSchema, toPublicUser } from "../../auth/user.js";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USER_EMAIL_MAX_LENGTH,
} from "../../config/constants.js";
import { verifyPassword } from "../../auth/password.js";
import type { GraphqlContext } from "../context.js";

const loginInputSchema = z.object({
  email: z.string().trim().email().max(USER_EMAIL_MAX_LENGTH),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

const loginOutputSchema = z.object({
  sessionToken: z.string().min(1),
  user: publicUserSchema,
});

/**
 * Публичная GraphQL-мутация логина пользователя с созданием auth-сессии.
 */
export const loginMutation = mutation({
  name: "login",
  policy: publicPolicy,
  input: loginInputSchema,
  output: loginOutputSchema,
  resolve: async ({
    input,
    ctx,
  }: {
    input: z.infer<typeof loginInputSchema>;
    ctx: unknown;
  }) => {
    const graphqlContext = ctx as GraphqlContext;
    const email = input.email.trim().toLowerCase();
    const user = await graphqlContext.dataLayer.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new Error("Неверные учетные данные.");
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error("Неверные учетные данные.");
    }

    const sessionToken = await createAuthSession({
      dataLayer: graphqlContext.dataLayer,
      userId: user.id,
    });

    return {
      sessionToken,
      user: toPublicUser(user),
    };
  },
});
