import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * Конфигурация Vite для локальной разработки клиентского приложения.
 */
export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
