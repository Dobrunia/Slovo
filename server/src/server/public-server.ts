import { z } from "zod";

/**
 * Публичная краткая форма сервера для списков и навигации клиента.
 */
export const publicServerListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().optional(),
  isPublic: z.boolean(),
  role: z.string().min(1),
});

/**
 * Публичный payload сервера в списке пользовательских серверов.
 */
export type PublicServerListItem = z.infer<typeof publicServerListItemSchema> & {
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type PublicServerListItemSource = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

/**
 * Преобразует серверную запись membership+server в безопасную клиентскую форму.
 */
export function toPublicServerListItem(
  server: PublicServerListItemSource,
): PublicServerListItem {
  return {
    id: server.id,
    name: server.name,
    avatarUrl: server.avatarUrl ?? undefined,
    isPublic: server.isPublic,
    role: server.role,
  };
}
