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

  return (
    <div className="min-h-screen">
      {/* ─── Sticky Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/50 bg-white/88 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-8 w-[52px] overflow-hidden transition-transform duration-200 group-hover:scale-105">
              <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
            </div>
            <div className="leading-none">
              <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">YeON</p>
              <p className="font-[var(--font-display)] text-sm font-semibold text-foreground">사람과 마음을 잇다</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5">
            {!isVendor && (
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/vendors">업체 찾기</Link>
            )}
            {isLoggedIn ? (
              <>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={defaultWorkspaceHref}>
                  {isVendor ? "업체 대시보드" : "내 플랜"}
                </Link>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/account">계정</Link>
                <LogoutButton size="sm" variant="ghost">로그아웃</LogoutButton>
              </>
            ) : (
              <>
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/login">로그인</Link>
                <Link className={buttonVariants({ variant: "default", size: "sm" })} href="/signup">시작하기</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ─── Hero (100vh) ────────────────────────────────────── */}
        <section
          className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
          style={{
            background: "radial-gradient(ellipse at 20% 20%, #F7EFE5 0%, transparent 52%), radial-gradient(ellipse at 80% 80%, #2C3455 0%, transparent 52%), linear-gradient(135deg, #F7EFE5 0%, #e8ddd0 28%, #3a4468 68%, #2C3455 100%)"
          }}
        >
          {/* Soft ambient orbs behind logo */}
          <div
            className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 h-[480px] w-[640px] opacity-20"
            style={{
              background: "radial-gradient(ellipse 60% 40% at 50% 50%, #F7EFE5 0%, rgba(196,151,122,0.4) 40%, transparent 70%)"
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 h-[360px] w-[500px] opacity-15"
            style={{
              background: "radial-gradient(ellipse 55% 35% at 50% 50%, #2C3455 0%, transparent 65%)"
            }}
          />

          {/* ── Logo ── */}
          <div className="relative z-10 mb-6 animate-logo-entrance">
            <Image
              src="/yeon-logo.png"
              alt="YeON"
              width={340}
              height={207}
              priority
              className="animate-logo-float animate-logo-glow w-[220px] sm:w-[290px] lg:w-[340px] h-auto"
            />
          </div>

          {/* Brand name */}
          <div className="relative z-10 mb-7 animate-fade-in delay-300 flex flex-col items-center gap-1">
            <p
              className="text-5xl font-bold tracking-[0.06em] text-white/95 sm:text-6xl"
              style={{ fontFamily: "var(--font-serif)", textShadow: "0 2px 24px rgba(44,52,85,0.5)" }}
            >
              緣
            </p>
            <p className="font-[var(--font-display)] text-[11px] font-bold uppercase tracking-[0.5em] text-white/50">
              YeON
            </p>
          </div>

          {/* Main copy */}
          <AnimatedHeroContent>
            <div className="relative z-10 mb-6 max-w-xl">
              <h1
                className="text-3xl font-bold leading-[1.3] tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem]"
                style={{ fontFamily: "var(--font-serif)", textShadow: "0 4px 24px rgba(44,52,85,0.4)" }}
              >
                결혼, 장례,<br />
                모든 경조사의<br />
                시작과 끝을 함께합니다
              </h1>
            </div>

            {/* Sub copy */}
            <p className="relative z-10 mb-10 max-w-sm text-sm leading-7 text-white/60 sm:text-base sm:max-w-md">
              AI 추천부터 업체 연결·예약 확정까지,
              하나의 플랫폼에서 경조사를 완성하세요.
            </p>

            {/* CTA buttons */}
            <div className="relative z-10 mb-16 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={isLoggedIn ? defaultWorkspaceHref : "/signup"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-7 text-sm font-semibold transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
              style={{ background: "#C4977A", color: "#fff", boxShadow: "0 16px 40px -12px rgba(196,151,122,0.7)" }}
            >
              시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={publicVendorHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:bg-white/20 active:translate-y-0"
            >
              더 알아보기
            </Link>
          </div>
          </AnimatedHeroContent>

          {/* Scroll cue */}
          <div className="relative z-10 animate-bounce text-white/35">
            <ChevronDown className="h-5 w-5" />
          </div>
        </section>

        {/* ─── Feature Cards ───────────────────────────────────── */}
        <section className="relative bg-background py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSectionHeader eyebrow="Services" title="경조사의 모든 것을 한 곳에서" center />
            <AnimatedCardGrid>
              {[
                <FeatureCard key="plan" emoji="🎊" title="행사 관리" description="결혼·장례 일정을 한 곳에서 체계적으로 관리하세요." href={isLoggedIn ? defaultWorkspaceHref : "/login?callbackUrl=/plans"} />,
                <FeatureCard key="money" emoji="💸" title="축의금·부의금" description="투명한 금전 관리로 경조사 예산을 한눈에 파악하세요." href={isLoggedIn ? defaultWorkspaceHref : "/login?callbackUrl=/plans"} />,
                <FeatureCard key="vendor" emoji="🏢" title="업체 연결" description="검증된 업체와 바로 연결하고 견적을 요청하세요." href={publicVendorHref} />,
              ]}
            </AnimatedCardGrid>
          </div>
        </section>

        {/* ─── Event type selection ─────────────────────────────── */}
        <section className="border-y border-border/40 bg-white/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/55">Get Started</p>
              <h2 className="font-[var(--font-display)] text-3xl font-bold text-foreground sm:text-4xl">
                어떤 경조사를 준비하시나요?
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Wedding card */}
              <Link
                href={weddingHref}
                className="group relative overflow-hidden rounded-[2.5rem] border border-amber-200/70 shadow-sm shadow-amber-100/40 transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-rose-200/40"
              >
                <div className="absolute inset-0 surface-wedding" />
                <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-rose-200/40 blur-3xl transition-all duration-500 group-hover:scale-150 group-hover:bg-rose-200/60" />
                <div className="pointer-events-none absolute -bottom-6 left-8 h-28 w-28 rounded-full bg-amber-200/30 blur-2xl" />

                <div className="relative p-8 sm:p-10">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 shadow-lg shadow-rose-300/50 transition-all duration-300 group-hover:scale-110">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                  <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-rose-500/80">Wedding 💍</p>
                  <h2 className="mb-3 font-[var(--font-display)] text-3xl font-bold text-foreground">결혼 준비</h2>
                  <p className="mb-7 text-sm leading-6 text-rose-900/50">
                    따뜻한 웨딩 컨셉부터 예식장·케이터링·촬영까지<br className="hidden sm:block" />
                    설레는 하루를 함께 만들어 드립니다.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 transition-all duration-200 group-hover:gap-3.5">
                    결혼 준비 시작하기
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>

              {/* Funeral card */}
              <Link
                href={funeralHref}
                className="group relative overflow-hidden rounded-[2.5rem] border border-indigo-200/60 shadow-sm shadow-indigo-100/30 transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-indigo-200/30"
              >
                <div className="absolute inset-0 surface-funeral" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-indigo-300/30 blur-3xl transition-all duration-500 group-hover:scale-150 group-hover:bg-indigo-300/50" />
                <div className="pointer-events-none absolute -bottom-6 left-8 h-28 w-28 rounded-full bg-slate-200/40 blur-2xl" />

                <div className="relative p-8 sm:p-10">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-900 shadow-lg shadow-indigo-400/30 transition-all duration-300 group-hover:scale-110">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-indigo-400/80">Funeral 🕯️</p>
                  <h2 className="mb-3 font-[var(--font-display)] text-3xl font-bold text-foreground">장례 준비</h2>
                  <p className="mb-7 text-sm leading-6 text-indigo-900/50">
                    단계별 안내와 신뢰 있는 업체 연결로<br className="hidden sm:block" />
                    소중한 마무리를 함께 준비합니다.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 transition-all duration-200 group-hover:gap-3.5">
                    장례 준비 안내받기
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── How it works ────────────────────────────────────── */}
        <section className="bg-white/60 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimatedSectionHeader eyebrow="How it works" title="세 단계로 완성하는 준비" center className="mb-14" />
            <AnimatedStepGrid>
              {[
                <FlowStep key="01" step="01" icon={Sparkles} title="행사 정보 + AI 추천" description="행사 규모, 지역, 예산을 입력하면 AI가 최적 컨셉과 준비 타임라인을 제안합니다." accent="rose" />,
                <FlowStep key="02" step="02" icon={HeartHandshake} title="업체에 견적 요청" description="추천 업체 목록에서 필요한 곳을 선택해 견적 요청을 한 번에 보냅니다." accent="primary" />,
                <FlowStep key="03" step="03" icon={BadgeCheck} title="제안 비교 + 확정" description="받은 제안을 비교하고 최적의 업체를 선택해 예약을 확정합니다." accent="emerald" />,
              ]}
            </AnimatedStepGrid>
          </div>
        </section>

        {/* ─── For whom ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <AnimatedSectionHeader eyebrow="For whom" title="두 가지 역할, 하나의 플랫폼" />

          <div className="grid gap-5 sm:grid-cols-2">
            <RoleCard
              icon={Users}
              role="일반 사용자"
              title="경조사를 준비하는 분"
              items={["AI 추천 컨셉 확인", "업체 견적 요청 발송", "받은 제안 비교 · 예약 확정", "비용 현황 및 일정 관리"]}
              href={isLoggedIn ? defaultWorkspaceHref : "/login?callbackUrl=/plans"}
              ctaText="준비 시작하기"
              colorScheme="primary"
            />
            <RoleCard
              icon={Building2}
              role="업체 사용자"
              title="서비스를 제공하는 업체"
              items={["들어온 요청 Inbox 확인", "견적 · 일정 응답 보내기", "확정 예약 일정 관리", "진행 중 요청 상태 관리"]}
              href={isLoggedIn ? defaultWorkspaceHref : "/signup"}
              ctaText="업체로 가입하기"
              colorScheme="neutral"
            />
          </div>
        </section>

        {/* ─── Demo bar ────────────────────────────────────────── */}
        <section className="border-t border-border/40 bg-gradient-to-br from-[#1a2640] to-[#2d3e5c] py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-6 sm:gap-8">
              <div className="shrink-0">
                <p className="text-sm font-bold text-white/90">데모 계정으로 바로 체험</p>
                <p className="mt-0.5 text-xs text-white/45">
                  비밀번호:{" "}
                  <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/80">demo1234</code>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DemoChip role="일반 사용자" email="planner@yeon.local" />
                <DemoChip role="웨딩 홀" email="venue@yeon.local" />
                <DemoChip role="장례 의전" email="memorial@yeon.local" />
              </div>
              <div className="ml-auto flex gap-2">
                {isLoggedIn ? (
                  <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-white/70 hover:bg-white/10 hover:text-white"} href={defaultWorkspaceHref}>
                    {isVendor ? "업체 대시보드" : "내 플랜"}
                  </Link>
                ) : (
                  <>
                    <Link className={buttonVariants({ variant: "ghost", size: "sm" }) + " text-white/70 hover:bg-white/10 hover:text-white"} href="/login">로그인</Link>
                    <Link href="/signup" className="inline-flex h-9 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md active:translate-y-0">
                      가입하기
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Footer ──────────────────────────────────────────── */}
        <footer className="border-t border-border/30 bg-white/40 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative h-7 w-[46px] overflow-hidden">
                  <Image src="/yeon-logo.png" alt="YeON" fill sizes="46px" className="object-contain" />
                </div>
                <div className="leading-none">
                  <p className="font-[var(--font-display)] text-sm font-semibold text-foreground">YeON</p>
                  <p className="text-[10px] text-muted-foreground/70">사람과 마음을 잇다</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/55">© 2026 YeON. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ emoji, title, description, href }: { emoji: string; title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-3xl bg-white/80 backdrop-blur border border-border/60 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-border"
    >
      <span className="mb-4 text-3xl">{emoji}</span>
      <h3 className="mb-2 font-[var(--font-display)] text-lg font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function FlowStep({
  step,
  icon: Icon,
  title,
  description,
  accent
}: {
  step: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  accent: "rose" | "primary" | "emerald";
}) {
  const accentStyles = {
    rose: { wrap: "bg-rose-50 border-rose-200/60", icon: "text-rose-600", num: "text-rose-300/70" },
    primary: { wrap: "bg-primary/5 border-primary/20", icon: "text-primary", num: "text-primary/30" },
    emerald: { wrap: "bg-emerald-50 border-emerald-200/60", icon: "text-emerald-600", num: "text-emerald-300/70" },
  }[accent];

  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className={`relative mb-6 flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${accentStyles.wrap}`}>
        <span className={`font-mono text-[9px] font-black uppercase tracking-widest ${accentStyles.num}`}>{step}</span>
        <Icon className={`h-6 w-6 ${accentStyles.icon}`} />
      </div>
      <h3 className="mb-2.5 font-[var(--font-display)] text-base font-bold text-foreground">{title}</h3>
      <p className="mx-auto max-w-[18rem] text-sm leading-6 text-muted-foreground">{description}</p>
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
      iconWrap: "bg-primary/10 text-primary",
      badge: "bg-primary/10 text-primary hover:bg-primary/10",
      dot: "bg-primary/30",
      border: "hover:border-primary/20",
    },
    neutral: {
      iconWrap: "bg-slate-100 text-slate-600",
      badge: "bg-slate-100 text-slate-600 hover:bg-slate-100",
      dot: "bg-slate-300",
      border: "hover:border-slate-300",
    }
  }[colorScheme];

  return (
    <div className={`group flex flex-col rounded-[2rem] border border-border/60 bg-white/90 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8 ${scheme.border}`}>
      <div className={`mb-4 inline-flex w-fit rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${scheme.iconWrap}`}>
        <Icon className="h-5 w-5" />
      </div>
      <Badge className={`mb-3 w-fit ${scheme.badge}`}>{role}</Badge>
      <h3 className="mb-4 font-[var(--font-display)] text-xl font-bold text-foreground">{title}</h3>
      <ul className="mb-7 flex-1 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${scheme.dot}`} />
            {item}
          </li>
        ))}
      </ul>
      <Link href={href} className={buttonVariants({ variant: colorScheme === "primary" ? "default" : "outline", size: "sm" })}>
        {ctaText}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DemoChip({ role, email }: { role: string; email: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/8 px-3.5 py-2.5 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/12">
      <p className="text-[11px] font-semibold text-white/85">{role}</p>
      <p className="mt-0.5 font-mono text-[10px] text-white/45">{email}</p>
    </div>
  );
}
