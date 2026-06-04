export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Plus
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileEditForm } from "@/app/vendor/dashboard/profile-edit-form";
import { getPlansWithQuoteStatus } from "@/app/actions/plan";
import { buttonVariants } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getVendorSupportedEventTypes,
  getVendorSupportedServiceModules
} from "@/lib/step3.shared";
import type { PlanDashboardNextAction } from "@/types/plan";

const nextActionMeta: Record<PlanDashboardNextAction, { label: string }> = {
  create_quote_request: { label: "업체 찾기" },
  waiting_for_vendor: { label: "응답 대기" },
  compare_quotes: { label: "견적 비교" },
  accept_quote: { label: "견적 비교" },
  adjustment_requested: { label: "조정 요청 중" },
  revised_quote_received: { label: "수정 제안 도착" },
  reservation_pending: { label: "업체 확정 대기" },
  confirmed: { label: "예약 확정" },
  canceled: { label: "취소됨" },
};

const roleLabels = {
  GENERAL: "일반 사용자",
  VENDOR: "업체 사용자",
  ADMIN: "관리자"
} as const;

const approvalMeta = {
  NOT_APPLICABLE: {
    label: "인증 완료",
    badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "승인 대기",
    badge: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "승인 완료",
    badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "승인 거절",
    badge: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    dot: "bg-rose-500",
  }
} as const;

