export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { InvitationPreview } from "@/components/features/invitation/InvitationPreview";
import { getPublicMobileCard } from "@/app/actions/invitation";
import type { WeddingCardContent } from "@/types/invitation";

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicMobileCard(slug);

  if (!result.success || !result.data) notFound();
  if (result.data.cardType !== "WEDDING") notFound();

  const card = result.data;

  return (
    <div className="min-h-screen bg-[#fff7ed]">
      <div className="mx-auto max-w-sm">
        <InvitationPreview content={card.content as WeddingCardContent} />
      </div>
      <footer className="py-6 text-center">
        <p className="text-[10px] tracking-widest text-stone-300">Powered by YeON</p>
      </footer>
    </div>
  );
}
