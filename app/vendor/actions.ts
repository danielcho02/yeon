"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  EventType,
  Prisma,
  QuoteStatus,
  ReservationStatus,
  UserRole,
  VendorApprovalStatus,
  VendorPackageModuleSelectionType
} from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import { getActionError, isPrismaUniqueConstraintError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertQuoteTransition } from "@/lib/state-machine";
import {
  getCatalogItem,
  getQuoteServiceModuleEventType,
  vendorServiceModuleCategoryMatchesEventType,
  getVendorSupportedEventTypes,
  getVendorSupportedServiceModules,
  quoteServiceModuleValues
} from "@/lib/step3.shared";
import {
  getCatalogKeyForVendorModule,
  getVendorModuleCategoryForCatalogItem,
  getVendorModuleCategoryForCustomSection,
  isStandardVendorModule
} from "@/lib/vendor-service-modules";

async function requireVendor() {
  const session = await getServerAuthSession();
  if (!session?.user?.id || session.user.role !== "VENDOR") redirect("/login");

  const vendor = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      role: UserRole.VENDOR,
      isActive: true,
      vendorApprovalStatus: VendorApprovalStatus.APPROVED
    },
    select: {
      id: true
    }
  });

  if (!vendor) {
    throw new Error("권한 없음");
  }

  return session.user.id;
}

async function requireOwnedReservation(reservationId: string, vendorId: string) {
  const existing = await prisma.reservation.findFirst({
    where: { id: reservationId, vendorId },
    select: {
      id: true,
      eventPlanId: true,
      vendorId: true,
      status: true,
      quoteRequestId: true,
      quoteResponseId: true,
      serviceName: true,
      serviceCategory: true,
      description: true,
      selectedServiceOptions: true,
      notes: true
    },
  });

  if (!existing) {
    throw new Error("권한 없음");
  }

  return existing;
}

function mapQuoteStatus(status: QuoteStatus) {
  if (status === QuoteStatus.RESPONDED || status === QuoteStatus.ACCEPTED || status === QuoteStatus.CANCELED) {
    return status;
  }

  return "PENDING";
}

function buildLegacyResponseModules(
  reservation: Awaited<ReturnType<typeof requireOwnedReservation>>,
  proposalAmount: number
) {
  return {
    basePackage: {
      name: reservation.serviceName,
      price: proposalAmount,
      description: "업체가 제출한 견적 제안입니다."
    },
    includedModules: [],
    optionalModules: [],
    excludedModules: []
  };
}

