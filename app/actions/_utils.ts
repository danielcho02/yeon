import "server-only";

import { UserRole, type Prisma } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";

import type { InvitationData } from "@/types/invitation";
import type { EventPlanData, EventType, PlanStatus } from "@/types/plan";
import type {
  QuoteRequestData,
  QuoteRequestWithResponses,
  QuoteResponseData,
  QuoteResponseModules,
  QuoteStatus
} from "@/types/quote";
import type { ReservationData, ReservationStatus } from "@/types/reservation";
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
  requirements: string;
  selectedModules: Prisma.JsonValue | null;
  preferredDate: Date | null;
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
};

type ReservationLike = {
  id: string;
  eventPlanId: string;
  vendorId: string;
  quoteRequestId?: string | null;
  quoteResponseId: string | null;
  serviceDate: Date | null;
  quotedAmount: number | null;
  confirmedAmount: number | null;
  vendorConfirmationDueAt?: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  vendor?: VendorLike;
  quoteResponse?: QuoteResponseLike | null;
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
    selectedModules: stringArrayFromJson(request.selectedModules),
    preferredDate: request.preferredDate?.toISOString() ?? null,
    budget: request.budget,
    status: mapQuoteStatus(request.status),
    createdAt: request.createdAt.toISOString()
  };
}

export function mapQuoteResponse(response: QuoteResponseLike): QuoteResponseData {
  return {
    id: response.id,
    requestId: response.requestId,
    vendorId: response.vendorId,
    basePrice: response.basePrice,
    modules: response.modules as unknown as QuoteResponseModules,
    totalPrice: response.totalPrice,
    note: response.note,
    createdAt: response.createdAt.toISOString(),
    vendor: response.vendor ? mapVendorProfile(response.vendor) : undefined
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
  return {
    id: reservation.id,
    planId: reservation.eventPlanId,
    vendorId: reservation.vendorId,
    quoteRequestId: reservation.quoteRequestId ?? null,
    quoteResponseId: reservation.quoteResponseId,
    reservedDate: (reservation.serviceDate ?? reservation.createdAt).toISOString(),
    totalAmount: reservation.confirmedAmount ?? reservation.quotedAmount ?? 0,
    vendorConfirmationDueAt: reservation.vendorConfirmationDueAt?.toISOString() ?? null,
    status: mapReservationStatus(reservation.status),
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
    vendor: reservation.vendor ? mapVendorProfile(reservation.vendor) : undefined,
    quoteResponse: reservation.quoteResponse ? mapQuoteResponse(reservation.quoteResponse) : undefined
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
