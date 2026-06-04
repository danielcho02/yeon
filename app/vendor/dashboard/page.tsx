export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { VendorWorkspace } from "@/components/features/planning/vendor-workspace";
import { ReservationRequestStatus } from "@/generated/prisma/client";
import type { ReservationItem } from "@/components/features/planning/workspace-types";
import { Nav } from "@/components/nav";
import { getServerAuthSession } from "@/lib/auth/session";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  getVendorSupportedEventTypes,
  getVendorSupportedServiceModules
} from "@/lib/step3.shared";
import {
  deriveModuleManagerSection,
  getCatalogKeyForVendorModule
} from "@/lib/vendor-service-modules";
import { buildVendorDashboardReservationContract } from "@/lib/vendor-dashboard-contract";
import type {
  VendorDashboardReservationDTO,
  VendorDashboardSelectedServiceOptionDTO
} from "@/types/reservation";
import type { QuoteRequestForVendorDTO, QuoteStatus } from "@/types/quote";
import type { VendorServiceModuleData } from "@/types/vendor-module";
import type { VendorPackagePriceSnapshot, VendorPackageSnapshot } from "@/types/vendor-package";
import { VendorOnboardingForm } from "./onboarding-form";

function selectedOptionsFromJson(value: unknown): VendorDashboardSelectedServiceOptionDTO[] | null {
  if (!Array.isArray(value)) return null;

  const options = value
    .map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const name = typeof record.name === "string" ? record.name : null;
      const price = typeof record.price === "number" ? record.price : null;
      const pricingType = typeof record.pricingType === "string" ? record.pricingType : "FLAT";

      if (!name || price === null) return null;

      return {
        catalogKey: typeof record.catalogKey === "string" ? record.catalogKey : null,
        name,
        price,
        pricingType,
        ...(typeof record.quantity === "number" ? { quantity: record.quantity } : {}),
        ...(typeof record.subtotal === "number" ? { subtotal: record.subtotal } : {})
      };
    })
    .filter((item): item is VendorDashboardSelectedServiceOptionDTO => Boolean(item));

  return options.length > 0 ? options : null;
}

