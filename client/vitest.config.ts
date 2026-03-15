import { defineConfig } from "vitest/config";

/**
 * Ограничивает клиентские тесты директорией `tests`.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
