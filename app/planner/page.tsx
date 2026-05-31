import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Shield } from "lucide-react";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import {
  ensureDemoData,
  isDemoCredentialEmail
} from "@/lib/demo/ensure-demo-data";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { mvpEventTypes } from "@/lib/step3.server";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PlannerPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/planner");
  }

  if (session.user.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  if (session.user.email && isDemoCredentialEmail(session.user.email)) {
    await ensureDemoData(prisma);
  }

  const existingTypes = await withPrismaRetry(() =>
    prisma.eventPlan.findMany({
      where: { ownerId: session.user.id, type: { in: mvpEventTypes } },
      select: { type: true },
      distinct: ["type"]
    })
  );

  const hasWedding = existingTypes.some((p) => p.type === "WEDDING");
  const hasFuneral = existingTypes.some((p) => p.type === "FUNERAL");

  if (hasWedding && !hasFuneral) redirect("/planner/wedding");
  if (hasFuneral && !hasWedding) redirect("/planner/funeral");

  const userName = session.user.name ?? "사용자";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[400px] w-[400px] rounded-full bg-rose-100/35 blur-[100px]" />
        <div className="absolute -right-40 bottom-20 h-[350px] w-[350px] rounded-full bg-indigo-100/30 blur-[90px]" />
      </div>

      <div className="relative">
        {/* Nav */}
        <nav className="mb-14 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative h-8 w-[52px] overflow-hidden transition-transform duration-200 group-hover:scale-105">
              <Image src="/yeon-logo.png" alt="YeON" fill sizes="52px" className="object-contain" />
            </div>
            <span className="font-[var(--font-display)] text-sm font-semibold text-foreground">YeON</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">홈</Link>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/account">계정</Link>
          </div>
        </nav>

        {/* Greeting */}
        <div className="mb-12 animate-slide-up">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/55">워크스페이스</p>
          <h1 className="font-[var(--font-display)] text-4xl font-bold text-foreground sm:text-5xl">
            안녕하세요,<br />{userName}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
            준비하려는 행사 유형을 선택하면 맞춤 준비 흐름이 시작됩니다.
          </p>
        </div>

        {/* Event type cards */}
        <div className="animate-slide-up grid gap-5 sm:grid-cols-2 delay-150">
          {/* Wedding */}
          <Link
            href="/planner/wedding"
            className="group relative overflow-hidden rounded-[2.5rem] border border-amber-200/70 shadow-sm shadow-amber-100/40 transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-rose-200/40"
          >
            <div className="absolute inset-0 surface-wedding" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-200/40 blur-3xl transition-all duration-500 group-hover:scale-150 group-hover:bg-rose-200/60" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.035]"
              style={{ backgroundImage: "radial-gradient(circle, #c47b45 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative p-8 sm:p-10">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 shadow-lg shadow-rose-300/50 transition-all duration-300 group-hover:scale-110 group-hover:shadow-rose-400/60">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-rose-500/80">Wedding</p>
              <h2 className="mb-3 font-[var(--font-display)] text-3xl font-bold text-foreground">결혼 준비</h2>
              <p className="mb-7 text-sm leading-6 text-rose-900/50">
                AI 컨셉 추천, 업체 견적 요청, 예약 확정까지<br className="hidden sm:block" />
                웨딩 준비를 단계별로 안내합니다.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-600 transition-all duration-200 group-hover:gap-3.5">
                결혼 준비 시작하기
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          {/* Funeral */}
          <Link
            href="/planner/funeral"
            className="group relative overflow-hidden rounded-[2.5rem] border border-indigo-200/60 shadow-sm shadow-indigo-100/30 transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-indigo-200/30"
          >
            <div className="absolute inset-0 surface-funeral" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-300/30 blur-3xl transition-all duration-500 group-hover:scale-150 group-hover:bg-indigo-300/50" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: "linear-gradient(rgba(45,62,112,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45,62,112,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
            <div className="relative p-8 sm:p-10">
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-900 shadow-lg shadow-indigo-400/30 transition-all duration-300 group-hover:scale-110 group-hover:shadow-indigo-500/40">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-indigo-400/80">Funeral</p>
              <h2 className="mb-3 font-[var(--font-display)] text-3xl font-bold text-foreground">장례 준비</h2>
              <p className="mb-7 text-sm leading-6 text-indigo-900/50">
                차분하고 신뢰 있는 장례 준비. 일정, 시설,<br className="hidden sm:block" />
                절차를 안정적인 흐름으로 정리합니다.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 transition-all duration-200 group-hover:gap-3.5">
                장례 준비 시작하기
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
