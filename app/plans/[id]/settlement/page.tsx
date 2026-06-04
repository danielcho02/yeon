export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { SettlementClientView } from "./SettlementClientView";
import { getSettlementEntries, getSettlementSummary } from "@/app/actions/settlement";

export default async function SettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/plans/${id}/settlement`);
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");

  const plan = await prisma.eventPlan.findFirst({
    where: { id, ownerId: session.user.id },
    select: { id: true, title: true, type: true }
  });

  if (!plan) notFound();

  // Load initial entries and summary
  const entriesResult = await getSettlementEntries(plan.id);
  const summaryResult = await getSettlementSummary(plan.id);

  const initialEntries = entriesResult.success ? entriesResult.data : [];
  const initialSummary = summaryResult.success ? summaryResult.data : {
    totalAmount: 0,
    totalCount: 0,
    averageAmount: 0,
    byRelation: [],
    byType: []
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <SettlementClientView
          plan={plan}
          initialEntries={initialEntries}
          initialSummary={initialSummary}
        />
      </main>
    </div>
  );
}
