export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { ObituaryPreview } from "@/components/features/obituary/ObituaryPreview";
import { getPublicMobileCard } from "@/app/actions/invitation";
import type { FuneralCardContent } from "@/types/invitation";

export default async function PublicObituaryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicMobileCard(slug);

  if (!result.success || !result.data) notFound();
  if (result.data.cardType !== "FUNERAL") notFound();

  const card = result.data;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-sm">
        <ObituaryPreview content={card.content as FuneralCardContent} />
      </div>
      <footer className="py-6 text-center">
        <p className="text-[10px] tracking-widest text-slate-300">Powered by YeON</p>
      </footer>
    </div>
  );
}
