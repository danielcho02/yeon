export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { InvitationPreview } from "@/components/features/invitation/InvitationPreview";
import { ObituaryPreview } from "@/components/features/obituary/ObituaryPreview";
import { ShareLinkButton } from "@/components/features/invitation/ShareLinkButton";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { mapMobileCard } from "@/app/actions/_utils";
import type { FuneralCardContent, WeddingCardContent } from "@/types/invitation";

export default async function MobileCardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/plans/${id}/mobile-card/preview`);
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const plan = await withPrismaRetry(() =>
    prisma.eventPlan.findFirst({
      where: { id, ownerId: session.user.id },
      include: { mobileCard: true },
    })
  );

  if (!plan) notFound();
  if (!plan.mobileCard) redirect(`/plans/${id}/mobile-card/edit`);

  const card = mapMobileCard(plan.mobileCard);
  const isWedding = card.cardType === "WEDDING";
  const label = isWedding ? "모바일 청첩장" : "모바일 부고장";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const publicUrl = `${baseUrl}${card.shareUrl}`;

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground">내 플랜</Link>
          <span>/</span>
          <Link href={`/plans/${id}`} className="hover:text-foreground">{plan.title}</Link>
          <span>/</span>
          <Link href={`/plans/${id}/mobile-card`} className="hover:text-foreground">{label}</Link>
          <span>/</span>
          <span className="font-medium text-foreground">미리보기</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">모바일 미리보기</p>
          <div className="flex gap-2">
            <Link
              href={`/plans/${id}/mobile-card/edit`}
              className="inline-flex h-8 items-center rounded-xl border border-border bg-white px-3 text-xs font-semibold transition-colors hover:bg-muted/40"
            >
              편집
            </Link>
            <ShareLinkButton url={publicUrl} />
          </div>
        </div>

        {/* 모바일 시뮬레이터 */}
        <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] border-4 border-foreground/10 shadow-xl">
          <div className="h-5 bg-foreground/10" />
          {isWedding ? (
            <InvitationPreview content={card.content as WeddingCardContent} />
          ) : (
            <ObituaryPreview content={card.content as FuneralCardContent} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          실제 공유 화면과 동일하게 표시됩니다.
        </p>
      </main>
    </div>
  );
}
