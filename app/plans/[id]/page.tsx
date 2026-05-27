export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Edit, MapPin, Trash2, Users, Wallet } from "lucide-react";

import { Nav } from "@/components/nav";
import { buttonVariants } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getQuoteStatusMeta
} from "@/lib/step3.shared";
import { deletePlan } from "../actions";

export default async function PlanDetailPage({
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
    include: {
      reservations: {
        include: { vendor: { select: { companyName: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!plan) notFound();

  const deletePlanById = deletePlan.bind(null, id);

  const stats = {
    requesting: plan.reservations.filter((r) => r.status === "PENDING" && !r.confirmedAmount).length,
    proposed: plan.reservations.filter((r) => r.status === "PENDING" && r.confirmedAmount !== null).length,
    confirmed: plan.reservations.filter((r) => r.status === "CONFIRMED").length,
    cancelled: plan.reservations.filter((r) => r.status === "CANCELLED").length,
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground transition-colors">내 플랜</Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{plan.title}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {getEventTypeLabel(plan.type)}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {plan.status}
              </span>
            </div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">
              {plan.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/plans/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              수정
            </Link>
            <form action={deletePlanById}>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:border-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            </form>
          </div>
        </div>

        {/* 준비 현황 위젯 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="견적 요청 중" count={stats.requesting} tone="neutral" />
          <StatCard label="제안 수신" count={stats.proposed} tone={stats.proposed > 0 ? "amber" : "neutral"} />
          <StatCard label="확정" count={stats.confirmed} tone={stats.confirmed > 0 ? "emerald" : "neutral"} />
          <StatCard label="취소" count={stats.cancelled} tone="neutral" />
        </div>

        {/* 플래너 빠른 진입 */}
        {plan.type && (
          <div className="mb-6">
            <Link
              href={`/planner/${plan.type.toLowerCase()}?planId=${plan.id}`}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-all duration-200 hover:bg-primary/10"
            >
              이 행사로 업체 찾기 →
            </Link>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          {/* Plan Info */}
          <section className="rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm">
            <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">플랜 정보</h2>
            <div className="space-y-3.5">
              {plan.scheduledAt && (
                <InfoRow icon={CalendarDays} label="예정일" value={formatDate(plan.scheduledAt)} />
              )}
              {plan.venueName && (
                <InfoRow icon={MapPin} label="장소" value={plan.venueName} />
              )}
              {plan.budget && (
                <InfoRow icon={Wallet} label="예산" value={`${plan.budget.toLocaleString()}원`} />
              )}
              {plan.guestTarget && (
                <InfoRow icon={Users} label="목표 하객 수" value={`${plan.guestTarget.toLocaleString()}명`} />
              )}
              <InfoRow icon={CalendarDays} label="생성일" value={formatDate(plan.createdAt)} />
            </div>

            {plan.description && (
              <div className="mt-5 rounded-2xl border border-border/40 bg-muted/30 p-4">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">메모</p>
                <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{plan.description}</p>
              </div>
            )}
          </section>

          {/* Reservations */}
          <section className="rounded-[1.5rem] border border-border/60 bg-white/90 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-base font-semibold text-foreground">견적 요청</h2>
              <Link href={`/vendors?planId=${plan.id}`} className="text-xs font-semibold text-primary hover:underline">
                업체 찾기 →
              </Link>
            </div>

            {plan.reservations.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-sm text-muted-foreground">아직 견적 요청이 없습니다.</p>
                <Link href={`/vendors?planId=${plan.id}`} className="mt-3 text-xs font-semibold text-primary hover:underline">
                  업체를 찾아 견적을 요청해보세요
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {plan.reservations.map((res) => {
                  const displayMeta = getQuoteStatusMeta(res);

                  return (
                    <div
                      key={res.id}
                      className="rounded-2xl border border-border/40 bg-white/70 p-4"
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {res.vendor?.companyName ?? res.vendor?.name ?? "업체"}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${displayMeta.tone}`}>
                          {displayMeta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getQuoteServiceModuleLabel({
                          eventType: plan.type,
                          serviceCategory: res.serviceCategory,
                          serviceName: res.serviceName
                        })}
                      </p>
                      {res.serviceDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          희망일: {formatDate(res.serviceDate)}
                        </p>
                      )}
                      {res.quotedAmount && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          예산: {res.quotedAmount.toLocaleString()}원
                        </p>
                      )}
                      {res.confirmedAmount && (
                        <p className={`mt-0.5 text-xs ${res.status === "CONFIRMED" ? "font-semibold text-emerald-700" : "font-semibold text-primary"}`}>
                          {res.status === "CONFIRMED" ? "확정 금액" : "제안 금액"}: {res.confirmedAmount.toLocaleString()}원
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "neutral" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/60 bg-emerald-50/60 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200/60 bg-amber-50/60 text-amber-700"
        : "border-border/60 bg-white/90 text-foreground";
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="mt-0.5 text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-white/70 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/55">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