function revalidateReservationViews(eventPlanId: string) {
  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
  revalidatePath("/plans");
  revalidatePath(`/plans/${eventPlanId}`);
  revalidatePath("/planner");
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

function isDuplicateQuoteResponse(error: unknown) {
  return isPrismaUniqueConstraintError(error, [
    "QuoteResponse_requestId_vendorId_key",
    "requestId",
    "vendorId"
  ]);
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePackageEventType(value: FormDataEntryValue | null): EventType | null {
  return value === EventType.WEDDING || value === EventType.FUNERAL ? value : null;
}

async function getPackageModulesForVendor(input: {
  vendorId: string;
  eventType: EventType;
  includedModuleIds: string[];
  optionalModuleIds: string[];
}) {
  const requestedIds = Array.from(new Set([...input.includedModuleIds, ...input.optionalModuleIds]));
  if (requestedIds.length === 0) {
    throw new Error("패키지에는 최소 1개 이상의 포함 항목이 필요합니다.");
  }

  const modules = await prisma.vendorServiceModule.findMany({
    where: {
      id: { in: requestedIds },
      vendorId: input.vendorId,
      isActive: true
    },
    select: { id: true, category: true }
  });

  if (modules.length !== requestedIds.length) {
    throw new Error("패키지 항목 중 유효하지 않은 서비스가 있습니다.");
  }

  if (
    modules.some((module) =>
      !vendorServiceModuleCategoryMatchesEventType(input.eventType, module.category)
    )
  ) {
    throw new Error("행사 유형과 맞지 않는 서비스는 패키지에 포함할 수 없습니다.");
  }

  const includedIds = new Set(input.includedModuleIds);
  const optionalIds = input.optionalModuleIds.filter((id) => !includedIds.has(id));

  return [
    ...input.includedModuleIds.map((id, index) => ({
      vendorServiceModuleId: id,
      selectionType: VendorPackageModuleSelectionType.INCLUDED,
      sortOrder: index + 1
    })),
    ...optionalIds.map((id, index) => ({
      vendorServiceModuleId: id,
      selectionType: VendorPackageModuleSelectionType.OPTIONAL,
      sortOrder: input.includedModuleIds.length + index + 1
    }))
  ];
}

function revalidateVendorPackageViews(vendorId: string) {
  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

export async function createVendorPackage(formData: FormData) {
  const vendorId = await requireVendor();
  const eventType = parsePackageEventType(formData.get("eventType"));
  const name = (formData.get("name") as string | null)?.trim() || "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const basePrice = parsePositiveInt(formData.get("basePrice"), -1);
  const sortOrder = parsePositiveInt(formData.get("sortOrder"), 0);

  if (!eventType || !name || basePrice <= 0) {
    redirect("/vendor/dashboard");
  }

  const highestSortOrder = await prisma.vendorPackage.findFirst({
    where: { vendorId, eventType },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  await prisma.vendorPackage.create({
    data: {
      vendorId,
      eventType,
      name,
      description,
      basePrice,
      sortOrder: sortOrder || (highestSortOrder?.sortOrder ?? 0) + 1,
      isActive: false
    }
  });

  revalidateVendorPackageViews(vendorId);
}

export async function updateVendorPackage(formData: FormData) {
  const vendorId = await requireVendor();
  const packageId = (formData.get("packageId") as string | null)?.trim() || "";
  const eventType = parsePackageEventType(formData.get("eventType"));
  const name = (formData.get("name") as string | null)?.trim() || "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const basePrice = parsePositiveInt(formData.get("basePrice"), -1);
  const sortOrder = parsePositiveInt(formData.get("sortOrder"), 0);
  const includedModuleIds = formData.getAll("includedModuleIds")
    .map(String)
    .filter(Boolean);
  const optionalModuleIds = formData.getAll("optionalModuleIds")
    .map(String)
    .filter(Boolean);

  if (!packageId || !eventType || !name || basePrice <= 0 || includedModuleIds.length === 0) {
    redirect("/vendor/dashboard");
  }

  const existing = await prisma.vendorPackage.findFirst({
    where: { id: packageId, vendorId },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("권한 없음");
  }

  const items = await getPackageModulesForVendor({
    vendorId,
    eventType,
    includedModuleIds,
    optionalModuleIds
  });

  await prisma.$transaction(async (tx) => {
    await tx.vendorPackage.update({
      where: { id: packageId },
      data: {
        eventType,
        name,
        description,
        basePrice,
        sortOrder
      }
    });

    await tx.vendorPackageModule.deleteMany({
      where: { packageId }
    });

    for (const item of items) {
      await tx.vendorPackageModule.create({
        data: {
          packageId,
          ...item
        }
      });
    }
  });

  revalidateVendorPackageViews(vendorId);
}

export async function toggleVendorPackage(packageId: string, isActive: boolean) {
  const vendorId = await requireVendor();

  const existing = await prisma.vendorPackage.findFirst({
    where: { id: packageId, vendorId },
    include: { items: true }
  });

  if (!existing) {
    throw new Error("권한 없음");
  }

  if (isActive && !existing.items.some((item) => item.selectionType === "INCLUDED")) {
    throw new Error("포함 항목이 없는 패키지는 활성화할 수 없습니다.");
  }

  await prisma.vendorPackage.update({
    where: { id: packageId },
    data: { isActive }
  });

  revalidateVendorPackageViews(vendorId);
}

export async function acceptReservation(reservationId: string, proposalAmount: number) {
  const vendorId = await requireVendor();
  const reservation = await requireOwnedReservation(reservationId, vendorId);

  if (reservation.status !== ReservationStatus.PENDING) {
    throw new Error("응답 가능한 요청이 아닙니다.");
  }

  if (!Number.isFinite(proposalAmount) || proposalAmount <= 0) {
    throw new Error("견적 금액을 입력해 주세요.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      let quoteResponseId = reservation.quoteResponseId;

      if (reservation.quoteRequestId) {
        const quoteRequest = await tx.quoteRequest.findFirst({
          where: { id: reservation.quoteRequestId, vendorId },
          select: { id: true, status: true }
        });

        if (quoteRequest) {
          const quoteStatus = mapQuoteStatus(quoteRequest.status);

          if (quoteStatus === "PENDING") {
            assertQuoteTransition(quoteStatus, "RESPONDED");
          } else if (quoteStatus !== "RESPONDED") {
            throw new Error("응답 가능한 견적 요청이 아닙니다.");
          }

          const modules = buildLegacyResponseModules(reservation, proposalAmount);
          const existingQuoteResponse = quoteResponseId
            ? null
            : await tx.quoteResponse.findFirst({
                where: { requestId: quoteRequest.id, vendorId },
                select: { id: true }
              });
          const quoteResponse = quoteResponseId
            ? await tx.quoteResponse.update({
                where: { id: quoteResponseId },
                data: {
                  basePrice: proposalAmount,
                  modules: modules as Prisma.InputJsonValue,
                  totalPrice: proposalAmount
                },
                select: { id: true }
              })
            : existingQuoteResponse
            ? await tx.quoteResponse.update({
                where: { id: existingQuoteResponse.id },
                data: {
                  basePrice: proposalAmount,
                  modules: modules as Prisma.InputJsonValue,
                  totalPrice: proposalAmount
                },
                select: { id: true }
              })
            : await tx.quoteResponse.create({
                data: {
                  requestId: quoteRequest.id,
                  vendorId,
                  basePrice: proposalAmount,
                  modules: modules as Prisma.InputJsonValue,
                  totalPrice: proposalAmount,
                  note: null
                },
                select: { id: true }
              });

          quoteResponseId = quoteResponse.id;

          await tx.quoteRequest.update({
            where: { id: quoteRequest.id },
            data: { status: QuoteStatus.RESPONDED }
          });
        }
      }

      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          quoteResponseId,
          status: ReservationStatus.PENDING,
          quotedAmount: proposalAmount,
          confirmedAmount: null,
        },
      });
    });
  } catch (error) {
    if (isDuplicateQuoteResponse(error)) {
      throw new Error("이미 제출한 견적 응답이 있습니다.");
    }

    throw new Error(getActionError(error));
  }

  revalidateReservationViews(reservation.eventPlanId);
}

export async function rejectReservation(reservationId: string, reason: string) {
  const vendorId = await requireVendor();
  const reservation = await requireOwnedReservation(reservationId, vendorId);

  if (reservation.status !== ReservationStatus.PENDING) {
    throw new Error("응답 가능한 요청이 아닙니다.");
  }

  await prisma.$transaction(async (tx) => {
    if (reservation.quoteRequestId) {
      const quoteRequest = await tx.quoteRequest.findFirst({
        where: { id: reservation.quoteRequestId, vendorId },
        select: { id: true, status: true }
      });

      if (quoteRequest) {
        assertQuoteTransition(mapQuoteStatus(quoteRequest.status), "CANCELED");
        await tx.quoteRequest.update({
          where: { id: quoteRequest.id },
          data: { status: QuoteStatus.CANCELED }
        });
      }
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CANCELED,
        vendorConfirmationDueAt: null,
        notes: reason,
      },
    });
  });

  revalidateReservationViews(reservation.eventPlanId);
}

