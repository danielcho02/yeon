import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Heart, Shield, Sparkles } from "lucide-react";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:grid lg:min-h-screen lg:grid-cols-[1fr_1fr] lg:gap-6 lg:px-8 lg:py-10">
      {/* ─── Left brand panel ──────────────────────────────── */}
      <section className="relative hidden overflow-hidden rounded-[2rem] lg:flex lg:flex-col lg:justify-between">
        {/* Deep background */}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#141e30_0%,#1e2d4a_42%,#1a2740_100%)]" />
        {/* Floating gradient orbs */}
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-rose-500/10 blur-[80px] animate-float" />
        <div className="pointer-events-none absolute -right-16 bottom-28 h-64 w-64 rounded-full bg-indigo-400/12 blur-[70px] animate-float-slow" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-48 w-48 rounded-full bg-amber-300/7 blur-[60px]" />
        {/* Subtle dot pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        <div className="relative flex h-full flex-col justify-between p-9">
          {/* Top: Brand */}
          <div>
            <Link className="group inline-flex items-center gap-3" href="/">
              <div className="relative h-9 w-[60px] overflow-hidden transition-opacity group-hover:opacity-90">
                <Image src="/yeon-logo.png" alt="YeON" fill className="object-contain" />
              </div>
              <div className="leading-none">
                <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">YeON</p>
                <p className="font-[var(--font-display)] text-base font-semibold text-white/90">사람과 마음을 잇다</p>
              </div>
            </Link>

            <div className="mt-11">
              <h2 className="font-[var(--font-display)] text-4xl font-bold leading-tight text-white/90">
                경조사 준비의<br />모든 과정을<br />
                <span className="text-white/38">한 흐름으로</span>
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/38">
                결혼식과 장례식 — 인생에서 가장 중요한<br />
                두 순간을 AI와 함께 준비하세요.
              </p>
            </div>

            {/* Value props */}
            <div className="mt-8 space-y-2.5">
              {[
                { icon: Sparkles, text: "AI 기반 맞춤 컨셉 추천" },
                { icon: BadgeCheck, text: "검증된 업체 네트워크 연결" },
                { icon: Heart, text: "결혼 & 장례, 하나의 플랫폼" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-white/14 hover:bg-white/8">
                  <Icon className="h-4 w-4 shrink-0 text-white/45" />
                  <p className="text-sm text-white/65">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Service preview cards */}
          <div className="my-7 grid gap-3">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 backdrop-blur-sm transition-all duration-200 hover:border-white/16 hover:bg-white/9">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/20">
                <Heart className="h-4 w-4 text-rose-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/85">결혼 준비</p>
                <p className="text-xs text-white/36">AI 컨셉 추천 · 업체 견적 · 예약 확정</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 backdrop-blur-sm transition-all duration-200 hover:border-white/16 hover:bg-white/9">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-500/20">
                <Shield className="h-4 w-4 text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/85">장례 준비</p>
                <p className="text-xs text-white/36">단계별 안내 · 업체 연결 · 일정 관리</p>
              </div>
            </div>
          </div>

          {/* Bottom: Demo hint */}
          <div className="rounded-2xl border border-white/8 bg-white/5 px-5 py-4">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/32">데모 계정</p>
            <div className="space-y-1.5">
              <p className="font-mono text-xs text-white/58">planner@yeon.local</p>
              <p className="font-mono text-xs text-white/36">비밀번호: <span className="text-white/58">demo1234</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Right form panel ──────────────────────────────── */}
      <section className="flex flex-col justify-center rounded-[2rem] border border-white/70 bg-white/93 p-6 shadow-xl shadow-slate-200/20 backdrop-blur sm:p-8">
        {/* Mobile-only brand header */}
        <div className="mb-8 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="relative h-8 w-[52px] overflow-hidden">
              <Image src="/yeon-logo.png" alt="YeON" fill className="object-contain" />
            </div>
            <div className="leading-none">
              <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">YeON</p>
              <p className="font-[var(--font-display)] text-sm font-semibold text-foreground">사람과 마음을 잇다</p>
            </div>
          </Link>
        </div>
        {children}
      </section>
    </main>
  );
}
