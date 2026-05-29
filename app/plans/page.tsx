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
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import type { PlanDashboardData, PlanDashboardNextAction } from "@/types/plan";

function getNextActionMeta(nextAction: PlanDashboardNextAction) {
  switch (nextAction) {
    case "create_quote_request":
      return {
        label: "파트너 선택",
        description: "yeON이 추천 구성을 준비했습니다. 파트너를 선택해 보세요.",
        badge: "bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/60",
        cta: "파트너 선택하기",
        ctaVariant: "weddingGold",
        Icon: ArrowRight,
      } as const;
    case "waiting_for_vendor":
      return {
        label: "파트너 응답 대기",
        description: "견적 요청이 파트너사로 전달되었습니다. 회신을 기다리는 중입니다.",
        badge: "bg-[#faf8f4] text-[#8c8275] border border-[#e5e2da]",
        cta: "견적 현황 보기",
        ctaVariant: "outlineDark",
        Icon: Clock,
      } as const;
    case "compare_quotes":
    case "accept_quote":
      return {
        label: "제안서 조율 완료",
        description: "도도하게 정비된 견적서가 도착했습니다. 지금 항목을 확인해 보세요.",
        badge: "bg-[#eafaf1] text-[#0f9652] border border-emerald-100",
        cta: "제안서 확인하기",
        ctaVariant: "emerald",
        Icon: Scale,
      } as const;
    case "reservation_pending":
      return {
        label: "최종 승인 대기",
        description: "고객 승인이 완료되어 파트너사의 최종 스케줄 승인을 대기하고 있습니다.",
        badge: "bg-[#f5f3ff] text-[#6d28d9] border border-purple-100",
        cta: "예약 대기 확인",
        ctaVariant: "purple",
        Icon: Clock,
      } as const;
    case "confirmed":
      return {
        label: "예약 확정 완료",
        description: "예약 조율 및 스케줄이 완벽하게 확정되었습니다.",
        badge: "bg-[#eafaf1] text-[#0f9652] border border-emerald-200",
        cta: "확정 예약서 보기",
        ctaVariant: "emerald",
        Icon: CheckCircle2,
      } as const;
    default:
      return {
        label: "조율 종료",
        description: "이 플랜의 모든 조율이 취소되었습니다.",
        badge: "bg-[#f4f5f8] text-[#475569] border border-[#cbd3e0]",
        cta: "새로 시작하기",
        ctaVariant: "gray",
        Icon: FileQuestion,
      } as const;
  }
}

const ctaStyles = {
  weddingGold: "bg-[#c4977a] hover:bg-[#b08569] text-white",
  outlineDark: "border border-[#2c3455] text-[#2c3455] hover:bg-[#faf9f5]",
  emerald: "bg-[#2c3455] hover:bg-[#1e2645] text-white",
  purple: "bg-[#6d28d9] hover:bg-[#5b21b6] text-white",
  gray: "border border-[#e5e2da] bg-white text-muted-foreground hover:bg-[#faf9f5]",
} as const;

function getPlannerStep(nextAction: PlanDashboardNextAction) {
  switch (nextAction) {
    case "compare_quotes":
    case "accept_quote":
    case "reservation_pending":
    case "confirmed":
      return 4;
    case "create_quote_request":
    case "waiting_for_vendor":
    default:
      return 3;
  }
}

function getPlannerLink(plan: PlanDashboardData) {
  const type = plan.eventType === "WEDDING" ? "wedding" : "funeral";
  const params = new URLSearchParams({
    planId: plan.id,
    step: String(getPlannerStep(plan.summary.nextAction))
  });
  return `/planner/${type}?${params.toString()}`;
}

