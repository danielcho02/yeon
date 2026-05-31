import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { isDatabaseBusyError } from "@/lib/errors";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

const sqliteBusyTimeoutMs = Number.parseInt(
  process.env.SQLITE_BUSY_TIMEOUT_MS ?? "10000",
  10
);

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: Number.isFinite(sqliteBusyTimeoutMs) ? sqliteBusyTimeoutMs : 10000
  });

  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
  task: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 80;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!isDatabaseBusyError(error) || attempt === attempts) {
        throw error;
      }

      await wait(delayMs * attempt);
    }
  }

  return task();
}
