import { z } from "zod";

/**
 * Публичное представление пользователя, которое можно безопасно отдавать клиенту.
 */
export const publicUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().optional(),
});

/**
 * Публичный пользовательский payload без чувствительных полей.
 */
export type PublicUser = z.infer<typeof publicUserSchema>;

type PublicUserSource = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Преобразует серверную модель пользователя в безопасную клиентскую форму.
 */
export function toPublicUser(user: PublicUserSource): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}
