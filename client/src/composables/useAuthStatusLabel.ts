import { computed } from "vue";
import { useAuthStore } from "../stores/auth";

/**
 * Возвращает человекочитаемую подпись текущего auth-состояния клиента.
 */
export function useAuthStatusLabel() {
  const authStore = useAuthStore();

  return computed(() => {
    if (authStore.isSubmitting) {
      return "Выполняется запрос";
    }

    if (!authStore.isInitialized || authStore.status === "initializing") {
      return "Инициализация";
    }

    if (authStore.isAuthenticated) {
      return "Пользователь авторизован";
    }

    return "Гостевой режим";
  });
}
