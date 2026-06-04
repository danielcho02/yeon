import { UserRole, type Prisma } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";

import type { InvitationData, MobileCardData, WeddingCardContent, FuneralCardContent } from "@/types/invitation";
import type { EventPlanData, EventType, PlanStatus } from "@/types/plan";
import type {
  QuoteRequestData,
  QuoteRequestWithResponses,
  QuoteProposalRevisionData,
  QuoteProposalRevisionStatus,
  QuoteResponseData,
  QuoteResponseModules,
  QuoteStatus
} from "@/types/quote";
import type { VendorPackagePriceSnapshot, VendorPackageSnapshot } from "@/types/vendor-package";
import type {
  ReservationCancellationRequestData,
  ReservationChangeRequestData,
  ReservationData,
  ReservationStatus,
  VendorDashboardSelectedServiceOptionDTO
} from "@/types/reservation";
import type { TransactionData, TransactionType } from "@/types/transaction";
import type { VendorProfileData } from "@/types/user";
import type { VendorServiceModuleData } from "@/types/vendor-module";

type SessionUser = {
  id: string;
  role: UserRole;
};

type VendorLike = {
  id: string;
  name: string;
  companyName: string | null;
  bio?: string | null;
  location: string | null;
  vendorApprovalStatus?: string;
  supportedServiceModules?: Prisma.JsonValue | null;
};

