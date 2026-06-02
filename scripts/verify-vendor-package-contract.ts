import assert from "node:assert/strict";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import {
  EventStatus,
  Prisma,
  PrismaClient,
  QuoteStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus
} from "../generated/prisma/client";
import { buildVendorDashboardReservationContract } from "../lib/vendor-dashboard-contract";
import { demoAccountCredentials } from "../lib/demo/ensure-demo-data";
import type { VendorDashboardReservationDTO } from "../types/reservation";
import type { VendorPackagePriceSnapshot, VendorPackageSnapshot } from "../types/vendor-package";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/yeon.db",
    timeout: 10000
  })
});

type CreatedIds = {
  planId: string;
  requestId: string;
  responseId: string;
  reservationId: string;
};

const created: CreatedIds = {
  planId: "",
  requestId: "",
  responseId: "",
  reservationId: ""
};

function assertPackageSnapshot(value: unknown) {
  assert.ok(value && typeof value === "object", "selectedPackageSnapshot must be an object");
  const snapshot = value as Record<string, unknown>;
  assert.equal(typeof snapshot.packageId, "string");
  assert.equal(typeof snapshot.name, "string");
  assert.equal(typeof snapshot.basePrice, "number");
  assert.ok(Array.isArray(snapshot.includedItems), "package snapshot must include includedItems");
}

function assertPriceSnapshot(value: unknown) {
  assert.ok(value && typeof value === "object", "priceSnapshot must be an object");
  const snapshot = value as Record<string, unknown>;
  assert.equal(typeof snapshot.packageBasePrice, "number");
  assert.equal(typeof snapshot.selectedAddOnsSubtotal, "number");
  assert.equal(typeof snapshot.estimatedTotal, "number");
  assert.equal(typeof snapshot.guestCount, "number");
  assert.ok(Array.isArray(snapshot.lineItems), "price snapshot must include lineItems");
}

function selectedOptionsFromJson(
  value: Prisma.JsonValue | null
): VendorDashboardReservationDTO["selectedServiceOptions"] {
  if (!Array.isArray(value)) return null;

  return value
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
    .filter((item): item is NonNullable<VendorDashboardReservationDTO["selectedServiceOptions"]>[number] => Boolean(item));
}

async function readVendorDashboardContract(vendorId: string) {
  const rows = await prisma.reservation.findMany({
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
  });

  return buildVendorDashboardReservationContract(rows.map((row): VendorDashboardReservationDTO => ({
    id: row.id,
    serviceName: row.serviceName,
    serviceCategory: row.serviceCategory,
    serviceDate: row.serviceDate?.toISOString() ?? null,
    guestCount: row.guestCount,
    quotedAmount: row.quotedAmount,
    confirmedAmount: row.confirmedAmount,
    vendorConfirmationDueAt: row.vendorConfirmationDueAt?.toISOString() ?? null,
    notes: row.notes,
    requestMemo: row.quoteRequest?.requirements ?? row.notes,
    responseMessage: row.quoteResponse?.note ?? null,
    status: row.status,
    quoteRequestId: row.quoteRequestId,
    quoteResponseId: row.quoteResponseId,
    quoteRequestStatus: row.quoteRequest?.status ?? null,
    selectedPackageSnapshot: (row.quoteRequest?.selectedPackageSnapshot as VendorPackageSnapshot | null) ?? null,
    priceSnapshot: (row.quoteRequest?.priceSnapshot as VendorPackagePriceSnapshot | null) ?? null,
    selectedServiceOptions: selectedOptionsFromJson(row.selectedServiceOptions),
    eventPlan: {
      id: row.eventPlan.id,
      title: row.eventPlan.title,
      type: row.eventPlan.type ?? undefined,
      region: row.eventPlan.region,
      scheduledAt: row.eventPlan.scheduledAt?.toISOString() ?? null,
      hostName: row.eventPlan.hostName,
      honoreeName: row.eventPlan.honoreeName
    },
    vendor: {
      id: row.vendor.id,
      name: row.vendor.name,
      companyName: row.vendor.companyName,
      location: row.vendor.location
    }
  })));
}

