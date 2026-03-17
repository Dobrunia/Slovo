import { z } from 'zod';
import { mutation, publicPolicy } from 'strictql';
import { hashPassword } from '../../auth/password.js';
import { publicUserSchema, toPublicUser } from '../../auth/user.js';
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USER_EMAIL_MAX_LENGTH,
} from '../../config/constants.js';
import type { GraphqlContext } from '../context.js';

const registerInputSchema = z.object({
  email: z.string().trim().email().max(USER_EMAIL_MAX_LENGTH),
  username: z.string().trim().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  displayName: z.string().trim().min(DISPLAY_NAME_MIN_LENGTH).max(DISPLAY_NAME_MAX_LENGTH),
});

const registerOutputSchema = z.object({
  user: publicUserSchema,
});

/**
 * Публичная GraphQL-мутация регистрации пользователя.
 */
export const registerMutation = mutation({
  name: 'register',
  policy: publicPolicy,
  input: registerInputSchema,
  output: registerOutputSchema,
  resolve: async ({ input, ctx }: { input: z.infer<typeof registerInputSchema>; ctx: unknown }) => {
    const graphqlContext = ctx as GraphqlContext;
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    const displayName = input.displayName.trim();

    const existingUser = await graphqlContext.dataLayer.prisma.user.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            username,
          },
        ],
      },
    });

    if (existingUser?.email === email) {
      throw new Error('Пользователь с таким email уже существует.');
    }

    if (existingUser?.username === username) {
      throw new Error('Пользователь с таким username уже существует.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await graphqlContext.dataLayer.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName,
      },
    });

    return {
      user: toPublicUser(user),
    };
  },
});
