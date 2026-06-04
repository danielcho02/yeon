export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Edit, Trash2, Layers } from "lucide-react";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
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
        include: {
          vendor: { select: { companyName: true, name: true } },
          quoteRequest: { select: { status: true } }
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!plan) notFound();

  const deletePlanById = deletePlan.bind(null, id);

  const stats = {
    requesting: plan.reservations.filter((r) => r.status === "PENDING" && r.quoteResponseId == null).length,
    proposed: plan.reservations.filter(
      (r) =>
        r.status === "PENDING" &&
        r.quoteResponseId != null &&
        r.quoteRequest?.status !== "ACCEPTED"
    ).length,
    confirmed: plan.reservations.filter((r) => r.status === "CONFIRMED").length,
    cancelled: plan.reservations.filter((r) => r.status === "CANCELED").length,
  };

  const isWedding = plan.type === "WEDDING";
  const accent = isWedding ? "text-[#c4977a]" : "text-[#5b6b86]";
  const primaryCtaCls = isWedding
    ? "bg-[#c4977a] hover:bg-[#b08569] text-white"
    : "bg-[#2c3455] hover:bg-[#1e2645] text-white";

  const definitions: Array<{ label: string; value: string }> = [];
  if (plan.scheduledAt) definitions.push({ label: "예정일", value: formatDate(plan.scheduledAt) });
  if (plan.venueName) definitions.push({ label: "장소", value: plan.venueName });
  if (plan.budget) definitions.push({ label: "예산", value: `${plan.budget.toLocaleString()}원` });
  if (plan.guestTarget) definitions.push({ label: "목표 하객 수", value: `${plan.guestTarget.toLocaleString()}명` });
  definitions.push({ label: "생성일", value: formatDate(plan.createdAt) });

  const totalReservations = stats.requesting + stats.proposed + stats.confirmed;
  const statusLine =
    stats.confirmed > 0
      ? `예약 확정 ${stats.confirmed}건`
      : stats.proposed > 0
      ? `도착한 제안 ${stats.proposed}건`
      : stats.requesting > 0
      ? `견적 요청 진행 ${stats.requesting}건`
      : "아직 파트너 견적 요청이 없습니다";

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c3455]">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        {/* Breadcrumb */}
        <nav className="mb-10 flex items-center gap-2 text-xs text-[#8c8275]">
          <Link href="/plans" className="transition-colors hover:text-[#2c3455]">내 행사 현황</Link>
          <span>/</span>
          <span className="truncate font-medium text-[#2c3455]">{plan.title}</span>
        </nav>

        {/* Editorial header */}
        <header className="border-b border-[#e5e2da] pb-8">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${accent}`}>
            {isWedding ? "Wedding" : "Funeral"}
          </p>
          <h1 className="mt-3 font-[var(--font-serif)] text-3xl font-normal leading-tight tracking-tight text-[#2c3455] sm:text-4xl">
            {plan.title}
          </h1>
          <p className="mt-3 text-sm text-[#8c8275]">{statusLine}</p>

          {/* single primary CTA */}
          {plan.type && (
            <a
              href={`/planner/${plan.type.toLowerCase()}?planId=${plan.id}`}
              className={`mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold transition-transform duration-150 hover:-translate-y-0.5 ${primaryCtaCls}`}
            >
              파트너 찾기
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </header>

        {/* Plan info — definition list */}
        <section className="border-b border-[#e5e2da] py-8">
          <h2 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">행사 정보</h2>
          <dl className="divide-y divide-[#ece7df]">
            {definitions.map((d) => (
              <div key={d.label} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="text-xs text-[#8c8275]">{d.label}</dt>
                <dd className="text-sm font-medium tabular-nums text-[#2c3455]">{d.value}</dd>
              </div>
            ))}
          </dl>

          {plan.description && (
            <div className="mt-6 border-l-2 border-[#ebdccf] pl-4">
              <p className="text-sm leading-7 text-[#6b6357] whitespace-pre-wrap">{plan.description}</p>
            </div>
          )}
        </section>

        {/* Reservations — compact list */}
        <section className="py-8">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">
              파트너 조율 내역
              {totalReservations > 0 && <span className="ml-2 tabular-nums text-[#2c3455]">{totalReservations}</span>}
            </h2>
            <Link href={`/vendors?planId=${plan.id}`} className="text-xs font-semibold text-[#c4977a] transition-colors hover:text-[#b08569]">
              업체 찾기 →
            </Link>
          </div>

          {plan.reservations.length === 0 ? (
            <p className="py-6 text-sm text-[#8c8275]">
              아직 조율 중인 파트너가 없습니다. 위 버튼으로 파트너를 찾아보세요.
            </p>
          ) : (
            <ul className="divide-y divide-[#ece7df]">
              {plan.reservations.map((res) => {
                const displayMeta = getQuoteStatusMeta({
                  ...res,
                  quoteRequestStatus: res.quoteRequest?.status ?? null
                });
                const confirmedAmount = res.status === "CONFIRMED" ? res.confirmedAmount : null;
                const proposedAmount =
                  res.status !== "CONFIRMED" && res.quoteResponseId && res.quotedAmount != null
                    ? res.quotedAmount
                    : null;
                const requestedBudget = res.quoteResponseId == null ? res.quotedAmount : null;
                const amount = confirmedAmount ?? proposedAmount ?? requestedBudget;

                return (
                  <li key={res.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-[#2c3455]">
                        {res.vendor?.companyName ?? res.vendor?.name ?? "업체"}
                      </p>
                      <p className="text-xs text-[#8c8275]">
                        {getQuoteServiceModuleLabel({
                          eventType: plan.type,
                          serviceCategory: res.serviceCategory,
                          serviceName: res.serviceName
                        })}
                        {res.serviceDate ? ` · ${formatDate(res.serviceDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {amount != null && (
                        <span className="text-sm font-medium tabular-nums text-[#2c3455]">
                          {amount.toLocaleString()}원
                        </span>
                      )}
                      <span className="text-xs font-semibold text-[#8c8275]">{displayMeta.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* support shortcut + demoted edit/delete */}
        <footer className="flex flex-col gap-4 border-t border-[#e5e2da] pt-6">
          {(plan.type === "WEDDING" || plan.type === "FUNERAL") && (
            <Link
              href={`/plans/${plan.id}/support`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#2c3455] transition-colors hover:text-[#c4977a]"
            >
              <Layers className="h-3.5 w-3.5" />
              행사 운영 지원 도구 열기
            </Link>
          )}
          <div className="flex items-center gap-4 text-xs text-[#8c8275]">
            <Link href={`/plans/${id}/edit`} className="inline-flex items-center gap-1 transition-colors hover:text-[#2c3455]">
              <Edit className="h-3 w-3" />
              정보 수정
            </Link>
            <span className="text-[#d8d2c7]">·</span>
            <form action={deletePlanById}>
              <button type="submit" className="inline-flex items-center gap-1 transition-colors hover:text-rose-600">
                <Trash2 className="h-3 w-3" />
                행사 삭제
              </button>
            </form>
          </div>
        </footer>
      </main>
    </div>
  );
}