async function main() {
  const planner = await prisma.user.findUniqueOrThrow({
    where: { email: demoAccountCredentials.planner }
  });

  const momentGarden = await prisma.user.findFirstOrThrow({
    where: {
      email: demoAccountCredentials.venue,
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      isActive: true
    }
  });

  const hankyul = await prisma.user.findFirstOrThrow({
    where: {
      email: demoAccountCredentials.memorial,
      role: UserRole.VENDOR,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED,
      isActive: true
    }
  });

  const [weddingPackages, funeralPackages] = await Promise.all([
    prisma.vendorPackage.findMany({
      where: { vendorId: momentGarden.id, eventType: "WEDDING", isActive: true },
      include: { items: { include: { vendorServiceModule: true } } },
      orderBy: { sortOrder: "asc" }
    }),
    prisma.vendorPackage.findMany({
      where: { vendorId: hankyul.id, eventType: "FUNERAL", isActive: true },
      include: { items: { include: { vendorServiceModule: true } } },
      orderBy: { sortOrder: "asc" }
    })
  ]);

  assert.equal(weddingPackages.length, 3, "Moment Garden must seed exactly 3 active wedding packages");
  assert.equal(funeralPackages.length, 3, "Hankyul must seed exactly 3 active funeral packages");

  for (const pkg of [...weddingPackages, ...funeralPackages]) {
    assert.ok(pkg.basePrice > 0, `${pkg.name} must have a positive base price`);
    assert.ok(
      pkg.items.some((item) => item.selectionType === "INCLUDED"),
      `${pkg.name} must include at least one included module`
    );
    for (const item of pkg.items) {
      assert.equal(
        item.vendorServiceModule.vendorId,
        pkg.vendorId,
        `${pkg.name} must not reference modules from another vendor`
      );
    }
  }

  const packageForRequest = weddingPackages[0];
  const includedIds = packageForRequest.items
    .filter((item) => item.selectionType === "INCLUDED")
    .map((item) => item.vendorServiceModuleId);
  const optionalItem = packageForRequest.items.find((item) => item.selectionType === "OPTIONAL");
  const selectedModuleIds = optionalItem
    ? [...includedIds, optionalItem.vendorServiceModuleId]
    : includedIds;

  assert.ok(selectedModuleIds.length > 0, "package request must have selected module ids");

  const seedPlan = await prisma.eventPlan.findFirstOrThrow({
    where: { ownerId: planner.id, type: "WEDDING" }
  });

  const runId = Date.now();
  const plan = await prisma.eventPlan.create({
    data: {
      ownerId: planner.id,
      title: "Vendor package contract",
      slug: `vendor-package-contract-${runId}`,
      type: "WEDDING",
      status: EventStatus.ACTIVE,
      scheduledAt: seedPlan.scheduledAt,
      guestTarget: seedPlan.guestTarget ?? 80,
      budget: seedPlan.budget ?? 5_000_000
    }
  });
  created.planId = plan.id;

  const estimatedTotal =
    packageForRequest.basePrice +
    (optionalItem?.priceOverride ?? optionalItem?.vendorServiceModule.price ?? 0);

  const request = await prisma.quoteRequest.create({
    data: {
      planId: plan.id,
      vendorId: momentGarden.id,
      selectedPackageId: packageForRequest.id,
      requirements: "패키지 구성으로 견적을 요청합니다.",
      selectedModules: selectedModuleIds,
      selectedPackageSnapshot: {
        packageId: packageForRequest.id,
        name: packageForRequest.name,
        description: packageForRequest.description,
        eventType: packageForRequest.eventType,
        basePrice: packageForRequest.basePrice,
        includedItems: packageForRequest.items
          .filter((item) => item.selectionType === "INCLUDED")
          .map((item) => ({ id: item.vendorServiceModuleId, name: item.vendorServiceModule.name }))
      },
      priceSnapshot: {
        packageBasePrice: packageForRequest.basePrice,
        selectedAddOnsSubtotal: estimatedTotal - packageForRequest.basePrice,
        estimatedTotal,
        guestCount: plan.guestTarget,
        lineItems: selectedModuleIds.map((id) => ({ id }))
      },
      preferredDate: plan.scheduledAt,
      budget: estimatedTotal,
      status: QuoteStatus.PENDING
    }
  });
  created.requestId = request.id;

  assert.equal(request.selectedPackageId, packageForRequest.id);
  assertPackageSnapshot(request.selectedPackageSnapshot);
  assertPriceSnapshot(request.priceSnapshot);

  const responseCount = await prisma.quoteResponse.count({
    where: { requestId: request.id }
  });
  const reservationCount = await prisma.reservation.count({
    where: { quoteRequestId: request.id }
  });
  assert.equal(responseCount, 0, "package request creation must not create QuoteResponse");
  assert.equal(reservationCount, 0, "package request creation must not create Reservation");

  const finalProposalTotal = estimatedTotal + 150_000;
  const response = await prisma.quoteResponse.create({
    data: {
      requestId: request.id,
      vendorId: momentGarden.id,
      basePrice: finalProposalTotal,
      modules: {
        basePackage: {
          name: packageForRequest.name,
          price: finalProposalTotal,
          description: packageForRequest.description ?? "패키지 기준 견적입니다."
        },
        includedModules: selectedModuleIds.map((id) => ({ id, name: id, category: "VENUE", price: 0 })),
        optionalModules: [],
        excludedModules: []
      },
      totalPrice: finalProposalTotal,
      note: "현장 동선 보강 인력 1인을 반영했습니다."
    }
  });
  created.responseId = response.id;

  await prisma.quoteRequest.update({
    where: { id: request.id },
    data: { status: QuoteStatus.RESPONDED }
  });

  const comparisonShape = await prisma.quoteRequest.findUniqueOrThrow({
    where: { id: request.id },
    include: { responses: true, reservation: true }
  });
  const comparisonPriceSnapshot = comparisonShape.priceSnapshot as Record<string, unknown>;
  const latestResponse = comparisonShape.responses[0];

  assert.equal(
    comparisonPriceSnapshot.estimatedTotal,
    estimatedTotal,
    "planner comparison must use QuoteRequest.priceSnapshot.estimatedTotal as request estimate"
  );
  assert.equal(
    latestResponse?.totalPrice,
    finalProposalTotal,
    "planner comparison must use QuoteResponse.totalPrice as vendor final proposal"
  );
  assert.equal(
    latestResponse.totalPrice - Number(comparisonPriceSnapshot.estimatedTotal),
    150_000,
    "package proposal comparison delta must be final proposal minus request estimate"
  );
  assert.equal(
    latestResponse.note,
    "현장 동선 보강 인력 1인을 반영했습니다.",
    "vendor note must remain the proposal/adjustment memo"
  );
  assert.equal(
    comparisonShape.requirements,
    "패키지 구성으로 견적을 요청합니다.",
    "request memo must remain separate from vendor response memo"
  );
  assert.equal(
    comparisonShape.reservation,
    null,
    "package proposal response must not create Reservation before planner accept"
  );

  await prisma.quoteRequest.update({
    where: { id: request.id },
    data: { status: QuoteStatus.ACCEPTED }
  });

  const reservation = await prisma.reservation.create({
    data: {
      eventPlanId: plan.id,
      vendorId: momentGarden.id,
      quoteRequestId: request.id,
      quoteResponseId: response.id,
      serviceName: packageForRequest.name,
      serviceCategory: "VENUE",
      serviceDate: plan.scheduledAt,
      guestCount: plan.guestTarget,
      quotedAmount: finalProposalTotal,
      confirmedAmount: null,
      vendorConfirmationDueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      selectedServiceOptions: selectedModuleIds.map((id) => ({
        catalogKey: id,
        name: id,
        price: 0,
        pricingType: "FLAT"
      })),
      status: ReservationStatus.PENDING,
      notes: "견적 응답 수락으로 생성된 예약입니다. 업체 확정 대기 중입니다."
    }
  });
  created.reservationId = reservation.id;

  const vendorContract = await readVendorDashboardContract(momentGarden.id);
  const pendingConfirmation = vendorContract.pendingConfirmations.find((item) => item.id === reservation.id);

  assert.ok(pendingConfirmation, "accepted package reservation must enter vendor pending confirmations");
  assertPackageSnapshot(
    (pendingConfirmation as { selectedPackageSnapshot?: unknown }).selectedPackageSnapshot
  );
  assertPriceSnapshot(
    (pendingConfirmation as { priceSnapshot?: unknown }).priceSnapshot
  );

  console.log("verify-vendor-package-contract: ok");
}

main()
  .catch((error) => {
    console.error("verify-vendor-package-contract: failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (created.reservationId) {
      await prisma.reservation.deleteMany({ where: { id: created.reservationId } });
    }
    if (created.responseId) {
      await prisma.quoteResponse.deleteMany({ where: { id: created.responseId } });
    }
    if (created.requestId) {
      await prisma.quoteRequest.deleteMany({ where: { id: created.requestId } });
    }
    if (created.planId) {
      await prisma.eventPlan.deleteMany({ where: { id: created.planId } });
    }
    await prisma.$disconnect();
  });
