export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { InvitationForm } from "@/components/features/invitation/InvitationForm";
import { ObituaryForm } from "@/components/features/obituary/ObituaryForm";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { createMobileCard, updateMobileCard } from "@/app/actions/invitation";
import { mapMobileCard } from "@/app/actions/_utils";
import type { FuneralCardContent, WeddingCardContent } from "@/types/invitation";

export default async function MobileCardEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/plans/${id}/mobile-card/edit`);
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

  const card = plan.mobileCard ? mapMobileCard(plan.mobileCard) : null;
  const isWedding = plan.type === "WEDDING";
  const label = isWedding ? "모바일 청첩장" : "모바일 부고장";

  const reservation = plan.reservations[0];
  const weddingPrefill: Partial<WeddingCardContent> = {
    date: reservation?.serviceDate
      ? reservation.serviceDate.toISOString().split("T")[0]
      : (plan.scheduledAt ? plan.scheduledAt.toISOString().split("T")[0] : ""),
    venue: reservation?.serviceName || plan.venueName || "",
    venueAddress: plan.region || "",
    greeting:
      "저희 두 사람이 하나가 되는 날,\n" +
      "소중한 분들을 모시고자 합니다.\n" +
      "바쁘신 중에도 참석해 주시면\n" +
      "더없는 기쁨이 되겠습니다.",
  };
  const funeralPrefill: Partial<FuneralCardContent> = {
    deceasedName: plan.honoreeName || "",
    funeralHall: reservation?.serviceName || plan.venueName || "",
    funeralHallAddress: plan.region || "",
    departureDatetime: reservation?.serviceDate
      ? reservation.serviceDate.toISOString().slice(0, 16)
      : (plan.scheduledAt ? plan.scheduledAt.toISOString().slice(0, 16) : ""),
    chiefMourners: plan.hostName || "",
    visitingInfo:
      "삼가 고인의 별세를 알립니다.\n" +
      "조문을 원하시는 분들께서는\n" +
      "아래 빈소로 방문해 주시기 바랍니다.",
  };

  async function handleSaveWedding(_cardId: string | undefined, content: WeddingCardContent) {
    "use server";
    if (_cardId) {
      const result = await updateMobileCard(_cardId, content);
      return { success: result.success, error: result.success ? undefined : (result as { error: string }).error };
    }
    const created = await createMobileCard(id);
    if (!created.success) return { success: false, error: (created as { error: string }).error };
    const updated = await updateMobileCard(created.data.id, content);
    return { success: updated.success, error: updated.success ? undefined : (updated as { error: string }).error };
  }

  async function handleSaveFuneral(_cardId: string | undefined, content: FuneralCardContent) {
    "use server";
    if (_cardId) {
      const result = await updateMobileCard(_cardId, content);
      return { success: result.success, error: result.success ? undefined : (result as { error: string }).error };
    }
    const created = await createMobileCard(id);
    if (!created.success) return { success: false, error: (created as { error: string }).error };
    const updated = await updateMobileCard(created.data.id, content);
    return { success: updated.success, error: updated.success ? undefined : (updated as { error: string }).error };
  }

  const headerBg = isWedding ? "bg-rose-50/40 border-rose-100" : "bg-slate-50/40 border-slate-100";
  const titleCls = isWedding ? "text-rose-700" : "text-slate-700";

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground">내 플랜</Link>
          <span>/</span>
          <Link href={`/plans/${id}`} className="hover:text-foreground">{plan.title}</Link>
          <span>/</span>
          <Link href={`/plans/${id}/mobile-card`} className="hover:text-foreground">{label}</Link>
          <span>/</span>
          <span className="font-medium text-foreground">편집</span>
        </nav>

        <div className={`mb-6 rounded-2xl border p-5 ${headerBg}`}>
          <p className={`text-sm font-bold ${titleCls}`}>
            {card ? `${label} 편집` : `${label} 초안 수정`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {card
              ? "내용을 수정하고 저장하세요."
              : "예약 정보 기반으로 자동 생성된 초안을 확인하고 수정해 주세요."}
          </p>
        </div>

        {isWedding ? (
          <InvitationForm
            planId={id}
            cardId={card?.id}
            initialContent={card ? (card.content as Partial<WeddingCardContent>) : weddingPrefill}
            onSave={handleSaveWedding}
          />
        ) : (
          <ObituaryForm
            planId={id}
            cardId={card?.id}
            initialContent={card ? (card.content as Partial<FuneralCardContent>) : funeralPrefill}
            onSave={handleSaveFuneral}
          />
        )}
      </main>
    </div>
  );
}
