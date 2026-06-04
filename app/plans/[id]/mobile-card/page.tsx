export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit, Eye, Globe } from "lucide-react";

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

  const headerCls = isWedding ? "border-rose-100 bg-rose-50/40" : "border-slate-100 bg-slate-50/40";
  const titleCls = isWedding ? "text-rose-700" : "text-slate-700";
  const btnCls = isWedding ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-slate-700 hover:bg-slate-800 text-white";

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground">내 플랜</Link>
          <span>/</span>
          <Link href={`/plans/${id}`} className="hover:text-foreground">{plan.title}</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{label}</span>
        </nav>

        <div className={`mb-6 rounded-2xl border p-5 ${headerCls}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-sm font-bold ${titleCls}`}>{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {card.isPublished ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <Globe className="h-3 w-3" /> 공개 중 · 조회 {card.viewCount}회
                  </span>
                ) : (
                  "비공개 상태"
                )}
              </p>
            </div>
            <Link
              href={`/plans/${id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              플랜으로
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href={`/plans/${id}/mobile-card/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted/40"
          >
            <Edit className="h-3.5 w-3.5" />
            내용 편집
          </Link>
          <Link
            href={`/plans/${id}/mobile-card/preview`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold transition-colors hover:bg-muted/40"
          >
            <Eye className="h-3.5 w-3.5" />
            미리보기
          </Link>
          <ShareLinkButton url={publicUrl} />
        </div>

        {!card.isPublished && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-white/60 p-5 text-center">
            <p className="mb-1 text-sm font-semibold text-foreground">아직 공개되지 않았습니다</p>
            <p className="mb-4 text-xs text-muted-foreground">
              발행하면 공유 링크로 누구나 볼 수 있습니다.
            </p>
            <form action={handlePublish}>
              <button type="submit" className={`rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${btnCls}`}>
                지금 발행하기
              </button>
            </form>
          </div>
        )}

        {card.isPublished && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
            <p className="mb-2 text-xs font-bold text-emerald-700">공개 링크</p>
            <p className="break-all font-mono text-xs text-slate-600">{publicUrl}</p>
          </div>
        )}
      </main>
    </div>
  );
}
