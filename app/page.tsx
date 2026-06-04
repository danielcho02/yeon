export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  Heart,
  HeartHandshake,
  Shield,
  Sparkles,
  Users
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  AnimatedSectionHeader,
  AnimatedCardGrid,
  AnimatedStepGrid,
  AnimatedHeroContent,
} from "@/components/features/landing/animated-section";

export default async function HomePage() {
  const session = await getServerAuthSession();
  const isLoggedIn = Boolean(session?.user?.id);
  const isVendor = session?.user?.role === "VENDOR";
  const hasPlannerSession =
    isLoggedIn && !isVendor
      ? (await withPrismaRetry(() =>
          prisma.eventPlan.count({
            where: {
              ownerId: session!.user.id,
              type: { in: ["WEDDING", "FUNERAL"] }
            }
          })
        )) > 0
      : false;
  const defaultWorkspaceHref = isVendor ? "/vendor/dashboard" : "/plans";
  const weddingHref = !isLoggedIn
    ? "/login?callbackUrl=/planner/wedding"
    : isVendor
      ? "/vendor/dashboard"
      : "/planner/wedding";
  const funeralHref = !isLoggedIn
    ? "/login?callbackUrl=/planner/funeral"
    : isVendor
      ? "/vendor/dashboard"
      : "/planner/funeral";
  const publicVendorHref = isVendor ? "/vendor/dashboard" : "/vendors";
  const primaryHeroHref = isLoggedIn
    ? isVendor
      ? "/vendor/dashboard"
      : hasPlannerSession
        ? "/plans"
        : "/planner"
    : "/signup";
  const primaryHeroLabel = isLoggedIn
    ? isVendor
      ? "업체 대시보드로 이동"
      : hasPlannerSession
        ? "이어서 준비하기"
        : "행사 유형 선택하기"
    : "컨시어지 시작하기";
  const heroSubcopy = isLoggedIn && !isVendor && hasPlannerSession
    ? "이전에 만들던 행사와 파트너 조율 현황이 준비되어 있습니다.\n지금 바로 이어서 확인해 보세요."
    : "yeON이 준비하신 플랜의 가장 알맞은 기본 구성을 먼저 정리해 드립니다.\n과밀한 조립 대신, 품격 있는 컨시어지 서비스처럼 확인만 해보세요.";
  const plannerRoleHref = isLoggedIn ? (isVendor ? "/vendor/dashboard" : hasPlannerSession ? "/plans" : "/planner") : "/login?callbackUrl=/plans";
  const plannerRoleCta = isLoggedIn && !isVendor && hasPlannerSession ? "내 행사 보기" : "내 플랜 준비하기";

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c3455] selection:bg-[#ebdccf] selection:text-[#2c3455]">
      {/* ─── Sticky Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#e5e2da] bg-[#faf9f5]/85 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-7 w-[46px] overflow-hidden transition-opacity duration-150 group-hover:opacity-85">
              <Image src="/yeon-logo.png" alt="YeON" fill sizes="46px" priority className="object-contain" />
            </div>
            <div className="leading-none">
              <p className="text-[9px] uppercase tracking-[0.35em] text-[#8c8275] font-semibold">YeON</p>
              <p className="font-[var(--font-serif)] text-xs font-bold text-[#2c3455] mt-0.5">사람과 마음을 잇다</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {!isVendor && (
              <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-xs font-medium text-[#2c3455] hover:text-[#c4977a] hover:bg-transparent"} href="/vendors">업체 찾기</Link>
            )}
            {isLoggedIn ? (
              <>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-xs font-medium text-[#2c3455] hover:text-[#c4977a] hover:bg-transparent"} href={defaultWorkspaceHref}>
                  {isVendor ? "업체 대시보드" : "내 플랜"}
                </Link>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-xs font-medium text-[#2c3455] hover:text-[#c4977a] hover:bg-transparent"} href="/account">계정</Link>
                <LogoutButton size="sm" variant="ghost" className="text-xs font-medium text-[#2c3455] hover:text-[#c4977a] hover:bg-transparent">로그아웃</LogoutButton>
              </>
            ) : (
              <>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-xs font-medium text-[#2c3455] hover:text-[#c4977a] hover:bg-transparent"} href="/login">로그인</Link>
                <Link className="inline-flex h-8 items-center justify-center rounded-xl bg-[#2c3455] px-4 text-xs font-semibold text-white transition-[transform,background-color] duration-150 hover:bg-[#1e2645] active:scale-[0.98]" href="/signup">시작하기</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ─── Hero (Quiet Luxury Spacious Banner) ─────────────────── */}
        <section className="relative flex min-h-[92vh] flex-col items-center justify-center px-6 text-center bg-[#faf9f5] border-b border-[#e5e2da]">
          {/* Subtle geometric line art background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, #2c3455 1px, transparent 1px), linear-gradient(to bottom, #2c3455 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
          
          {/* Logo - Elegant & Compact */}
          <div className="relative z-10 mb-8 transition-opacity duration-500 hover:opacity-95">
            <Image
              src="/yeon-logo.png"
              alt="YeON"
              width={180}
              height={110}
              priority
              className="w-[140px] sm:w-[160px] lg:w-[180px] h-auto object-contain mx-auto"
            />
          </div>

          {/* Chinese Character Emblem */}
          <div className="relative z-10 mb-5 flex flex-col items-center gap-1">
            <p className="text-4xl font-light tracking-[0.1em] text-[#2c3455] sm:text-5xl font-[var(--font-serif)]">
              緣
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.6em] text-[#8c8275] mt-1">
              YeON
            </p>
          </div>

          {/* Main Copy */}
          <AnimatedHeroContent>
            <div className="relative z-10 mb-6 max-w-2xl mx-auto">
              <h1 className="text-3xl font-normal leading-[1.35] tracking-tight text-[#2c3455] sm:text-4xl lg:text-[2.75rem] font-[var(--font-serif)]">
                중요한 순간을<br />
                더 차분하고 정확하게 준비합니다
              </h1>
            </div>

            {/* Sub Copy */}
            <p className="relative z-10 mb-10 max-w-md mx-auto text-xs leading-relaxed text-[#8c8275] sm:text-sm">
              {heroSubcopy.split("\n")[0]}<br className="hidden sm:block" />
              {heroSubcopy.split("\n")[1]}
            </p>

            {/* CTA Buttons */}
            <div className="relative z-10 mb-12 flex items-center justify-center gap-3">
              <Link
                href={primaryHeroHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2c3455] px-6 text-xs font-bold text-white transition-[transform,background-color] duration-150 hover:bg-[#1e2645] active:scale-[0.98] shadow-sm"
              >
                {primaryHeroLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={publicVendorHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e5e2da] bg-white/50 px-6 text-xs font-semibold text-[#2c3455] backdrop-blur-sm transition-[transform,background-color,border-color] duration-150 hover:bg-white hover:border-[#8c8275] active:scale-[0.98]"
              >
                파트너 목록 보기
              </Link>
            </div>
          </AnimatedHeroContent>

          {/* Minimal scroll indicator */}
          <div className="relative z-10 text-[#8c8275]/40 animate-pulse">
            <ChevronDown className="h-4 w-4" />
          </div>
        </section>

        {/* ─── Feature Cards ───────────────────────────────────── */}
        <section className="relative bg-[#fcfbf9] py-24 border-b border-[#e5e2da]">
          <div className="mx-auto max-w-5xl px-6">
            <AnimatedSectionHeader eyebrow="Curated Services" title="소중한 순간을 위한 정밀한 설계" center />
            <AnimatedCardGrid>
              {[
                <FeatureCard key="plan" index="01" title="맞춤 행사 관리" description="결혼·장례의 전반적인 구도를 설계하고 yeON이 준비한 엄격한 가이드라인을 따라 차분하게 진행 상황을 파악합니다." href={isLoggedIn ? defaultWorkspaceHref : "/login?callbackUrl=/plans"} />,
                <FeatureCard key="money" index="02" title="투명한 일정 관리" description="파트너사와의 조율 일정과 최종 예약 상태를 한 번에 검토하고 복잡한 서류나 기입 절차 없이 안전하게 체크합니다." href={isLoggedIn ? defaultWorkspaceHref : "/login?callbackUrl=/plans"} />,
                <FeatureCard key="vendor" index="03" title="엄선된 파트너십" description="yeON의 심사 기준을 거친 검증된 의전/웨딩 파트너와만 소통하여 격식 있고 무결한 서비스를 안심하고 제안받습니다." href={publicVendorHref} />,
              ]}
            </AnimatedCardGrid>
          </div>
        </section>

        {/* ─── Event Type Selection ─────────────────────────────── */}
        <section className="bg-[#faf9f5] py-24 border-b border-[#e5e2da]">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-14">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[#8c8275]">Planning Route</p>
              <h2 className="font-[var(--font-serif)] text-2xl font-normal text-[#2c3455] sm:text-3xl">
                어떤 의례를 준비하시나요?
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Wedding card */}
              <Link
                href={weddingHref}
                className="group relative overflow-hidden rounded-2xl border border-[#ebdccf] bg-[#faf9f5] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#c4977a] hover:shadow-[0_8px_32px_rgba(196,151,122,0.06)]"
              >
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#ebdccf] transition-colors group-hover:bg-[#c4977a]" />
                <div className="relative p-8 sm:p-10">
                  <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fcf8f2] border border-[#ebdccf]/50 text-[#c4977a]">
                    <Heart className="h-4 w-4" />
                  </div>
                  <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-[#c4977a]">Wedding Ceremony</p>
                  <h3 className="mb-3 font-[var(--font-serif)] text-xl font-bold text-[#2c3455]">결혼 준비</h3>
                  <p className="mb-8 text-xs leading-relaxed text-[#8c8275]">
                    정제된 웨딩 아키텍처와 엄선된 공간 대관, 식대 패키지 구성까지 번잡한 조립 없이 아름다운 하루를 준비합니다.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#c4977a] transition-[gap] duration-200 group-hover:gap-3">
                    결혼 플래닝 시작하기
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>

              {/* Funeral card */}
              <Link
                href={funeralHref}
                className="group relative overflow-hidden rounded-2xl border border-[#cbd3e0] bg-[#faf9f5] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#2c3455] hover:shadow-[0_8px_32px_rgba(44,52,85,0.04)]"
              >
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#cbd3e0] transition-colors group-hover:bg-[#2c3455]" />
                <div className="relative p-8 sm:p-10">
                  <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2f6] border border-[#cbd3e0] text-[#2c3455]">
                    <Shield className="h-4 w-4" />
                  </div>
                  <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-[#8c8275]">Funeral Service</p>
                  <h3 className="mb-3 font-[var(--font-serif)] text-xl font-bold text-[#2c3455]">장례 의전</h3>
                  <p className="mb-8 text-xs leading-relaxed text-[#8c8275]">
                    차분하고 안정적인 준비 가이드와 엄숙한 파트너 연결을 통해 소중한 마무리를 경건하고 세심하게 안내합니다.
                  </p>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#2c3455] transition-[gap] duration-200 group-hover:gap-3">
                    장례 의전 안내받기
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── How it works ────────────────────────────────────── */}
        <section className="bg-[#fcfbf9] py-24 border-b border-[#e5e2da]">
          <div className="mx-auto max-w-5xl px-6">
            <AnimatedSectionHeader eyebrow="Process Flow" title="yeON의 3단계 기본 프로세스" center className="mb-16" />
            <AnimatedStepGrid>
              {[
                <FlowStep key="01" step="01" icon={Sparkles} title="기본 구성 준비" description="규모와 예산을 기반으로 yeON이 플랜의 적합한 기본 추천 구성을 자동 설계합니다." color="#c4977a" />,
                <FlowStep key="02" step="02" icon={HeartHandshake} title="필요 항목 확인" description="제안된 기본 항목 중 고객님께 필요한 파트너 옵션만 가볍게 검토하고 견적을 요청합니다." color="#2c3455" />,
                <FlowStep key="03" step="03" icon={BadgeCheck} title="최종 확정 대기" description="도도하게 조율된 파트너사의 최적 금액을 확인하여 최종 예약을 안심하고 매듭짓습니다." color="#0f9652" />,
              ]}
            </AnimatedStepGrid>
          </div>
        </section>

        {/* ─── For whom ────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 py-24">
          <AnimatedSectionHeader eyebrow="Platform Roles" title="서로 다른 여정을 위한 최적의 도구" />

          <div className="grid gap-6 sm:grid-cols-2">
            <RoleCard
              icon={Users}
              role="일반 사용자"
              title="격식 있는 예식을 앞두신 분"
              items={["yeON이 조율한 기본 추천 구성 확인", "원하는 파트너를 향한 정중한 제안 요청", "총액 및 옵션의 일관된 비교 검토", "업체 최종 승인 후 예약 완료"]}
              href={plannerRoleHref}
              ctaText={plannerRoleCta}
              colorScheme="primary"
            />
            <RoleCard
              icon={Building2}
              role="의전/웨딩 파트너"
              title="최고의 서비스를 선사할 업체"
              items={["예식/의전 견적 제안 수신 및 관리", "가용 일정 및 맞춤 제안 금액 회신", "사용자 수락 시 최상단 확정 대기 큐 배치", "예약 최종 확정 및 행사 완결 관리"]}
              href={isLoggedIn ? defaultWorkspaceHref : "/signup"}
              ctaText="파트너 신청하기"
              colorScheme="neutral"
            />
          </div>
        </section>

        {/* ─── Demo accounts (Subtle and integrated) ───────────────────── */}
        <section className="border-t border-[#e5e2da] bg-[#2c3455] py-14 text-white">
          <div className="mx-auto max-w-5xl px-6">
            <div className="flex flex-wrap items-center justify-between gap-8">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#ebdccf] uppercase tracking-wider">Demo Sandbox</p>
                <h4 className="text-sm font-bold text-[#faf9f5]">데모 환경 즉시 테스트</h4>
                <p className="text-xs text-white/50">공통 패스워드: <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#faf9f5]/90">demo1234</code></p>
              </div>
              <div className="flex flex-wrap gap-3">
                <DemoChip role="일반 사용자" email="planner@yeon.local" />
                <DemoChip role="웨딩 파트너" email="venue@yeon.local" />
                <DemoChip role="장례 파트너" email="memorial@yeon.local" />
              </div>
              <div className="flex items-center gap-3">
                {isLoggedIn ? (
                  <Link className="inline-flex h-9 items-center justify-center rounded-xl bg-white/10 border border-white/20 px-4 text-xs font-semibold text-white transition-[background-color,border-color] hover:bg-white/20" href={defaultWorkspaceHref}>
                    {isVendor ? "업체 대시보드" : "내 플랜 확인"}
                  </Link>
                ) : (
                  <>
                    <Link className="text-xs font-semibold text-white/75 hover:text-white transition-colors" href="/login">로그인</Link>
                    <Link href="/signup" className="inline-flex h-9 items-center justify-center rounded-xl bg-[#faf9f5] px-4 text-xs font-semibold text-[#2c3455] transition-[transform,background-color] hover:bg-white active:scale-[0.98]">
                      무료 체험
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-[#e5e2da] bg-[#faf9f5] py-12">
          <div className="mx-auto max-w-5xl px-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="relative h-7 w-[46px] overflow-hidden">
                  <Image src="/yeon-logo.png" alt="YeON" fill sizes="46px" className="object-contain opacity-75" />
                </div>
                <div className="leading-none">
                  <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">YeON</p>
                  <p className="text-[10px] text-[#8c8275]">사람과 마음을 잇다</p>
                </div>
              </div>
              <p className="text-xs text-[#8c8275]/60">© 2026 YeON. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ index, title, description, href }: { index: string; title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl bg-white border border-[#e5e2da] p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#ebdccf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.015)]"
    >
      <span className="font-mono text-[10px] font-bold text-[#c4977a] tracking-widest">{index}</span>
      <h3 className="mt-4 mb-2 font-[var(--font-serif)] text-base font-bold text-[#2c3455]">{title}</h3>
      <p className="text-xs leading-relaxed text-[#8c8275]">{description}</p>
    </Link>
  );
}

function FlowStep({
  step,
  icon: Icon,
  title,
  description,
  color
}: {
  step: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="relative flex flex-col items-center text-center px-4">
      <div 
        className="relative mb-5 flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border border-[#ebdccf]/40 bg-[#fdfcf9] shadow-sm transition-transform duration-200 hover:scale-102"
        style={{ borderColor: `${color}15` }}
      >
        <span className="font-mono text-[9px] font-extrabold tracking-widest text-[#8c8275]/40">{step}</span>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <h3 className="mb-2 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">{title}</h3>
      <p className="text-xs leading-relaxed text-[#8c8275]">{description}</p>
    </div>
  );
}

function RoleCard({
  icon: Icon,
  role,
  title,
  items,
  href,
  ctaText,
  colorScheme
}: {
  icon: typeof Users;
  role: string;
  title: string;
  items: string[];
  href: string;
  ctaText: string;
  colorScheme: "primary" | "neutral";
}) {
  const scheme = {
    primary: {
      iconWrap: "bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/60",
      badge: "bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/40 hover:bg-[#fcf8f2]",
      dot: "bg-[#ebdccf]",
      border: "hover:border-[#ebdccf]/80",
      btn: "bg-[#2c3455] text-white hover:bg-[#1e2645]"
    },
    neutral: {
      iconWrap: "bg-[#eef2f6] text-[#2c3455] border border-[#cbd3e0]",
      badge: "bg-[#eef2f6] text-[#2c3455] border border-[#cbd3e0] hover:bg-[#eef2f6]",
      dot: "bg-[#cbd3e0]",
      border: "hover:border-[#cbd3e0]",
      btn: "border border-[#475569] bg-[#475569] text-white hover:bg-[#334155]"
    }
  }[colorScheme];

  return (
    <div className={`group flex flex-col rounded-2xl border border-[#e5e2da] bg-white p-7 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md ${scheme.border}`}>
      <div className={`mb-4 inline-flex w-fit rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-103 ${scheme.iconWrap}`}>
        <Icon className="h-4 w-4" />
      </div>
      <Badge className={`mb-3 w-fit text-[9px] font-bold tracking-wider ${scheme.badge}`}>{role}</Badge>
      <h3 className="mb-4 font-[var(--font-serif)] text-base font-bold text-[#2c3455]">{title}</h3>
      <ul className="mb-8 flex-1 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-[#8c8275]">
            <span className={`h-1 w-1 shrink-0 rounded-full ${scheme.dot}`} />
            {item}
          </li>
        ))}
      </ul>
      <Link href={href} className={`${buttonVariants({ size: "sm" })} ${scheme.btn} rounded-xl h-9 text-xs font-semibold`}>
        {ctaText}
        <ArrowRight className="ml-1.5 h-3 w-3" />
      </Link>
    </div>
  );
}

function DemoChip({ role, email }: { role: string; email: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur-sm transition-[background-color,border-color] duration-150 hover:border-white/12 hover:bg-white/10">
      <p className="text-[10px] font-bold text-white/80">{role}</p>
      <p className="mt-0.5 font-mono text-[9px] text-white/35">{email}</p>
    </div>
  );
}
