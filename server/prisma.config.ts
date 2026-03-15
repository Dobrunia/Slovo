import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";
import { DEFAULT_DATABASE_URL } from "./src/config/constants.js";

loadDotenv({
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

/**
 * Конфигурация Prisma CLI для схемы и datasource в Prisma 7.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