export default async function PlansPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/plans");
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const result = await getPlansWithQuoteStatus();
  const plans = result.success ? result.data : [];

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c3455] selection:bg-[#ebdccf] selection:text-[#2c3455]">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#e5e2da] pb-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8c8275]">Planning Workspace</p>
            <h1 className="font-[var(--font-serif)] text-2xl font-normal tracking-tight text-[#2c3455] sm:text-3xl">
              내 행사 현황
            </h1>
            <p className="text-xs text-[#8c8275]">
              진행 중인 의례 설계 및 파트너 조율 현황을 차분하게 검토하세요.
            </p>
          </div>
          <Link href="/plans/new" className="inline-flex h-9 items-center justify-center rounded-xl bg-[#2c3455] px-4 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#1e2645] active:scale-[0.98]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            새 행사 만들기
          </Link>
        </div>

        {/* Empty state */}
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e5e2da] bg-white/50 py-20 text-center">
            <CalendarDays className="mb-4 h-8 w-8 text-[#8c8275]/40" />
            <p className="mb-2 font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
              아직 행사 플랜이 없습니다
            </p>
            <p className="mb-6 max-w-xs text-xs text-[#8c8275] leading-relaxed">
              결혼이나 장례 행사를 준비 중이라면 새 플랜을 만들어 보세요. yeON이 기본 구성을 정돈하여 품격 있게 보좌하겠습니다.
            </p>
            <Link href="/plans/new" className="inline-flex h-9 items-center justify-center rounded-xl bg-[#2c3455] px-4 text-xs font-semibold text-white transition-all hover:bg-[#1e2645]">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
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
                ? "bg-white/80 border-[#ebdccf]/70 hover:border-[#c4977a]"
                : "bg-white/80 border-[#cbd3e0]/80 hover:border-[#2c3455]";

              const hasAnyActivity =
                plan.summary.pendingRequests > 0 ||
                plan.summary.respondedQuotes > 0 ||
                plan.summary.acceptedQuotes > 0 ||
                plan.summary.reservationsPending > 0 ||
                plan.summary.reservationsConfirmed > 0;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-6 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)] ${cardBg}`}
                >
                  {/* Top row: title + desktop CTA */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isWedding ? "text-[#c4977a]" : "text-[#475569]"}`}>
                          {isWedding ? "Wedding" : "Funeral"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455] truncate">
                          {plan.title ?? "(제목 없음)"}
                        </h2>
                        
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8c8275] font-medium">
                          {plan.eventDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5 text-[#8c8275]/50" />
                              {formatDate(plan.eventDate)}
                            </span>
                          )}
                          {plan.location && <span>📍 {plan.location}</span>}
                          {plan.guestCount && (
                            <span className="flex items-center gap-1">
                              <Users2 className="h-3.5 w-3.5 text-[#8c8275]/50" />
                              {plan.guestCount.toLocaleString()}명
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Activity badges (simplified) */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {plan.summary.pendingRequests > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#e5e2da] bg-[#faf9f5]/60 px-2.5 py-1 text-[10px] font-medium text-[#8c8275]">
                            <Clock className="h-3 w-3" />
                            응답 대기 {plan.summary.pendingRequests}건
                          </span>
                        )}
                        {plan.summary.respondedQuotes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-[#eafaf1]/40 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
                            <Scale className="h-3 w-3" />
                            도착한 제안 {plan.summary.respondedQuotes}건
                          </span>
                        )}
                        {plan.summary.acceptedQuotes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-purple-100 bg-[#f5f3ff]/40 px-2.5 py-1 text-[10px] font-medium text-purple-700">
                            수락 완료 {plan.summary.acceptedQuotes}건
                          </span>
                        )}
                        {plan.summary.reservationsConfirmed > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-[#eafaf1] px-2.5 py-1 text-[10px] font-extrabold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            예약 확정 완료 {plan.summary.reservationsConfirmed}건
                          </span>
                        )}
                        {!hasAnyActivity && (
                          <span className="text-[10px] text-[#8c8275]/50 font-medium">
                            아직 파트너 견적 요청이 없습니다.
                          </span>
                        )}
                      </div>

                      {/* Brief concierge helper description */}
                      <p className="text-[11px] text-[#8c8275]/80 leading-relaxed font-normal pt-1">{meta.description}</p>
                    </div>

                    {/* Desktop/Tablet CTA */}
                    <a
                      href={plannerLink}
                      className={`hidden shrink-0 items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-transform duration-150 hover:-translate-y-0.5 sm:inline-flex ${ctaStyles[meta.ctaVariant]}`}
                    >
                      {meta.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Mobile CTA */}
                  <div className="mt-5 sm:hidden">
                    <a
                      href={plannerLink}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-transform duration-150 ${ctaStyles[meta.ctaVariant]}`}
                    >
                      {meta.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
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
