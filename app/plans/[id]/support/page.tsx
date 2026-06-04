export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Wallet, Phone, CalendarClock } from "lucide-react";

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

  const accent = isWedding ? "text-[#c4977a]" : "text-[#5b6b86]";
  const iconWrap = isWedding
    ? "bg-[#fcf1e7] text-[#c4977a]"
    : "bg-[#eef2f6] text-[#2c3455]";
  const linkColor = isWedding
    ? "text-[#c4977a] hover:text-[#b08569]"
    : "text-[#2c3455] hover:text-[#1e2645]";

  const tools = [
    {
      icon: Phone,
      title: isWedding ? "모바일 청첩장" : "모바일 부고장",
      description: isWedding
        ? "확정 정보를 바탕으로 공유용 청첩장을 만들고 관리합니다."
        : "확정 정보를 바탕으로 공유용 부고장을 만들고 관리합니다.",
      href: `/plans/${plan.id}/mobile-card`,
      cta: isWedding ? "청첩장 관리" : "부고장 관리",
    },
    {
      icon: Wallet,
      title: isWedding ? "축의금 장부" : "조의금 장부",
      description: isWedding
        ? "전달받은 축의금 내역을 등록하고 관계·수단별로 정리합니다."
        : "전달받은 조의금 내역을 등록하고 관계·수단별로 정리합니다.",
      href: `/plans/${plan.id}/settlement`,
      cta: "장부 열기",
    },
    {
      icon: CalendarClock,
      title: "예약 조정",
      description: isWedding
        ? "확정된 예약의 일정 변경 또는 취소를 요청합니다."
        : "장례 일정 변경 또는 취소 요청을 처리합니다.",
      href: `/plans/${plan.id}`,
      cta: "플랜으로 이동",
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c3455]">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        {/* Breadcrumb */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex items-center gap-2 text-xs text-[#8c8275]">
            <Link href="/plans" className="transition-colors hover:text-[#2c3455]">내 행사 현황</Link>
            <span>/</span>
            <Link href={`/plans/${plan.id}`} className="max-w-[150px] truncate transition-colors hover:text-[#2c3455] sm:max-w-none">
              {plan.title}
            </Link>
            <span>/</span>
            <span className="font-medium text-[#2c3455]">운영 지원</span>
          </nav>
          <Link
            href={`/plans/${plan.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8c8275] transition-colors hover:text-[#2c3455]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            돌아가기
          </Link>
        </div>

        {/* Editorial header */}
        <header className="border-b border-[#e5e2da] pb-8">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${accent}`}>
            {isWedding ? "Wedding" : "Funeral"}
          </p>
          <h1 className="mt-3 font-[var(--font-serif)] text-3xl font-normal tracking-tight text-[#2c3455] sm:text-4xl">
            행사 운영 지원
          </h1>
          <p className="mt-3 text-sm text-[#8c8275]">{plan.title}</p>
        </header>

        {/* Tools as horizontal rows */}
        <div className="divide-y divide-[#e5e2da]">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-center gap-5 py-7 transition-[background-color] duration-150"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-[var(--font-serif)] text-lg font-normal text-[#2c3455]">{tool.title}</h2>
                  <p className="mt-1 text-sm text-[#8c8275]">{tool.description}</p>
                </div>
                <span className={`hidden shrink-0 items-center gap-1.5 text-xs font-semibold transition-colors sm:inline-flex ${linkColor}`}>
                  {tool.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
