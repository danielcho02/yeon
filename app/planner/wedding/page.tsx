import { redirect } from "next/navigation";

import { EventPlanningWorkspace } from "@/components/features/planning/event-planning-workspace";
import type { ReservationItem } from "@/components/features/planning/workspace-types";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { vendorSupportsAnyServiceModule } from "@/lib/step3.shared";

type Recommendation = {
  conceptTitle: string;
  budgetTier: "starter" | "balanced" | "premium";
  venueStyle: string;
  serviceFocus: string[];
  hostGuide: string;
  timeline: string[];
  notes: string[];
};

function isRecommendationShape(value: unknown): value is Recommendation {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.conceptTitle === "string" &&
    Array.isArray(c.serviceFocus) &&
    Array.isArray(c.timeline) &&
    Array.isArray(c.notes)
  );
}

function parseInitialStep(value: string | undefined) {
  const step = Number.parseInt(value ?? "", 10);
  return step >= 1 && step <= 4 ? step : null;
}

export default async function WeddingPlannerPage({
  searchParams,
}: {
  searchParams?: Promise<{ planId?: string; step?: string }>;
}) {
  const session = await getServerAuthSession();
  const params = await searchParams;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/planner/wedding");
  }

  if (session.user.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  // Cross-type guard: if planId belongs to a FUNERAL plan, redirect before heavy queries
  if (params?.planId) {
    const planIdValue = params.planId;
    const typeCheck = await withPrismaRetry(() =>
      prisma.eventPlan.findFirst({
        where: { id: planIdValue, ownerId: session.user.id },
        select: { id: true, type: true }
      })
    );
    if (typeCheck?.type === "FUNERAL") {
      const step = parseInitialStep(params.step);
      redirect(`/planner/funeral?planId=${typeCheck.id}${step ? `&step=${step}` : ""}`);
    }
  }

  const [plans, vendors, reservations] = await withPrismaRetry(() =>
    Promise.all([
      prisma.eventPlan.findMany({
        where: { ownerId: session.user.id, type: "WEDDING" },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          region: true,
          scheduledAt: true,
          guestTarget: true,
          budget: true,
          description: true,
          aiRecommendation: true
        }
      }),
      prisma.user.findMany({
        where: { role: UserRole.VENDOR, vendorApprovalStatus: "APPROVED", isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          companyName: true,
          location: true,
          supportedEventTypes: true,
          supportedServiceModules: true,
          vendorServices: {
            where: { isActive: true, eventType: "WEDDING" },
            select: {
              id: true,
              eventType: true,
              module: true,
              catalogKey: true,
              pricingType: true,
              name: true,
              description: true,
              basePrice: true,
              maxGuests: true,
              isActive: true
            },
            orderBy: [{ module: "asc" as const }, { basePrice: "asc" as const }]
          }
        }
      }),
      prisma.reservation.findMany({
        where: {
          eventPlan: { ownerId: session.user.id, type: "WEDDING" }
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          serviceName: true,
          serviceCategory: true,
          serviceDate: true,
          guestCount: true,
          quotedAmount: true,
          confirmedAmount: true,
          vendorConfirmationDueAt: true,
          notes: true,
          status: true,
          quoteRequestId: true,
          quoteResponseId: true,
          quoteRequest: {
            select: {
              status: true
            }
          },
          selectedServiceOptions: true,
          eventPlan: {
            select: { id: true, title: true, type: true, region: true, scheduledAt: true, hostName: true, honoreeName: true }
          },
          vendor: {
            select: { id: true, name: true, companyName: true, location: true }
          }
        }
      })
    ])
  );
  const filteredVendors = vendors.filter((vendor) =>
    vendorSupportsAnyServiceModule(vendor, "WEDDING")
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <EventPlanningWorkspace
        eventType="WEDDING"
        initialPlanId={params?.planId ?? null}
        initialStep={parseInitialStep(params?.step)}
        viewerEmail={session.user.email ?? ""}
        viewerName={session.user.name ?? "사용자"}
        plans={plans.map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type ?? "WEDDING",
          region: p.region,
          scheduledAt: p.scheduledAt?.toISOString() ?? null,
          guestTarget: p.guestTarget,
          budget: p.budget,
          description: p.description,
          aiRecommendation: isRecommendationShape(p.aiRecommendation) ? p.aiRecommendation : null
        }))}
        vendors={filteredVendors.map((v) => ({
          id: v.id,
          name: v.name,
          companyName: v.companyName,
          location: v.location,
          supportedEventTypes: v.supportedEventTypes,
          supportedServiceModules: v.supportedServiceModules,
          services: v.vendorServices
        }))}
        reservations={reservations.map((r) => ({
          id: r.id,
          serviceName: r.serviceName,
          serviceCategory: r.serviceCategory,
          serviceDate: r.serviceDate?.toISOString() ?? null,
          guestCount: r.guestCount,
          quotedAmount: r.quotedAmount,
          confirmedAmount: r.confirmedAmount,
          vendorConfirmationDueAt: r.vendorConfirmationDueAt?.toISOString() ?? null,
          notes: r.notes,
          status: r.status as ReservationItem["status"],
          quoteRequestId: r.quoteRequestId,
          quoteResponseId: r.quoteResponseId,
          quoteRequestStatus: r.quoteRequest?.status ?? null,
          selectedServiceOptions: r.selectedServiceOptions as ReservationItem["selectedServiceOptions"] ?? null,
          eventPlan: {
            id: r.eventPlan.id,
            title: r.eventPlan.title,
            type: r.eventPlan.type ?? undefined,
            region: r.eventPlan.region,
            scheduledAt: r.eventPlan.scheduledAt?.toISOString() ?? null,
            hostName: r.eventPlan.hostName,
            honoreeName: r.eventPlan.honoreeName
          },
          vendor: {
            id: r.vendor.id,
            name: r.vendor.name,
            companyName: r.vendor.companyName,
            location: r.vendor.location
          }
        }))}
      />
    </main>
  );
}
