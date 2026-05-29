import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Heart, Shield, Sparkles } from "lucide-react";

export default function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:grid lg:min-h-screen lg:grid-cols-[1fr_1fr] lg:gap-8 lg:px-8 lg:py-12 bg-[#faf9f5]">
      {/* ─── Left brand panel ──────────────────────────────── */}
      <section className="relative hidden overflow-hidden rounded-2xl lg:flex lg:flex-col lg:justify-between border border-[#e5e2da] bg-[#faf9f5]">
        {/* Subtle geometric line backdrop */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "linear-gradient(to right, #2c3455 1px, transparent 1px), linear-gradient(to bottom, #2c3455 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative flex h-full flex-col justify-between p-10">
          {/* Top: Brand */}
          <div className="space-y-12">
            <Link className="group inline-flex items-center gap-3" href="/">
              <div className="relative h-8 w-[52px] overflow-hidden transition-opacity duration-150 group-hover:opacity-85">
                <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
              </div>
              <div className="leading-none">
                <p className="text-[9px] uppercase tracking-[0.32em] text-[#8c8275] font-semibold">YeON</p>
                <p className="font-[var(--font-serif)] text-xs font-bold text-[#2c3455] mt-0.5">사람과 마음을 잇다</p>
              </div>
            </Link>

            <div className="space-y-4 pt-4">
              <h2 className="font-[var(--font-serif)] text-3xl font-normal leading-tight text-[#2c3455]">
                경조사 준비의<br />모든 과정을<br />
                <span className="text-[#8c8275]">한 흐름으로 정리합니다</span>
              </h2>
              <p className="text-xs leading-relaxed text-[#8c8275] max-w-sm">
                결혼식 and 장례 의전 — 일생에서 가장 정중하고 중요한 두 순간을 과밀한 조립 부담 없이 차분하게 준비하세요.
              </p>
            </div>

            {/* Value props */}
            <div className="space-y-2">
              {[
                { icon: Sparkles, text: "AI 기반 최적의 추천 구성 자동 제안" },
                { icon: BadgeCheck, text: "심사 기준을 거친 검증된 파트너십 연결" },
                { icon: Heart, text: "결혼과 장례, 두 예식의 평온한 설계" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-xl border border-[#e5e2da]/70 bg-white/50 px-4 py-3 backdrop-blur-sm transition-all duration-150 hover:border-[#ebdccf] hover:bg-white">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#c4977a]" />
                  <p className="text-xs text-[#2c3455] font-medium">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Service preview cards */}
          <div className="grid gap-3 pt-6">
            <div className="flex items-center gap-4 rounded-xl border border-[#ebdccf]/50 bg-white/40 px-5 py-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ebdccf]/60 bg-[#fcf8f2] text-[#c4977a]">
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2c3455]">결혼 플래닝</p>
                <p className="text-[10px] text-[#8c8275] mt-0.5">추천 구성 확인 · 파트너 조율 · 최종 확정</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[#cbd3e0]/50 bg-white/40 px-5 py-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#cbd3e0] bg-[#eef2f6] text-[#2c3455]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#2c3455]">장례 의전</p>
                <p className="text-[10px] text-[#8c8275] mt-0.5">추모 가이드 확인 · 정중한 파트너 매핑 · 일정 관리</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Right form panel ──────────────────────────────── */}
      <section className="flex flex-col justify-center rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.01)] sm:p-8">
        {/* Mobile-only brand header */}
        <div className="mb-8 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="relative h-8 w-[52px] overflow-hidden">
              <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
            </div>
            <div className="leading-none">
              <p className="text-[9px] uppercase tracking-[0.32em] text-[#8c8275] font-semibold">YeON</p>
              <p className="font-[var(--font-serif)] text-xs font-bold text-[#2c3455] mt-0.5">사람과 마음을 잇다</p>
            </div>
          </Link>
        </div>
        {children}
      </section>
    </main>
  );
}
