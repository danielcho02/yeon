import { redirect } from "next/navigation";

import { getQuotesByPlan, getVendorServiceModules } from "@/app/actions/quote";
import { EventPlanningWorkspace } from "@/components/features/planning/event-planning-workspace";
import type { ReservationItem } from "@/components/features/planning/workspace-types";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { vendorSupportsAnyServiceModule } from "@/lib/step3.shared";
import { buildLoginCallbackHref, buildPlannerCallbackPath } from "../auth-redirect";

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

type PlannerSearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseInitialStep(value: string | string[] | undefined) {
  const normalizedValue = readSearchParam(value);
  const step = Number.parseInt(normalizedValue ?? "", 10);
  return step >= 1 && step <= 4 ? step : null;
}

function isCreateMode(value: string | string[] | undefined) {
  return readSearchParam(value) === "1";
}

export default async function FuneralPlannerPage({
  searchParams,
}: {
  searchParams?: Promise<PlannerSearchParams>;
}) {
  const session = await getServerAuthSession();
  const params = await searchParams;

  if (!session?.user?.id) {
    redirect(buildLoginCallbackHref(buildPlannerCallbackPath("/planner/funeral", params)));
  }

  if (session.user.role === UserRole.VENDOR) {
    redirect("/vendor/dashboard");
  }

  // Cross-type guard: if planId belongs to a WEDDING plan, redirect before heavy queries
  const requestedPlanId = readSearchParam(params?.planId);

  if (requestedPlanId) {
    const planIdValue = requestedPlanId;
    const typeCheck = await withPrismaRetry(() =>
      prisma.eventPlan.findFirst({
        where: { id: planIdValue, ownerId: session.user.id },
        select: { id: true, type: true }
      })
    );
    if (typeCheck?.type === "WEDDING") {
      redirect(buildPlannerCallbackPath("/planner/wedding", { ...params, planId: typeCheck.id }));
    }
  }

  const [plans, vendors, reservations] = await withPrismaRetry(() =>
    Promise.all([
      prisma.eventPlan.findMany({
        where: { ownerId: session.user.id, type: "FUNERAL" },
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
            where: { isActive: true, eventType: "FUNERAL" },
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
          eventPlan: { ownerId: session.user.id, type: "FUNERAL" },
          vendor: { isActive: true }
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
    vendorSupportsAnyServiceModule(vendor, "FUNERAL")
  );
  const createMode = isCreateMode(params?.create);
  const initialPlan =
    createMode
      ? null
      : (requestedPlanId ? plans.find((item) => item.id === requestedPlanId) : null) ??
        (plans.length === 1 ? plans[0] : null);
  const initialVendor = filteredVendors[0] ?? null;
  const [initialVendorModulesResult, initialQuoteRequestsResult] = await Promise.all([
    initialVendor ? getVendorServiceModules(initialVendor.id, "FUNERAL") : null,
    initialPlan ? getQuotesByPlan(initialPlan.id) : null
  ]);
  const initialVendorModulesByVendorId =
    initialVendor && initialVendorModulesResult?.success
      ? { [initialVendor.id]: initialVendorModulesResult.data }
      : undefined;
  const initialQuoteRequestsByPlanId =
    initialPlan && initialQuoteRequestsResult?.success
      ? { [initialPlan.id]: initialQuoteRequestsResult.data }
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-8 sm:py-16">
      <EventPlanningWorkspace
        eventType="FUNERAL"
        initialPlanId={requestedPlanId ?? null}
        initialStep={parseInitialStep(params?.step)}
        initialCreateMode={createMode}
        viewerEmail={session.user.email ?? ""}
        viewerName={session.user.name ?? "사용자"}
        plans={plans.map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type ?? "FUNERAL",
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
        initialVendorModulesByVendorId={initialVendorModulesByVendorId}
        initialQuoteRequestsByPlanId={initialQuoteRequestsByPlanId}
      />
    </main>
  );
}