export async function setStandardItemPrice(formData: FormData) {
  const vendorId = await requireVendor();

  const catalogKey = (formData.get("catalogKey") as string | null)?.trim() || "";
  const basePriceRaw = (formData.get("basePrice") as string | null)?.trim() || "";

  const catalogItem = getCatalogItem(catalogKey);
  const basePrice = Number.parseInt(basePriceRaw, 10);

  if (!catalogItem || !Number.isFinite(basePrice) || basePrice <= 0) {
    redirect("/vendor/dashboard");
  }

  const eventType = (formData.get("eventType") as string | null)?.trim() || "";
  const serviceModule = (formData.get("module") as string | null)?.trim() || "";

  if (!eventType || !serviceModule || getQuoteServiceModuleEventType(serviceModule) !== eventType) {
    redirect("/vendor/dashboard");
  }

  const category = getVendorModuleCategoryForCatalogItem(catalogKey, serviceModule);

  if (!category) {
    redirect("/vendor/dashboard");
  }

  const standardCandidates = await prisma.vendorServiceModule.findMany({
    where: {
      vendorId,
      category,
      pricingType: catalogItem.pricingType
    },
    select: { id: true, name: true, category: true, pricingType: true }
  });
  const existing = standardCandidates.find(
    (module) => getCatalogKeyForVendorModule(module) === catalogKey
  );

  if (existing) {
    await prisma.vendorServiceModule.update({
      where: { id: existing.id },
      data: {
        price: basePrice,
        isActive: true
      }
    });
  } else {
    const highestSortOrder = await prisma.vendorServiceModule.findFirst({
      where: { vendorId, category },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });

    await prisma.vendorServiceModule.create({
      data: {
        vendorId,
        name: catalogItem.name,
        category,
        price: basePrice,
        pricingType: catalogItem.pricingType,
        description: null,
        isBaseIncluded: false,
        isActive: true,
        sortOrder: (highestSortOrder?.sortOrder ?? 0) + 1
      }
    });
  }

  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

export async function addCustomItem(formData: FormData) {
  const vendorId = await requireVendor();

  const eventType = (formData.get("eventType") as string | null)?.trim() || "";
  const serviceModule = (formData.get("module") as string | null)?.trim() || "";
  const name = (formData.get("name") as string | null)?.trim() || "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const pricingType = (formData.get("pricingType") as string | null)?.trim() || "FLAT";
  const basePriceRaw = (formData.get("basePrice") as string | null)?.trim() || "";

  const basePrice = Number.parseInt(basePriceRaw, 10);

  const expectedEventType = getQuoteServiceModuleEventType(serviceModule);

  if (
    !eventType ||
    !serviceModule ||
    !name ||
    !quoteServiceModuleValues.has(serviceModule) ||
    expectedEventType !== eventType ||
    !Number.isFinite(basePrice) ||
    basePrice <= 0
  ) {
    redirect("/vendor/dashboard");
  }

  const category = getVendorModuleCategoryForCustomSection(serviceModule);
  const isBaseIncluded = formData.get("isBaseIncluded") === "on";

  if (!category) {
    redirect("/vendor/dashboard");
  }

  const duplicate = await prisma.vendorServiceModule.findFirst({
    where: { vendorId, category, name },
    select: { id: true }
  });

  if (duplicate) {
    redirect("/vendor/dashboard");
  }

  const highestSortOrder = await prisma.vendorServiceModule.findFirst({
    where: { vendorId, category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  await prisma.vendorServiceModule.create({
    data: {
      vendorId,
      name,
      category,
      price: basePrice,
      pricingType: pricingType === "PER_GUEST" ? "PER_GUEST" : "FLAT",
      description,
      isBaseIncluded,
      isActive: true,
      sortOrder: (highestSortOrder?.sortOrder ?? 0) + 1
    }
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

export async function deleteCustomItem(serviceId: string) {
  const vendorId = await requireVendor();

  const service = await prisma.vendorServiceModule.findFirst({
    where: { id: serviceId, vendorId },
    select: { id: true, name: true, category: true, pricingType: true }
  });

  if (!service) throw new Error("권한 없음 또는 표준 항목은 삭제할 수 없습니다.");
  if (isStandardVendorModule(service)) {
    throw new Error("표준 항목은 삭제할 수 없습니다.");
  }

  await prisma.vendorServiceModule.delete({ where: { id: serviceId } });

  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

export async function toggleVendorService(serviceId: string, isActive: boolean) {
  const vendorId = await requireVendor();

  const service = await prisma.vendorServiceModule.findFirst({
    where: { id: serviceId, vendorId },
    select: { id: true }
  });

  if (!service) throw new Error("권한 없음");

  await prisma.vendorServiceModule.update({
    where: { id: serviceId },
    data: { isActive }
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/planner/wedding");
  revalidatePath("/planner/funeral");
}

export async function completeVendorOnboarding(formData: FormData) {
  const session = await getServerAuthSession();
  if (!session?.user?.id || session.user.role !== UserRole.VENDOR) redirect("/login");

  const supportedEventTypes = getVendorSupportedEventTypes({
    supportedEventTypes: formData.getAll("supportedEventTypes")
  });
  const supportedServiceModules = getVendorSupportedServiceModules({
    supportedServiceModules: formData.getAll("supportedServiceModules")
  }).filter((m) => {
    const et = getQuoteServiceModuleEventType(m);
    return et ? supportedEventTypes.includes(et) : false;
  });

  if (supportedEventTypes.length === 0 || supportedServiceModules.length === 0) {
    redirect("/vendor/dashboard");
  }

  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true }
  });

  if (!userExists) {
    redirect("/login");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { supportedEventTypes, supportedServiceModules }
  });

  revalidatePath("/vendor/dashboard");
  redirect("/vendor/dashboard");
}

export async function updateVendorProfile(formData: FormData) {
  const vendorId = await requireVendor();

  const companyName = (formData.get("companyName") as string | null)?.trim() || null;
  const bio = (formData.get("bio") as string | null)?.trim() || null;
  const location = (formData.get("location") as string | null)?.trim() || null;
  const supportedEventTypes = getVendorSupportedEventTypes({
    supportedEventTypes: formData.getAll("supportedEventTypes")
  });
  const supportedServiceModules = getVendorSupportedServiceModules({
    supportedServiceModules: formData.getAll("supportedServiceModules")
  }).filter((module) => {
    const eventType = getQuoteServiceModuleEventType(module);
    return eventType ? supportedEventTypes.includes(eventType) : false;
  });

  if (!companyName || supportedEventTypes.length === 0 || supportedServiceModules.length === 0) {
    redirect("/vendor/dashboard");
  }

  await prisma.user.update({
    where: { id: vendorId },
    data: {
      name: companyName,
      companyName,
      bio,
      location,
      supportedEventTypes,
      supportedServiceModules
    },
  });

  revalidatePath("/vendor/dashboard");
  revalidatePath("/account");
  revalidatePath("/vendors");
}
