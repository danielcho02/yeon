export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Plus,
  User
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { ProfileEditForm } from "@/app/vendor/dashboard/profile-edit-form";
import { getPlansWithQuoteStatus } from "@/app/actions/plan";
import { Badge } from "@/components/ui/badge";
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

const nextActionMeta: Record<PlanDashboardNextAction, { label: string; badge: string }> = {
  create_quote_request: { label: "업체 찾기", badge: "bg-gray-100 text-gray-600" },
  waiting_for_vendor: { label: "응답 대기", badge: "bg-amber-100 text-amber-700" },
  compare_quotes: { label: "견적 비교", badge: "bg-blue-100 text-blue-700" },
  accept_quote: { label: "견적 비교", badge: "bg-blue-100 text-blue-700" },
  reservation_pending: { label: "업체 확정 대기", badge: "bg-violet-100 text-violet-700" },
  confirmed: { label: "예약 확정", badge: "bg-emerald-100 text-emerald-700" },
  canceled: { label: "취소됨", badge: "bg-gray-100 text-gray-500" },
};

const roleLabels = {
  GENERAL: "일반 사용자",
  VENDOR: "업체 사용자",
  ADMIN: "관리자"
} as const;

const roleBannerStyles = {
  GENERAL: {
    gradient: "from-[#fdf8f0] via-[#fdf2e6] to-[#fce3d0]",
    border: "border-amber-200/60",
    dot: "bg-primary"
  },
  VENDOR: {
    gradient: "from-[#f0f4fa] via-[#e8edf8] to-[#d8e3f2]",
    border: "border-indigo-200/50",
    dot: "bg-indigo-700"
  },
  ADMIN: {
    gradient: "from-[#fef9c3] via-[#fef3a8] to-[#fde86e]",
    border: "border-yellow-200/60",
    dot: "bg-yellow-600"
  },
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
  const bannerStyle = roleBannerStyles[user.role] ?? roleBannerStyles.GENERAL;
  const isVendor = user.role === "VENDOR";
  const displayName = isVendor ? user.companyName ?? user.name : user.name;
  const workspaceHref = isVendor ? "/vendor/dashboard" : "/plans";
  const workspaceLabel = isVendor ? "업체 대시보드" : "내 행사 현황";
  const initial = displayName?.charAt(0) ?? "U";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* ─── Header nav ──────────────────────────────────────── */}
      <nav className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative h-8 w-[52px] overflow-hidden transition-transform duration-200 group-hover:scale-105">
            <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
          </div>
          <span className="font-[var(--font-display)] text-sm font-semibold text-foreground">YeON</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">홈</Link>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={workspaceHref}>{workspaceLabel}</Link>
          <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
        </div>
      </nav>

      {/* ─── Profile hero ────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-sm backdrop-blur">
        {/* Banner */}
        <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${bannerStyle.gradient} border-b ${bannerStyle.border}`}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 left-1/3 h-32 w-32 rounded-full bg-white/15 blur-xl" />
          <div className="pointer-events-none absolute -left-8 top-4 h-24 w-24 rounded-full bg-white/10 blur-lg" />
        </div>

        <div className="relative px-7 pb-7 pt-0 sm:px-8 sm:pb-8">
          {/* Avatar + action row */}
          <div className="-mt-11 mb-5 flex items-end justify-between">
            <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl border-[3px] border-white bg-foreground shadow-lg ring-1 ring-border/20">
              <span className="font-[var(--font-display)] text-2xl font-bold text-background">{initial}</span>
            </div>
            <div className="mb-1 flex items-center gap-2">
              <LogoutButton variant="outline" size="sm">로그아웃</LogoutButton>
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">
                {displayName}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  {roleLabels[user.role]}
                </Badge>
                <Badge className={approval.badge}>
                  <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${approval.dot}`} />
                  {approval.label}
                </Badge>
              </div>
            </div>
            <Link
              href={workspaceHref}
              className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              <LayoutDashboard className="h-4 w-4" />
              {workspaceLabel}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* ─── Profile info ──────────────────────────────────── */}
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm sm:p-7">
          <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">프로필 정보</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ProfileRow
              icon={isVendor ? Building2 : User}
              label={isVendor ? "업체명" : "이름"}
              value={displayName ?? "미입력"}
            />
            <ProfileRow icon={Mail} label="이메일" value={user.email} />
            <ProfileRow icon={Phone} label="휴대폰" value={user.phone ?? "미등록"} />
            <ProfileRow icon={MapPin} label="활동 지역" value={user.location ?? "미입력"} />
            <ProfileRow icon={BadgeCheck} label="인증 완료" value={formatDate(user.phoneVerifiedAt)} />
            <ProfileRow icon={Calendar} label="가입일" value={formatDate(user.createdAt)} />
          </div>

          {user.bio && (
            <div className="mt-5 rounded-2xl border border-border/50 bg-muted/30 p-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">소개</p>
              <p className="text-sm leading-6 text-muted-foreground">{user.bio}</p>
            </div>
          )}
        </section>

        {/* ─── Right column ──────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Status card */}
          <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
            <h2 className="mb-4 font-[var(--font-display)] text-base font-semibold text-foreground">계정 상태</h2>
            <div className="space-y-2.5">
              <StatusRow
                label="계정 유형"
                value={roleLabels[user.role]}
                done
              />
              <StatusRow
                label="본인 인증"
                value={user.phoneVerifiedAt ? "완료" : "미완료"}
                done={Boolean(user.phoneVerifiedAt)}
              />
              {user.role === "VENDOR" && (
                <StatusRow
                  label="업체 승인"
                  value={approval.label}
                  done={user.vendorApprovalStatus === "APPROVED"}
                />
              )}
            </div>
          </section>

          {/* Quick links */}
          <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
            <h2 className="mb-4 font-[var(--font-display)] text-base font-semibold text-foreground">빠른 이동</h2>
            <div className="space-y-2">
              {isVendor ? (
                <>
                  <QuickLink href="/vendor/dashboard" title="업체 대시보드" icon={LayoutDashboard} />
                  <QuickLink href="/vendor/dashboard" title="프로필/지원 범위 관리" icon={Building2} />
                </>
              ) : (
                <>
                  <QuickLink href="/plans" title="내 행사 현황" icon={CalendarDays} />
                  <QuickLink href="/plans/new" title="새 행사 만들기" icon={Plus} />
                  <QuickLink href="/vendors" title="업체 찾기" icon={Building2} />
                </>
              )}
              <QuickLink href="/" title="서비스 홈으로" icon={ArrowRight} />
            </div>
          </section>

          {/* Vendor scope (read-only) */}
          {isVendor && (() => {
            const evTypes = getVendorSupportedEventTypes({ supportedEventTypes: user.supportedEventTypes });
            const svModules = getVendorSupportedServiceModules({ supportedServiceModules: user.supportedServiceModules });
            if (evTypes.length === 0) return null;
            return (
              <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
                <h2 className="mb-4 font-[var(--font-display)] text-base font-semibold text-foreground">지원 범위</h2>
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">행사 유형</p>
                    <div className="flex flex-wrap gap-1.5">
                      {evTypes.map((et) => (
                        <span key={et} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {getEventTypeLabel(et)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {svModules.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">서비스 모듈</p>
                      <div className="flex flex-wrap gap-1.5">
                        {svModules.map((m) => (
                          <span key={m} className="rounded-full border border-border/50 bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
                            {getQuoteServiceModuleLabel({ serviceCategory: m })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}
        </div>
      </div>

      {/* ─── 프로필 편집 (VENDOR only) ──────────────────────────── */}
      {isVendor && (
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm sm:p-7">
          <h2 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">프로필 편집</h2>
          <ProfileEditForm
            defaultCompanyName={user.companyName ?? ""}
            defaultBio={user.bio ?? ""}
            defaultLocation={user.location ?? ""}
            initialEventTypes={getVendorSupportedEventTypes({ supportedEventTypes: user.supportedEventTypes })}
            initialServiceModules={getVendorSupportedServiceModules({ supportedServiceModules: user.supportedServiceModules })}
          />
        </section>
      )}

      {/* ─── 내 행사 현황 ─────────────────────────────────── */}
      {!isVendor && (
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-foreground">내 행사 현황</h2>
            <Link href="/plans" className="text-xs font-semibold text-primary hover:underline">
              전체 보기 →
            </Link>
          </div>
          {plans.length === 0 ? (
            <div className="py-6 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                아직 행사 플랜이 없습니다.
              </p>
              <Link href="/plans/new" className={buttonVariants({ variant: "default", size: "sm" })}>
                <Plus className="mr-1.5 h-4 w-4" />
                첫 행사 만들기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.slice(0, 3).map((plan) => {
                const isWedding = plan.eventType === "WEDDING";
                const href = `/planner/${isWedding ? "wedding" : "funeral"}?planId=${plan.id}`;
                const meta = nextActionMeta[plan.summary.nextAction];
                return (
                  <Link
                    key={plan.id}
                    href={href}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-white/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {plan.title ?? "(제목 없음)"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isWedding ? "웨딩" : "장례"}
                        {plan.eventDate ? ` · ${formatDate(plan.eventDate)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-white/70 px-4 py-3.5 transition-all duration-200 hover:border-border/70 hover:bg-white">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/55">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StatusRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-white/70 px-4 py-3 transition-all duration-200 hover:bg-white/90">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-semibold ${done ? "text-emerald-600" : "text-muted-foreground"}`}>{value}</span>
        {done && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
      </div>
    </div>
  );
}

function QuickLink({ href, title, icon: Icon }: { href: string; title: string; icon: typeof ArrowRight }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-border/40 bg-white/70 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