export default async function VendorDashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) redirect("/login?callbackUrl=/vendor/dashboard");
  if (session.user.role !== "VENDOR") redirect("/plans");

  const vendorId = session.user.id;

  const [vendor, rawReservations, vendorServiceModules, vendorPackages, rawQuoteRequests] = await withPrismaRetry(() =>
    Promise.all([
      prisma.user.findUnique({
        where: { id: vendorId },
        select: {
          companyName: true,
          name: true,
          supportedEventTypes: true,
          supportedServiceModules: true
        }
      }),
      prisma.reservation.findMany({
        where: { vendorId },
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
              status: true,
              requirements: true,
              selectedPackageSnapshot: true,
              priceSnapshot: true
            }
          },
          quoteResponse: {
            select: {
              note: true
            }
          },
          changeRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              reservationId: true,
              plannerId: true,
              vendorId: true,
              requestedServiceDate: true,
              requestedGuestCount: true,
              requestedNotes: true,
              requestedReason: true,
              requestedSelectedServiceOptions: true,
              status: true,
              vendorDecisionMemo: true,
              decidedAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          cancellationRequests: {
            where: { status: ReservationRequestStatus.PENDING },
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              reservationId: true,
              plannerId: true,
              vendorId: true,
              reason: true,
              status: true,
              vendorDecisionMemo: true,
              decidedAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          selectedServiceOptions: true,
          eventPlan: {
            select: {
              id: true,
              title: true,
              type: true,
              region: true,
              scheduledAt: true,
              hostName: true,
              honoreeName: true
            }
          },
          vendor: {
            select: {
              id: true,
              name: true,
              companyName: true,
              location: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.vendorServiceModule.findMany({
        where: { vendorId },
        select: {
          id: true,
          vendorId: true,
          category: true,
          price: true,
          pricingType: true,
          name: true,
          description: true,
          isBaseIncluded: true,
          isActive: true,
          sortOrder: true
        },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
      }),
      prisma.vendorPackage.findMany({
        where: { vendorId },
        select: {
          id: true,
          vendorId: true,
          eventType: true,
          name: true,
          description: true,
          basePrice: true,
          isActive: true,
          sortOrder: true,
          items: {
            select: {
              id: true,
              vendorServiceModuleId: true,
              selectionType: true,
              quantity: true,
              priceOverride: true
            },
            orderBy: [{ selectionType: "asc" as const }, { sortOrder: "asc" as const }]
          }
        },
        orderBy: [{ eventType: "asc" as const }, { sortOrder: "asc" as const }]
      }),
      prisma.quoteRequest.findMany({
        where: {
          vendorId,
          status: { in: ["PENDING", "RESPONDED"] }
        },
        include: {
          plan: {
            select: {
              id: true,
              title: true,
              type: true,
              region: true,
              scheduledAt: true,
              hostName: true,
              honoreeName: true,
              guestTarget: true,
              budget: true
            }
          },
          responses: {
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              requestId: true,
              vendorId: true,
              basePrice: true,
              totalPrice: true,
              note: true,
              createdAt: true,
              modules: true,
              revisions: {
                orderBy: [{ version: "desc" as const }, { createdAt: "desc" as const }],
                select: {
                  id: true,
                  quoteResponseId: true,
                  requestId: true,
                  vendorId: true,
                  version: true,
                  totalPrice: true,
                  memo: true,
                  adjustmentRequestMemo: true,
                  plannerRequestedTotalPrice: true,
                  proposedServiceDate: true,
                  status: true,
                  createdAt: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" as const }
      })
    ])
  );

  if (!vendor) {
    redirect("/login");
  }

  const supportedEventTypes = getVendorSupportedEventTypes({
    supportedEventTypes: vendor.supportedEventTypes
  });
  const supportedServiceModules = getVendorSupportedServiceModules({
    supportedServiceModules: vendor.supportedServiceModules
  });
  const vendorServices = vendorServiceModules.map((module) => {
    const derivedSection = deriveModuleManagerSection({
      category: module.category,
      name: module.name,
      pricingType: module.pricingType
    });

    return {
      id: module.id,
      eventType: derivedSection.eventType,
      module: derivedSection.module,
      catalogKey: derivedSection.catalogKey,
      category: module.category,
      pricingType: module.pricingType,
      name: module.name,
      description: module.description,
      basePrice: module.price,
      isActive: module.isActive,
      isBaseIncluded: module.isBaseIncluded
    };
  });

  if (supportedEventTypes.length === 0) {
    return <VendorOnboardingForm />;
  }

  const reservations: VendorDashboardReservationDTO[] = rawReservations.map((r) => ({
    id: r.id,
    serviceName: r.serviceName,
    serviceCategory: r.serviceCategory,
    serviceDate: r.serviceDate?.toISOString() ?? null,
    guestCount: r.guestCount,
    quotedAmount: r.quotedAmount,
    confirmedAmount: r.confirmedAmount,
    vendorConfirmationDueAt: r.vendorConfirmationDueAt?.toISOString() ?? null,
    notes: r.notes,
    requestMemo: r.quoteRequest?.requirements ?? r.notes,
    responseMessage: r.quoteResponse?.note ?? null,
    status: r.status as ReservationItem["status"],
    quoteRequestId: r.quoteRequestId,
    quoteResponseId: r.quoteResponseId,
    quoteRequestStatus: r.quoteRequest?.status ?? null,
    selectedPackageSnapshot: (r.quoteRequest?.selectedPackageSnapshot as VendorPackageSnapshot | null) ?? null,
    priceSnapshot: (r.quoteRequest?.priceSnapshot as VendorPackagePriceSnapshot | null) ?? null,
    selectedServiceOptions: selectedOptionsFromJson(r.selectedServiceOptions),
    pendingChangeRequests: r.changeRequests.map((request) => ({
      id: request.id,
      reservationId: request.reservationId,
      plannerId: request.plannerId,
      vendorId: request.vendorId,
      requestedServiceDate: request.requestedServiceDate?.toISOString() ?? null,
      requestedGuestCount: request.requestedGuestCount,
      requestedNotes: request.requestedNotes,
      requestedReason: request.requestedReason,
      requestedSelectedServiceOptions: selectedOptionsFromJson(request.requestedSelectedServiceOptions),
      status: request.status,
      vendorDecisionMemo: request.vendorDecisionMemo,
      decidedAt: request.decidedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString()
    })),
    pendingCancellationRequests: r.cancellationRequests.map((request) => ({
      id: request.id,
      reservationId: request.reservationId,
      plannerId: request.plannerId,
      vendorId: request.vendorId,
      reason: request.reason,
      status: request.status,
      vendorDecisionMemo: request.vendorDecisionMemo,
      decidedAt: request.decidedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString()
    })),
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
  }));
  const reservationContract = buildVendorDashboardReservationContract(reservations);
  const selectedModuleIds = Array.from(
    new Set(
      rawQuoteRequests.flatMap((qr) =>
        Array.isArray(qr.selectedModules)
          ? qr.selectedModules.filter((id): id is string => typeof id === "string")
          : []
      )
    )
  );
  const selectedModules = selectedModuleIds.length > 0
    ? await withPrismaRetry(() =>
        prisma.vendorServiceModule.findMany({
          where: { id: { in: selectedModuleIds } },
          orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
        })
      )
    : [];
  const selectedModuleMap = new Map<string, VendorServiceModuleData>(
    selectedModules.map((module) => {
      const dto: VendorServiceModuleData = {
        id: module.id,
        vendorId: module.vendorId,
        catalogKey: getCatalogKeyForVendorModule(module),
        name: module.name,
        category: module.category as VendorServiceModuleData["category"],
        price: module.price,
        pricingType: module.pricingType === "PER_GUEST" ? "PER_GUEST" : "FLAT",
        description: module.description,
        isBaseIncluded: module.isBaseIncluded,
        isActive: module.isActive,
        sortOrder: module.sortOrder
      };

      return [module.id, dto];
    })
  );

  const quoteRequestsForVendor: QuoteRequestForVendorDTO[] = rawQuoteRequests.map((qr) => ({
          id: qr.id,
          planId: qr.planId,
          vendorId: qr.vendorId,
          requirements: qr.requirements,
          requestMemo: qr.requirements,
          selectedPackageId: qr.selectedPackageId,
          selectedPackageSnapshot: qr.selectedPackageSnapshot as import("@/types/vendor-package").VendorPackageSnapshot | null,
          priceSnapshot: qr.priceSnapshot as import("@/types/vendor-package").VendorPackagePriceSnapshot | null,
          selectedModules: Array.isArray(qr.selectedModules) ? qr.selectedModules as string[] : [],
    selectedModuleDetails: Array.isArray(qr.selectedModules)
      ? qr.selectedModules
          .filter((id): id is string => typeof id === "string")
          .map((id) => selectedModuleMap.get(id))
          .filter((module): module is VendorServiceModuleData => Boolean(module))
      : [],
    preferredDate: qr.preferredDate?.toISOString() ?? null,
    preferredDateStart: qr.preferredDateStart?.toISOString() ?? null,
    preferredDateEnd: qr.preferredDateEnd?.toISOString() ?? null,
    budget: qr.budget,
    status: qr.status as QuoteStatus,
    createdAt: qr.createdAt.toISOString(),
    plan: qr.plan ? {
      id: qr.plan.id,
      title: qr.plan.title,
      eventType: qr.plan.type ?? "",
      eventDate: qr.plan.scheduledAt?.toISOString() ?? null,
      location: qr.plan.region ?? null,
      guestCount: qr.plan.guestTarget ?? null,
      budget: qr.plan.budget ?? null
    } : undefined,
    responses: qr.responses.map((resp) => ({
      id: resp.id,
      requestId: resp.requestId,
      vendorId: resp.vendorId,
      basePrice: resp.basePrice,
      modules: resp.modules as unknown as import("@/types/quote").QuoteResponseModules,
      totalPrice: resp.totalPrice,
      note: resp.note,
      responseMessage: resp.note,
      createdAt: resp.createdAt.toISOString(),
      revisions: resp.revisions.map((revision) => ({
        id: revision.id,
        quoteResponseId: revision.quoteResponseId,
        requestId: revision.requestId,
        vendorId: revision.vendorId,
        version: revision.version,
        totalPrice: revision.totalPrice,
        memo: revision.memo,
        adjustmentRequestMemo: revision.adjustmentRequestMemo,
        plannerRequestedTotalPrice: revision.plannerRequestedTotalPrice,
        proposedServiceDate: revision.proposedServiceDate?.toISOString() ?? null,
        status: revision.status as import("@/types/quote").QuoteProposalRevisionStatus,
        createdAt: revision.createdAt.toISOString()
      })),
      currentRevision: resp.revisions[0]
        ? {
            id: resp.revisions[0].id,
            quoteResponseId: resp.revisions[0].quoteResponseId,
            requestId: resp.revisions[0].requestId,
            vendorId: resp.revisions[0].vendorId,
            version: resp.revisions[0].version,
            totalPrice: resp.revisions[0].totalPrice,
            memo: resp.revisions[0].memo,
            adjustmentRequestMemo: resp.revisions[0].adjustmentRequestMemo,
            plannerRequestedTotalPrice: resp.revisions[0].plannerRequestedTotalPrice,
            proposedServiceDate: resp.revisions[0].proposedServiceDate?.toISOString() ?? null,
            status: resp.revisions[0].status as import("@/types/quote").QuoteProposalRevisionStatus,
            createdAt: resp.revisions[0].createdAt.toISOString()
          }
        : null
    })),
    reservation: null
  }));

  const companyName = vendor?.companyName ?? vendor?.name ?? "업체 대시보드";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
        <div className="mb-10">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground/60">
            Partner Operations
          </p>
          <h1 className="font-[var(--font-serif)] text-2xl font-bold tracking-tight text-[#2c3455] sm:text-3xl">
            {companyName}
          </h1>
        </div>

        <VendorWorkspace
          viewerName={session.user.name ?? vendor?.name ?? "업체"}
          viewerEmail={session.user.email ?? ""}
          companyName={companyName}
          reservations={reservationContract.reservations}
          pendingConfirmations={reservationContract.pendingConfirmations}
          pendingChangeRequests={reservationContract.pendingChangeRequests}
          pendingCancellationRequests={reservationContract.pendingCancellationRequests}
          supportedEventTypes={supportedEventTypes}
          supportedServiceModules={supportedServiceModules}
          vendorServices={vendorServices}
          vendorPackages={vendorPackages.map((pkg) => ({
            id: pkg.id,
            vendorId: pkg.vendorId,
            eventType: pkg.eventType,
            name: pkg.name,
            description: pkg.description,
            basePrice: pkg.basePrice,
            isActive: pkg.isActive,
            sortOrder: pkg.sortOrder,
            items: pkg.items.map((item) => ({
              id: item.id,
              vendorServiceModuleId: item.vendorServiceModuleId,
              selectionType: item.selectionType as "INCLUDED" | "OPTIONAL",
              quantity: item.quantity,
              priceOverride: item.priceOverride
            }))
          }))}
          quoteRequests={quoteRequestsForVendor}
        />

      </main>
    </div>
  );
}
