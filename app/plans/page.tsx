export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileQuestion,
  Plus,
  Scale,
  Users2,
} from "lucide-react";

import { getPlansWithQuoteStatus } from "@/app/actions/plan";
import { Nav } from "@/components/nav";
import { buttonVariants } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import type { PlanDashboardData, PlanDashboardNextAction } from "@/types/plan";

function getNextActionMeta(nextAction: PlanDashboardNextAction) {
  switch (nextAction) {
    case "create_quote_request":
      return {
        label: "업체 찾기",
        description: "아직 견적 요청이 없습니다. 업체를 선택해 견적을 요청해보세요.",
        badge: "bg-gray-100 text-gray-600",
        cta: "업체 선택하기",
        ctaVariant: "primary",
        Icon: ArrowRight,
      } as const;
    case "waiting_for_vendor":
      return {
        label: "업체 응답 대기",
        description: "견적 요청을 보냈습니다. 업체의 응답을 기다리는 중입니다.",
        badge: "bg-amber-100 text-amber-700",
        cta: "요청 현황 보기",
        ctaVariant: "amber",
        Icon: Clock,
      } as const;
    case "compare_quotes":
    case "accept_quote":
      return {
        label: "견적 비교 가능",
        description: "업체가 견적을 보냈습니다. 지금 비교하고 수락할 수 있습니다.",
        badge: "bg-blue-100 text-blue-700",
        cta: "견적 비교하기",
        ctaVariant: "blue",
        Icon: Scale,
      } as const;
    case "reservation_pending":
      return {
        label: "업체 확정 대기",
        description: "견적을 수락했습니다. 업체의 최종 확정을 기다리는 중입니다.",
        badge: "bg-violet-100 text-violet-700",
        cta: "진행 현황 보기",
        ctaVariant: "violet",
        Icon: Clock,
      } as const;
    case "confirmed":
      return {
        label: "예약 확정 완료",
        description: "예약이 최종 확정되었습니다.",
        badge: "bg-emerald-100 text-emerald-700",
        cta: "행사 현황 보기",
        ctaVariant: "emerald",
        Icon: CheckCircle2,
      } as const;
    default:
      return {
        label: "취소됨",
        description: "이 플랜의 모든 요청이 취소되었습니다.",
        badge: "bg-gray-100 text-gray-500",
        cta: "새로 시작하기",
        ctaVariant: "gray",
        Icon: FileQuestion,
      } as const;
  }
}

const ctaStyles = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  amber: "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
  violet: "border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100",
  emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
  gray: "border border-border bg-white text-muted-foreground hover:bg-muted/30",
} as const;

function getPlannerLink(plan: PlanDashboardData) {
  const type = plan.eventType === "WEDDING" ? "wedding" : "funeral";
  return `/planner/${type}?planId=${plan.id}`;
}

export default async function PlansPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/plans");
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const result = await getPlansWithQuoteStatus();
  const plans = result.success ? result.data : [];

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">
              내 행사 현황
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              진행 중인 행사 준비를 한눈에 확인하세요
            </p>
          </div>
          <Link href="/plans/new" className={buttonVariants({ variant: "default", size: "sm" })}>
            <Plus className="mr-1.5 h-4 w-4" />
            새 행사 만들기
          </Link>
        </div>

        {/* Empty state */}
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-white/60 py-20 text-center">
            <CalendarDays className="mb-4 h-10 w-10 text-muted-foreground/40" />
            <p className="mb-2 font-[var(--font-display)] text-base font-semibold text-foreground">
              아직 행사 플랜이 없습니다
            </p>
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">
              결혼이나 장례 행사를 준비 중이라면 새 플랜을 만들어 업체 견적부터 예약 확정까지 한 번에 관리하세요.
            </p>
            <Link href="/plans/new" className={buttonVariants({ variant: "default", size: "sm" })}>
              <Plus className="mr-1.5 h-4 w-4" />
              첫 행사 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => {
              const meta = getNextActionMeta(plan.summary.nextAction);
              const { Icon } = meta;
              const plannerLink = getPlannerLink(plan);
              const isWedding = plan.eventType === "WEDDING";
              const cardBg = isWedding
                ? "from-[#fdf8f0] to-[#fce3d0] border-amber-200/60"
                : "from-[#f0f4fa] to-[#d8e3f2] border-indigo-200/50";

              const hasAnyActivity =
                plan.summary.pendingRequests > 0 ||
                plan.summary.respondedQuotes > 0 ||
                plan.summary.acceptedQuotes > 0 ||
                plan.summary.reservationsPending > 0 ||
                plan.summary.reservationsConfirmed > 0;

              return (
                <div
                  key={plan.id}
                  className={`rounded-[1.75rem] border bg-gradient-to-br shadow-sm transition-all duration-200 hover:shadow-md ${cardBg}`}
                >
                  <div className="p-5 sm:p-6">
                    {/* Top row: title + desktop CTA */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground/70">
                            {isWedding ? "웨딩" : "장례"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}
                          >
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </div>
                        <h2 className="font-[var(--font-display)] truncate text-lg font-bold text-foreground">
                          {plan.title ?? "(제목 없음)"}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {plan.eventDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(plan.eventDate)}
                            </span>
                          )}
                          {plan.location && <span>📍 {plan.location}</span>}
                          {plan.guestCount && (
                            <span className="flex items-center gap-1">
                              <Users2 className="h-3 w-3" />
                              {plan.guestCount.toLocaleString()}명
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Desktop CTA */}
                      <Link
                        href={plannerLink}
                        className={`hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:inline-flex ${ctaStyles[meta.ctaVariant]}`}
                      >
                        {meta.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    {/* Activity badges */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {plan.summary.pendingRequests > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" />
                          응답 대기 {plan.summary.pendingRequests}건
                        </span>
                      )}
                      {plan.summary.respondedQuotes > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50/80 px-3 py-1 text-xs font-medium text-blue-700">
                          <Scale className="h-3 w-3" />
                          받은 견적 {plan.summary.respondedQuotes}건
                        </span>
                      )}
                      {plan.summary.acceptedQuotes > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/70 bg-violet-50/80 px-3 py-1 text-xs font-medium text-violet-700">
                          수락한 견적 {plan.summary.acceptedQuotes}건
                        </span>
                      )}
                      {plan.summary.reservationsPending > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200/70 bg-violet-50/80 px-3 py-1 text-xs font-medium text-violet-700">
                          업체 확정 대기 {plan.summary.reservationsPending}건
                        </span>
                      )}
                      {plan.summary.reservationsConfirmed > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/60 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          예약 확정 {plan.summary.reservationsConfirmed}건
                        </span>
                      )}
                      {!hasAnyActivity && (
                        <span className="text-xs text-muted-foreground/60">
                          아직 견적 요청이 없습니다
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="mt-2 text-xs text-muted-foreground/70">{meta.description}</p>

                    {/* Mobile CTA */}
                    <div className="mt-4 sm:hidden">
                      <Link
                        href={plannerLink}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${ctaStyles[meta.ctaVariant]}`}
                      >
                        {meta.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
