import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await Promise.all([prisma.user.count(), prisma.eventPlan.count()]);

    return Response.json({
      ok: true,
      checkedAt,
      database: "ok"
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        checkedAt,
        database: "error",
        error: error instanceof Error ? error.message : "unknown error"
      },
      { status: 503 }
    );
  }
}