type PlanLike = {
  id: string;
  ownerId: string;
  type: string;
  title: string;
  scheduledAt: Date | null;
  region: string | null;
  guestTarget: number | null;
  budget: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type QuoteRequestPlanLike = {
  id: string;
  title: string;
  type: string;
  scheduledAt: Date | null;
  region: string | null;
  guestTarget: number | null;
  budget: number | null;
};

type QuoteRequestLike = {
  id: string;
  planId: string;
  vendorId: string;
  selectedPackageId?: string | null;
  requirements: string;
  selectedModules: Prisma.JsonValue | null;
  selectedPackageSnapshot?: Prisma.JsonValue | null;
  priceSnapshot?: Prisma.JsonValue | null;
  preferredDate: Date | null;
  preferredDateStart?: Date | null;
  preferredDateEnd?: Date | null;
  budget: number | null;
  status: string;
  createdAt: Date;
  vendor?: VendorLike;
  plan?: QuoteRequestPlanLike;
  reservation?: ReservationLike | null;
  selectedModuleDetails?: VendorServiceModuleData[];
};

type QuoteResponseLike = {
  id: string;
  requestId: string;
  vendorId: string;
  basePrice: number;
  modules: Prisma.JsonValue;
  totalPrice: number;
  note: string | null;
  createdAt: Date;
  vendor?: VendorLike;
  revisions?: QuoteProposalRevisionLike[];
};

type QuoteProposalRevisionLike = {
  id: string;
  quoteResponseId: string;
  requestId: string;
  vendorId: string;
  version: number;
  totalPrice: number;
  memo: string | null;
  adjustmentRequestMemo: string | null;
  plannerRequestedTotalPrice: number | null;
  proposedServiceDate?: Date | null;
  status: string;
  createdAt: Date;
};

type ReservationLike = {
  id: string;
  eventPlanId: string;
  vendorId: string;
  quoteRequestId?: string | null;
  quoteResponseId: string | null;
  quoteProposalRevisionId?: string | null;
  serviceDate: Date | null;
  quotedAmount: number | null;
  confirmedAmount: number | null;
  vendorConfirmationDueAt?: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  vendor?: VendorLike;
  quoteResponse?: QuoteResponseLike | null;
  quoteProposalRevision?: QuoteProposalRevisionLike | null;
  changeRequests?: ReservationChangeRequestLike[];
  cancellationRequests?: ReservationCancellationRequestLike[];
};

type ReservationChangeRequestLike = {
  id: string;
  reservationId: string;
  plannerId: string;
  vendorId: string;
  requestedServiceDate: Date | null;
  requestedGuestCount: number | null;
  requestedNotes: string | null;
  requestedReason: string;
  requestedSelectedServiceOptions: Prisma.JsonValue | null;
  status: string;
  vendorDecisionMemo: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReservationCancellationRequestLike = {
  id: string;
  reservationId: string;
  plannerId: string;
  vendorId: string;
  reason: string;
  status: string;
  vendorDecisionMemo: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionLike = {
  id: string;
  planId: string | null;
  senderName: string | null;
  amount: number;
  relation: string | null;
  message: string | null;
  type: string;
  createdAt: Date;
};

type InvitationLike = {
  id: string;
  eventPlanId: string;
  templateId: string | null;
  shareUrl: string | null;
  content: Prisma.JsonValue | null;
  invitationCode: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MobileCardLike = {
  id: string;
  planId: string;
  sourceReservationId: string | null;
  ownerId: string;
  cardType: string;
  slug: string;
  content: Prisma.JsonValue;
  isPublished: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export function parseActionDate(value: string | undefined) {
  if (!value) return null;

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("유효하지 않은 날짜입니다.");
  }

  return date;
}

export async function requireSessionUser(): Promise<SessionUser> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.YEON_VERIFY_ACTION_AUTH === "1" &&
    process.env.YEON_VERIFY_ACTION_USER_ID
  ) {
    return {
      id: process.env.YEON_VERIFY_ACTION_USER_ID,
      role:
        process.env.YEON_VERIFY_ACTION_USER_ROLE === UserRole.VENDOR
          ? UserRole.VENDOR
          : UserRole.GENERAL
    };
  }

  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  return {
    id: session.user.id,
    role: session.user.role
  };
}

export async function requireGeneralUser() {
  const user = await requireSessionUser();

  if (user.role !== UserRole.GENERAL) {
    throw new Error("일반 사용자만 실행할 수 있습니다.");
  }

  return user;
}

export async function requireVendorUser() {
  const user = await requireSessionUser();

  if (user.role !== UserRole.VENDOR) {
    throw new Error("업체 사용자만 실행할 수 있습니다.");
  }

  return user;
}

export function mapPlanStatus(status: string): PlanStatus {
  if (status === "DRAFT") return "DRAFT";
  if (status === "COMPLETED") return "COMPLETED";
  return "ACTIVE";
}

export function mapQuoteStatus(status: string): QuoteStatus {
  if (status === "RESPONDED" || status === "ACCEPTED" || status === "CANCELED") {
    return status;
  }

  return "PENDING";
}

export function mapQuoteProposalRevisionStatus(status: string): QuoteProposalRevisionStatus {
  if (
    status === "ADJUSTMENT_REQUESTED" ||
    status === "REVISED" ||
    status === "ACCEPTED"
  ) {
    return status;
  }

  return "SUBMITTED";
}

export function mapReservationStatus(status: string): ReservationStatus {
  if (
    status === "CONFIRMED" ||
    status === "REJECTED" ||
    status === "CHANGED" ||
    status === "CANCELED" ||
    status === "COMPLETED"
  ) {
    return status;
  }

  return "PENDING";
}

export function mapTransactionType(type: string): TransactionType {
  return type === "ONLINE" ? "ONLINE" : "OFFLINE";
}

function stringArrayFromJson(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordFromJson(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function selectedServiceOptionsFromJson(
  value: Prisma.JsonValue | null
): VendorDashboardSelectedServiceOptionDTO[] | null {
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

export function mapVendorProfile(vendor: VendorLike): VendorProfileData {
  const modules = stringArrayFromJson(vendor.supportedServiceModules ?? null);

  return {
    id: vendor.id,
    userId: vendor.id,
    businessNumber: "",
    companyName: vendor.companyName ?? vendor.name,
    category: modules[0] ?? "VENDOR",
    description: vendor.bio ?? null,
    location: vendor.location,
    status:
      vendor.vendorApprovalStatus === "REJECTED"
        ? "REJECTED"
        : vendor.vendorApprovalStatus === "PENDING"
          ? "PENDING"
          : "APPROVED"
  };
}

export function mapEventPlan(plan: PlanLike): EventPlanData {
  return {
    id: plan.id,
    userId: plan.ownerId,
    eventType: plan.type as EventType,
    title: plan.title,
    eventDate: plan.scheduledAt?.toISOString() ?? null,
    location: plan.region,
    guestCount: plan.guestTarget,
    budget: plan.budget,
    status: mapPlanStatus(plan.status),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString()
  };
}

export function mapQuoteRequest(request: QuoteRequestLike): QuoteRequestData {
  return {
    id: request.id,
    planId: request.planId,
    vendorId: request.vendorId,
    requirements: request.requirements,
    requestMemo: request.requirements,
    selectedPackageId: request.selectedPackageId ?? null,
    selectedPackageSnapshot: request.selectedPackageSnapshot as unknown as VendorPackageSnapshot ?? null,
    priceSnapshot: request.priceSnapshot as unknown as VendorPackagePriceSnapshot ?? null,
    selectedModules: stringArrayFromJson(request.selectedModules),
    preferredDate: request.preferredDate?.toISOString() ?? null,
    preferredDateStart: request.preferredDateStart?.toISOString() ?? null,
    preferredDateEnd: request.preferredDateEnd?.toISOString() ?? null,
    budget: request.budget,
    status: mapQuoteStatus(request.status),
    createdAt: request.createdAt.toISOString()
  };
}

export function mapQuoteResponse(response: QuoteResponseLike): QuoteResponseData {
  const revisions = (response.revisions ?? []).map(mapQuoteProposalRevision);

  return {
    id: response.id,
    requestId: response.requestId,
    vendorId: response.vendorId,
    basePrice: response.basePrice,
    modules: response.modules as unknown as QuoteResponseModules,
    totalPrice: response.totalPrice,
    note: response.note,
    responseMessage: response.note,
    createdAt: response.createdAt.toISOString(),
    vendor: response.vendor ? mapVendorProfile(response.vendor) : undefined,
    revisions,
    currentRevision: revisions[0] ?? null
  };
}

export function mapQuoteProposalRevision(
  revision: QuoteProposalRevisionLike
): QuoteProposalRevisionData {
  return {
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
    status: mapQuoteProposalRevisionStatus(revision.status),
    createdAt: revision.createdAt.toISOString()
  };
}

export function mapQuoteRequestWithResponses(
  request: QuoteRequestLike & { responses: QuoteResponseLike[] }
): QuoteRequestWithResponses {
  return {
    ...mapQuoteRequest(request),
    vendor: request.vendor ? mapVendorProfile(request.vendor) : undefined,
    plan: request.plan
      ? {
          id: request.plan.id,
          title: request.plan.title,
          eventType: request.plan.type,
          eventDate: request.plan.scheduledAt?.toISOString() ?? null,
          location: request.plan.region,
          guestCount: request.plan.guestTarget,
          budget: request.plan.budget
        }
      : undefined,
    selectedModuleDetails: request.selectedModuleDetails,
    reservation: request.reservation ? mapReservation(request.reservation) : null,
    responses: request.responses.map(mapQuoteResponse)
  };
}

export function mapReservation(reservation: ReservationLike): ReservationData {
  const pendingChangeRequest = reservation.changeRequests?.find((request) => request.status === "PENDING");
  const pendingCancellationRequest = reservation.cancellationRequests?.find((request) => request.status === "PENDING");

  return {
    id: reservation.id,
    planId: reservation.eventPlanId,
    vendorId: reservation.vendorId,
    quoteRequestId: reservation.quoteRequestId ?? null,
    quoteResponseId: reservation.quoteResponseId,
    quoteProposalRevisionId: reservation.quoteProposalRevisionId ?? null,
    reservedDate: (reservation.serviceDate ?? reservation.createdAt).toISOString(),
    totalAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0,
    vendorConfirmationDueAt: reservation.vendorConfirmationDueAt?.toISOString() ?? null,
    status: mapReservationStatus(reservation.status),
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
    vendor: reservation.vendor ? mapVendorProfile(reservation.vendor) : undefined,
    quoteResponse: reservation.quoteResponse ? mapQuoteResponse(reservation.quoteResponse) : undefined,
    pendingChangeRequest: pendingChangeRequest ? mapReservationChangeRequest(pendingChangeRequest) : null,
    pendingCancellationRequest: pendingCancellationRequest
      ? mapReservationCancellationRequest(pendingCancellationRequest)
      : null
  };
}

export function mapReservationRequestStatus(status: string) {
  return status === "APPROVED" || status === "REJECTED" ? status : "PENDING";
}

export function mapReservationChangeRequest(
  request: ReservationChangeRequestLike
): ReservationChangeRequestData {
  return {
    id: request.id,
    reservationId: request.reservationId,
    plannerId: request.plannerId,
    vendorId: request.vendorId,
    requestedServiceDate: request.requestedServiceDate?.toISOString() ?? null,
    requestedGuestCount: request.requestedGuestCount,
    requestedNotes: request.requestedNotes,
    requestedReason: request.requestedReason,
    requestedSelectedServiceOptions: selectedServiceOptionsFromJson(
      request.requestedSelectedServiceOptions
    ),
    status: mapReservationRequestStatus(request.status),
    vendorDecisionMemo: request.vendorDecisionMemo,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

export function mapReservationCancellationRequest(
  request: ReservationCancellationRequestLike
): ReservationCancellationRequestData {
  return {
    id: request.id,
    reservationId: request.reservationId,
    plannerId: request.plannerId,
    vendorId: request.vendorId,
    reason: request.reason,
    status: mapReservationRequestStatus(request.status),
    vendorDecisionMemo: request.vendorDecisionMemo,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

export function mapTransaction(transaction: TransactionLike): TransactionData {
  return {
    id: transaction.id,
    planId: transaction.planId ?? "",
    senderName: transaction.senderName ?? "익명",
    amount: transaction.amount,
    relation: transaction.relation,
    message: transaction.message,
    type: mapTransactionType(transaction.type),
    createdAt: transaction.createdAt.toISOString()
  };
}

export function mapInvitation(invitation: InvitationLike | null | undefined): InvitationData | null {
  if (!invitation) return null;

  return {
    id: invitation.id,
    planId: invitation.eventPlanId,
    templateId: invitation.templateId ?? "default",
    shareUrl: invitation.shareUrl ?? `/invitations/${invitation.invitationCode}`,
    content: recordFromJson(invitation.content),
    isPublished: invitation.isPublished,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString()
  };
}

function parseMobileCardContent(
  cardType: string,
  raw: Prisma.JsonValue
): WeddingCardContent | FuneralCardContent {
  const obj = recordFromJson(raw);
  if (cardType === "WEDDING") {
    return obj as unknown as WeddingCardContent;
  }
  return obj as unknown as FuneralCardContent;
}

export function mapMobileCard(card: MobileCardLike): MobileCardData {
  const cardType = card.cardType === "WEDDING" ? "WEDDING" : "FUNERAL";
  const prefix = cardType === "WEDDING" ? "/i/" : "/o/";
  return {
    id: card.id,
    planId: card.planId,
    sourceReservationId: card.sourceReservationId,
    ownerId: card.ownerId,
    cardType,
    slug: card.slug,
    content: parseMobileCardContent(card.cardType, card.content),
    isPublished: card.isPublished,
    viewCount: card.viewCount,
    shareUrl: `${prefix}${card.slug}`,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString()
  };
}