export default async function AccountPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      role: true,
      phone: true,
      companyName: true,
      location: true,
      bio: true,
      createdAt: true,
      phoneVerifiedAt: true,
      vendorApprovalStatus: true,
      supportedEventTypes: true,
      supportedServiceModules: true
    }
  });

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  const plansResult = user.role === "GENERAL" ? await getPlansWithQuoteStatus() : null;
  const plans = plansResult?.success ? plansResult.data : [];

  const approval = approvalMeta[user.vendorApprovalStatus];
  const isVendor = user.role === "VENDOR";
  const displayName = isVendor ? user.companyName ?? user.name : user.name;
  const workspaceHref = isVendor ? "/vendor/dashboard" : "/plans";
  const workspaceLabel = isVendor ? "업체 대시보드" : "내 행사 현황";
  const initial = displayName?.charAt(0) ?? "U";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 bg-[#faf9f5] px-6 py-10 text-[#2c3455] sm:px-8 lg:py-14">
      {/* ─── Header nav ──────────────────────────────────────── */}
      <nav className="flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative h-8 w-[52px] overflow-hidden transition-transform duration-200 group-hover:scale-105">
            <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
          </div>
          <span className="font-[var(--font-display)] text-sm font-semibold text-[#2c3455]">YeON</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">홈</Link>
          <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
        </div>
      </nav>

      {/* ─── Clean identity header ───────────────────────────── */}
      <header className="flex flex-col gap-6 border-b border-[#e5e2da] pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2c3455]">
            <span className="font-[var(--font-serif)] text-xl font-normal text-white">{initial}</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8c8275]">
              {roleLabels[user.role]}
            </p>
            <h1 className="mt-1 font-[var(--font-serif)] text-2xl font-normal tracking-tight text-[#2c3455] sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-0.5 text-sm text-[#8c8275]">{user.email}</p>
          </div>
        </div>
        <Link
          href={workspaceHref}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2c3455] px-5 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5"
        >
          <LayoutDashboard className="h-4 w-4" />
          {workspaceLabel}
        </Link>
      </header>

      {/* ─── Profile info ──────────────────────────────────── */}
      <Section title="프로필 정보">
        <dl className="divide-y divide-[#ece7df]">
          <KeyValue label={isVendor ? "업체명" : "이름"} value={displayName ?? "미입력"} />
          <KeyValue label="이메일" value={user.email} />
          <KeyValue label="휴대폰" value={user.phone ?? "미등록"} />
          <KeyValue label="활동 지역" value={user.location ?? "미입력"} />
          <KeyValue label="본인 인증" value={user.phoneVerifiedAt ? formatDate(user.phoneVerifiedAt) : "미완료"} />
          <KeyValue label="가입일" value={formatDate(user.createdAt)} />
        </dl>
        {user.bio && (
          <div className="mt-5 border-l-2 border-[#ebdccf] pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">소개</p>
            <p className="mt-1.5 text-sm leading-7 text-[#6b6357]">{user.bio}</p>
          </div>
        )}
      </Section>

      {/* ─── Account status ──────────────────────────────────── */}
      <Section title="계정 상태">
        <dl className="divide-y divide-[#ece7df]">
          <KeyValue label="계정 유형" value={roleLabels[user.role]} />
          <KeyValue label="본인 인증" value={user.phoneVerifiedAt ? "완료" : "미완료"} done={Boolean(user.phoneVerifiedAt)} />
          {user.role === "VENDOR" && (
            <KeyValue label="업체 승인" value={approval.label} done={user.vendorApprovalStatus === "APPROVED"} />
          )}
        </dl>
      </Section>

      {/* ─── Vendor scope (read-only) ────────────────────────── */}
      {isVendor && (() => {
        const evTypes = getVendorSupportedEventTypes({ supportedEventTypes: user.supportedEventTypes });
        const svModules = getVendorSupportedServiceModules({ supportedServiceModules: user.supportedServiceModules });
        if (evTypes.length === 0) return null;
        return (
          <Section title="지원 범위">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">행사 유형</p>
                <p className="text-sm text-[#2c3455]">{evTypes.map((et) => getEventTypeLabel(et)).join(" · ")}</p>
              </div>
              {svModules.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">서비스 모듈</p>
                  <p className="text-sm leading-6 text-[#6b6357]">
                    {svModules.map((m) => getQuoteServiceModuleLabel({ serviceCategory: m })).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          </Section>
        );
      })()}

      {/* ─── Quick links ─────────────────────────────────────── */}
      <Section title="빠른 이동">
        <div className="divide-y divide-[#ece7df]">
          {isVendor ? (
            <>
              <QuickLink href="/vendor/dashboard" title="업체 대시보드" icon={LayoutDashboard} />
              <QuickLink href="/vendor/dashboard" title="프로필 / 지원 범위 관리" icon={Building2} />
            </>
          ) : (
            <>
              <QuickLink href="/plans" title="내 행사 현황" icon={CalendarDays} />
              <QuickLink href="/planner?create=1" title="새 행사 만들기" icon={Plus} />
              <QuickLink href="/vendors" title="업체 찾기" icon={Building2} />
            </>
          )}
          <QuickLink href="/" title="서비스 홈으로" icon={ArrowRight} />
        </div>
      </Section>

      {/* ─── 프로필 편집 (VENDOR only) ──────────────────────────── */}
      {isVendor && (
        <Section title="프로필 편집">
          <ProfileEditForm
            defaultCompanyName={user.companyName ?? ""}
            defaultBio={user.bio ?? ""}
            defaultLocation={user.location ?? ""}
            initialEventTypes={getVendorSupportedEventTypes({ supportedEventTypes: user.supportedEventTypes })}
            initialServiceModules={getVendorSupportedServiceModules({ supportedServiceModules: user.supportedServiceModules })}
          />
        </Section>
      )}

      {/* ─── 내 행사 현황 ─────────────────────────────────── */}
      {!isVendor && (
        <Section
          title="내 행사 현황"
          action={<Link href="/plans" className="text-xs font-semibold text-[#c4977a] transition-colors hover:text-[#b08569]">전체 보기 →</Link>}
        >
          {plans.length === 0 ? (
            <div className="py-2">
              <p className="mb-4 text-sm text-[#8c8275]">아직 행사 플랜이 없습니다.</p>
              <Link href="/planner?create=1" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#2c3455] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1e2645]">
                <Plus className="h-4 w-4" />
                첫 행사 만들기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#ece7df]">
              {plans.slice(0, 3).map((plan) => {
                const isWedding = plan.eventType === "WEDDING";
                const href = `/planner/${isWedding ? "wedding" : "funeral"}?planId=${plan.id}`;
                const meta = nextActionMeta[plan.summary.nextAction];
                return (
                  <li key={plan.id}>
                    <Link href={href} className="flex items-center justify-between gap-3 py-3.5 transition-colors duration-150 hover:text-[#c4977a]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#2c3455]">{plan.title ?? "(제목 없음)"}</p>
                        <p className="mt-0.5 text-xs text-[#8c8275]">
                          {isWedding ? "웨딩" : "장례"}
                          {plan.eventDate ? ` · ${formatDate(plan.eventDate)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[#8c8275]">{meta.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </main>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-xs text-[#8c8275]">{label}</dt>
      <dd className="flex items-center gap-1.5 text-sm font-medium text-[#2c3455]">
        <span className={done ? "text-[#5b8a6b]" : ""}>{value}</span>
        {done && <BadgeCheck className="h-3.5 w-3.5 text-[#5b8a6b]" />}
      </dd>
    </div>
  );
}

function QuickLink({ href, title, icon: Icon }: { href: string; title: string; icon: typeof ArrowRight }) {
  return (
    <Link href={href} className="group flex items-center justify-between py-3.5 transition-colors duration-150 hover:text-[#c4977a]">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-[#8c8275]" />
        <span className="text-sm font-semibold text-[#2c3455]">{title}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-[#8c8275] transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}
