import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { mvpEventTypeOptions } from "@/lib/step3.shared";
import { updatePlan } from "../../actions";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/plans");
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const plan = await prisma.eventPlan.findFirst({
    where: { id, ownerId: session.user.id },
    select: {
      id: true,
      title: true,
      type: true,
      scheduledAt: true,
      budget: true,
      guestTarget: true,
      venueName: true,
      description: true,
    },
  });

  if (!plan) notFound();

  const updatePlanById = updatePlan.bind(null, id);

  const scheduledAtValue = plan.scheduledAt
    ? new Date(plan.scheduledAt).toISOString().slice(0, 10)
    : "";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground transition-colors">내 플랜</Link>
          <span>/</span>
          <Link href={`/plans/${id}`} className="hover:text-foreground transition-colors truncate">{plan.title}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">수정</span>
        </nav>

        <div className="mb-8">
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">플랜 수정</h1>
        </div>

        <form action={updatePlanById} className="rounded-3xl border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                행사 유형 <span className="text-rose-500">*</span>
              </label>
              <select
                name="type"
                required
                defaultValue={plan.type}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {mvpEventTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                플랜 제목 <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                defaultValue={plan.title}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">예정일</label>
              <input
                name="scheduledAt"
                type="date"
                defaultValue={scheduledAtValue}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">예산 (원)</label>
                <input
                  name="budget"
                  type="number"
                  min={0}
                  defaultValue={plan.budget ?? ""}
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">목표 하객 수</label>
                <input
                  name="guestTarget"
                  type="number"
                  min={0}
                  defaultValue={plan.guestTarget ?? ""}
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">장소명</label>
              <input
                name="venueName"
                type="text"
                defaultValue={plan.venueName ?? ""}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">메모</label>
              <textarea
                name="description"
                rows={4}
                defaultValue={plan.description ?? ""}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="mt-7 flex items-center justify-end gap-3">
            <Link
              href={`/plans/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted"
            >
              취소
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              저장
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
