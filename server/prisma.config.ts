import { defineConfig, env } from "@prisma/config";

// No .env file exists in deployed environments (Vercel injects env vars
// directly into process.env) — only load it when present, for local dev.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "node prisma/seed.mjs",
  },
});
