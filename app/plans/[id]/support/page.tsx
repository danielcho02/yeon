export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Wallet, Phone, Sparkles, Gift } from "lucide-react";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function EventSupportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/plans/${id}/support`);
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const plan = await prisma.eventPlan.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, title: true, type: true }
  });

  if (!plan) notFound();

  const isWedding = plan.type === "WEDDING";
  
  // Theme styles based on event type
  const theme = {
    title: "행사 운영 지원 서비스",
    subtitle: isWedding ? "웨딩 예약 확정 이후 행사 통합 관리" : "장례 예약 확정 이후 장제 통합 관리",
    primaryText: isWedding ? "text-rose-700" : "text-zinc-800",
    bannerBg: isWedding ? "bg-rose-50/40 border-rose-100/60 text-rose-950" : "bg-zinc-100/50 border-zinc-200/60 text-zinc-950",
    buttonBg: isWedding ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-zinc-900 hover:bg-zinc-800 text-white",
    cardHover: isWedding ? "hover:border-rose-300 hover:shadow-rose-50/50" : "hover:border-zinc-400 hover:shadow-zinc-50/50",
    badgeBg: isWedding ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-zinc-100 text-zinc-800 border-zinc-200",
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Navigation Breadcrumb */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/plans" className="hover:text-foreground transition-colors">내 플랜</Link>
            <span>/</span>
            <Link href={`/plans/${plan.id}`} className="hover:text-foreground transition-colors truncate max-w-[150px] sm:max-w-none">
              {plan.title}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">행사 지원 서비스</span>
          </nav>

          <Link
            href={`/plans/${plan.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            플랜 상세로 돌아가기
          </Link>
        </div>

        {/* Header Hero Banner */}
        <div className={`mb-8 rounded-[1.8rem] border p-6 sm:p-8 ${theme.bannerBg}`}>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider mb-3 ${theme.badgeBg}`}>
            예약 확정 이후 단계
          </span>
          <h1 className="font-[var(--font-display)] text-2xl font-extrabold sm:text-3xl tracking-tight">
            {theme.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            {theme.subtitle} &middot; {plan.title}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* 1. 모바일 청첩장/부고장 관리 */}
          <div className="relative flex flex-col justify-between rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm opacity-85">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Phone className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  U08 구현 예정
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-700">
                {isWedding ? "모바일 청첩장 관리" : "모바일 부고장 관리"}
              </h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {isWedding
                  ? "하객 안내를 위한 모바일 청첩장을 제작하고, 참석 여부(RSVP) 및 축하 메시지를 한눈에 모아 확인합니다."
                  : "부고 소식을 전할 모바일 부고장을 제작하고, 조문객 정보 및 위로 메시지를 한눈에 모아 확인합니다."}
              </p>
            </div>
            <div className="mt-6">
              <button
                disabled
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400 cursor-not-allowed"
              >
                서비스 준비 중
              </button>
            </div>
          </div>

          {/* 2. 축의금/조의금 정산 장부 */}
          <div className={`flex flex-col justify-between rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm transition-all duration-300 ${theme.cardHover}`}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isWedding ? "bg-rose-50 text-rose-600" : "bg-zinc-100 text-zinc-800"}`}>
                  <Wallet className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                  isWedding 
                    ? "bg-rose-50/50 border-rose-100 text-rose-700" 
                    : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}>
                  핵심 서비스
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {isWedding ? "축의금 정산 장부" : "조의금 정산 장부"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {isWedding 
                  ? "하객들이 전달한 축의금 내역을 수동으로 등록하고, 관계별/입금수단별로 투명하게 분류해 요약 리포트를 확인합니다."
                  : "조문객들이 전달한 조의금 내역을 수동으로 등록하고, 관계별/입금수단별로 투명하게 분류해 요약 리포트를 확인합니다."}
              </p>

              {/* 향후 확장 예정 스마트 서비스 로드맵 보조 설명 */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">향후 확장 예정 스마트 서비스:</p>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  <li>• QR 코드 간편 입금 (행사장 비치용 전용 QR 링크)</li>
                  <li>• 실시간 은행 계좌 연동 (실계좌 자동 입금 매칭)</li>
                  <li>• 세액 산출용 증빙 및 정산 리포트 PDF 제공</li>
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <Link
                href={`/plans/${plan.id}/settlement`}
                className={`inline-flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm transition-colors ${theme.buttonBg}`}
              >
                장부 열기 및 등록 →
              </Link>
            </div>
          </div>

          {/* 3. 추가 웨딩/장례 서비스 연결 */}
          <div className="relative flex flex-col justify-between rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm opacity-85">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  준비 중
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-700">
                {isWedding ? "추가 웨딩 서비스 연결" : "화환 및 장례 보조 서비스 연결"}
              </h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {isWedding
                  ? "본식 스냅, 영상, 사회자, 축가, 답례품, 셔틀/버스, 플라워 추가 등 예식 운영에 필요한 제반 서비스들을 맞춤형으로 제안 및 연결해 드립니다."
                  : "근조화환, 운구 차량, 장지 이동 버스, 상복/제례용품, 추모 영상 등 장례를 경건히 치르기 위한 보조 서비스들을 신속하게 연결해 드립니다."}
              </p>
            </div>
            <div className="mt-6">
              <button
                disabled
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400 cursor-not-allowed"
              >
                서비스 준비 중
              </button>
            </div>
          </div>

          {/* 4. 답례 및 후속 관리 */}
          <div className="relative flex flex-col justify-between rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm opacity-85">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Gift className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  준비 중
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-700">
                {isWedding ? "답례 및 감사 관리" : "조문 답례 및 후속 관리"}
              </h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {isWedding
                  ? "행사를 빛내준 하객들을 위한 감사 메시지 발송, 답례품 전달 현황, 그리고 하객들의 후속 관리 내역을 체계적으로 추적합니다."
                  : "슬픔을 함께 나눈 조문객들을 위한 답례 문자 작성, 조문객 명단 정리, 그리고 조의금 장부 기반의 후속 정리를 돕습니다."}
              </p>
            </div>
            <div className="mt-6">
              <button
                disabled
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400 cursor-not-allowed"
              >
                서비스 준비 중
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
