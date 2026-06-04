export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Edit, Eye, Globe } from "lucide-react";

import { Nav } from "@/components/nav";
import { ShareLinkButton } from "@/components/features/invitation/ShareLinkButton";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { publishMobileCard } from "@/app/actions/invitation";
import { mapMobileCard } from "@/app/actions/_utils";

export default async function MobileCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/plans/${id}/mobile-card`);
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const plan = await withPrismaRetry(() =>
    prisma.eventPlan.findFirst({
      where: { id, ownerId: session.user.id },
      include: {
        mobileCard: true,
        reservations: { where: { status: "CONFIRMED" }, take: 1 },
      },
    })
  );

  if (!plan) notFound();

  const hasConfirmed = plan.reservations.length > 0;
  if (!hasConfirmed) redirect(`/plans/${id}`);

  if (!plan.mobileCard) redirect(`/plans/${id}/mobile-card/edit`);

  const card = mapMobileCard(plan.mobileCard);
  const isWedding = card.cardType === "WEDDING";
  const label = isWedding ? "모바일 청첩장" : "모바일 부고장";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const publicUrl = `${baseUrl}${card.shareUrl}`;

  async function handlePublish() {
    "use server";
    await publishMobileCard(card.id);
  }

  const accent = isWedding ? "text-[#c4977a]" : "text-[#5b6b86]";
  const iconWrap = isWedding ? "bg-[#fcf1e7] text-[#c4977a]" : "bg-[#eef2f6] text-[#2c3455]";
  const btnCls = isWedding ? "bg-[#c4977a] hover:bg-[#b08569] text-white" : "bg-[#2c3455] hover:bg-[#1e2645] text-white";

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#2c3455]">
      <Nav />
      <main className="mx-auto max-w-xl px-6 py-12 sm:py-16">
        <div className="mb-10 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2 text-xs text-[#8c8275]">
            <Link href="/plans" className="transition-colors hover:text-[#2c3455]">내 행사 현황</Link>
            <span>/</span>
            <Link href={`/plans/${id}`} className="max-w-[120px] truncate transition-colors hover:text-[#2c3455] sm:max-w-none">{plan.title}</Link>
            <span>/</span>
            <span className="font-medium text-[#2c3455]">{label}</span>
          </nav>
          <Link
            href={`/plans/${id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8c8275] transition-colors hover:text-[#2c3455]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            돌아가기
          </Link>
        </div>

        {/* Editorial header */}
        <header className="border-b border-[#e5e2da] pb-8">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${accent}`}>
            {isWedding ? "Invitation" : "Obituary"}
          </p>
          <h1 className="mt-3 font-[var(--font-serif)] text-3xl font-normal tracking-tight text-[#2c3455] sm:text-4xl">
            {label}
          </h1>
          <p className="mt-3 text-sm text-[#8c8275]">
            {card.isPublished ? (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-[#5b8a6b]" />
                공개 중 · 조회 {card.viewCount.toLocaleString()}회
              </span>
            ) : (
              "비공개 상태입니다. 하단에서 발행하면 공유할 수 있습니다."
            )}
          </p>
        </header>

        {/* Three actions as a clean vertical list */}
        <div className="divide-y divide-[#e5e2da]">
          <ActionRow href={`/plans/${id}/mobile-card/edit`} icon={Edit} title="내용 편집" description="문구와 대표 이미지를 다듬습니다." iconWrap={iconWrap} />
          <ActionRow href={`/plans/${id}/mobile-card/preview`} icon={Eye} title="미리보기" description="공유 전 실제 화면을 확인합니다." iconWrap={iconWrap} />
          <div className="flex items-center gap-4 py-5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
              <Globe className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#2c3455]">공유 링크</p>
              <p className="mt-0.5 text-xs text-[#8c8275]">
                {card.isPublished ? "발행된 페이지 주소를 복사합니다." : "발행 후 공유 링크가 활성화됩니다."}
              </p>
            </div>
            <ShareLinkButton url={publicUrl} />
          </div>
        </div>

        {card.isPublished && (
          <div className="mt-6 border-l-2 border-[#ebdccf] pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">공개 링크</p>
            <p className="mt-1.5 break-all font-mono text-xs text-[#6b6357]">{publicUrl}</p>
          </div>
        )}

        {/* Publish — prominent full-width at bottom */}
        {!card.isPublished && (
          <form action={handlePublish} className="mt-10">
            <button
              type="submit"
              className={`flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-[background-color] duration-150 ${btnCls}`}
            >
              지금 발행하기
            </button>
            <p className="mt-3 text-center text-xs text-[#8c8275]">
              발행하면 공유 링크로 누구나 열람할 수 있습니다.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function ActionRow({
  href,
  icon: Icon,
  title,
  description,
  iconWrap
}: {
  href: string;
  icon: typeof Edit;
  title: string;
  description: string;
  iconWrap: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-4 py-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#2c3455]">{title}</p>
        <p className="mt-0.5 text-xs text-[#8c8275]">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#8c8275] transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}
