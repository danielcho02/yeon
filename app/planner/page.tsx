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

type PlannerSearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isCreateMode(value: string | string[] | undefined) {
  return readSearchParam(value) === "1";
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PlannerPage({
  searchParams,
}: {
  searchParams?: Promise<PlannerSearchParams>;
}) {
  const session = await getServerAuthSession();
  const params = await searchParams;
  const createMode = isCreateMode(params?.create);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(createMode ? "/planner?create=1" : "/planner")}`);
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

  if (!createMode && (hasWedding || hasFuneral)) redirect("/plans");

  const userName = session.user.name ?? "사용자";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
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

        <div className="mb-12 animate-slide-up">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[#8c8275]">Planning Route</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[var(--font-serif)] text-3xl font-normal text-[#2c3455] sm:text-4xl">
              어떤 의례를 준비하시나요?
            </h1>
            <span className="rounded-full border border-[#e5e2da] bg-white/80 px-3 py-1 text-[10px] font-semibold text-[#8c8275]">
              {userName}
            </span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#8c8275]">
            행사 유형을 먼저 선택하면 다음 화면에서 행사 정보 입력과 AI 추천을 바로 이어서 진행합니다.
          </p>
        </div>

        {/* Event type cards */}
        <div className="animate-slide-up grid gap-5 sm:grid-cols-2 delay-150">
          {/* Wedding */}
          <Link
            href={createMode ? "/planner/wedding?create=1" : "/planner/wedding"}
            className="group relative overflow-hidden rounded-2xl border border-[#ebdccf] bg-[#faf9f5] transition-all duration-300 hover:-translate-y-1 hover:border-[#c4977a] hover:shadow-[0_8px_32px_rgba(196,151,122,0.06)]"
          >
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#ebdccf] transition-colors group-hover:bg-[#c4977a]" />
            <div className="relative p-8 sm:p-10">
              <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#ebdccf]/50 bg-[#fcf8f2] text-[#c4977a]">
                <Heart className="h-4 w-4" />
              </div>
              <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-[#c4977a]">Wedding Ceremony</p>
              <h2 className="mb-3 font-[var(--font-serif)] text-xl font-bold text-[#2c3455]">결혼 준비</h2>
              <p className="mb-8 text-xs leading-relaxed text-[#8c8275]">
                AI 추천, 파트너 견적 요청, 예약 확정까지 한 흐름으로 이어서 준비합니다.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#c4977a] transition-all duration-200 group-hover:gap-3">
                결혼 준비 시작하기
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>

          {/* Funeral */}
          <Link
            href={createMode ? "/planner/funeral?create=1" : "/planner/funeral"}
            className="group relative overflow-hidden rounded-2xl border border-[#cbd3e0] bg-[#faf9f5] transition-all duration-300 hover:-translate-y-1 hover:border-[#2c3455] hover:shadow-[0_8px_32px_rgba(44,52,85,0.04)]"
          >
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#cbd3e0] transition-colors group-hover:bg-[#2c3455]" />
            <div className="relative p-8 sm:p-10">
              <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#cbd3e0] bg-[#eef2f6] text-[#2c3455]">
                <Shield className="h-4 w-4" />
              </div>
              <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-[#8c8275]">Funeral Service</p>
              <h2 className="mb-3 font-[var(--font-serif)] text-xl font-bold text-[#2c3455]">장례 준비</h2>
              <p className="mb-8 text-xs leading-relaxed text-[#8c8275]">
                차분한 안내 흐름으로 일정, 시설, 의전 절차를 안정적으로 정리합니다.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2c3455] transition-all duration-200 group-hover:gap-3">
                장례 준비 시작하기
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
