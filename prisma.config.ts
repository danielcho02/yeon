import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "env TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --import tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
