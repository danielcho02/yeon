"use client";

import { type ElementType, type ReactNode, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowUp,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Clock,
  ClipboardList,
  Heart,
  Inbox,
  LayoutList,
  MessageSquare,
  MessageSquareQuote,
  Shield,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveReservationCancellationRequest,
  approveReservationChangeRequest,
  confirmReservation,
  rejectReservationCancellationRequest,
  rejectReservationChangeRequest
} from "@/app/actions/reservation";
import { declineQuoteRequest, submitQuoteResponse, submitQuoteRevision } from "@/app/actions/quote";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getQuoteStatusMeta,
  type MvpQuoteEventType
} from "@/lib/step3.shared";
import { ServiceManager } from "@/app/vendor/dashboard/service-manager";
import type { QuoteProposalRevisionData, QuoteRequestForVendorDTO } from "@/types/quote";
import type {
  VendorDashboardReservationCancellationRequestDTO,
  VendorDashboardReservationChangeRequestDTO
} from "@/types/reservation";
import type {
  VendorPackagePriceSnapshot,
  VendorPackageSnapshot,
  VendorPackageSnapshotItem
} from "@/types/vendor-package";
import type { VendorServiceModuleData } from "@/types/vendor-module";

import { asDateInput, getWorkspaceTheme, type ReservationItem } from "./workspace-types";

type ServiceRow = {
  id: string;
  eventType: string;
  module: string;
  catalogKey: string | null;
  category: string;
  pricingType: string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  isBaseIncluded: boolean;
};

type PackageRow = {
  id: string;
  vendorId: string;
  eventType: string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
  items: Array<{
    id: string;
    vendorServiceModuleId: string;
    selectionType: "INCLUDED" | "OPTIONAL";
    quantity: number;
    priceOverride: number | null;
  }>;
};

type InboxItem =
  | { type: "reservation"; id: string; label: string; eventPlanTitle: string; eventType?: string; requirements: string | null }
  | { type: "quoteRequest"; id: string; label: string; eventPlanTitle: string; eventType?: string; requirements: string | null };

type Props = {
  viewerName: string;
  viewerEmail: string;
  companyName: string;
  reservations: ReservationItem[];
  pendingConfirmations?: ReservationItem[];
  pendingChangeRequests?: VendorDashboardReservationChangeRequestDTO[];
  pendingCancellationRequests?: VendorDashboardReservationCancellationRequestDTO[];
  supportedEventTypes?: MvpQuoteEventType[];
  supportedServiceModules?: string[];
  vendorServices?: ServiceRow[];
  vendorPackages?: PackageRow[];
  quoteRequests?: QuoteRequestForVendorDTO[];
};

type PanelKey = "home" | "inbox" | "proposals" | "final_confirm" | "reservation_requests" | "confirmed";

const PANELS: Array<{ key: PanelKey; label: string; description: string; icon: ElementType }> = [
  { key: "home",          label: "업무 홈",       description: "오늘 처리할 일",        icon: TrendingUp },
  { key: "inbox",         label: "새 요청",       description: "신규 수신 요청",        icon: Inbox },
  { key: "proposals",     label: "견적 응답",     description: "제안 상태 관리",       icon: MessageSquareQuote },
  { key: "final_confirm", label: "최종 확정",     description: "고객 수락 완료 및 대기",  icon: Clock },
  { key: "reservation_requests", label: "변경/취소", description: "승인 요청 처리", icon: ClipboardList },
  { key: "confirmed",     label: "확정 예약",     description: "확정 일정 관리",        icon: BadgeCheck },
];

type FinalConfirmTone = {
  banner: string;
  bannerIconWrap: string;
  bannerEyebrow: string;
  bannerCopy: string;
  bannerButton: string;
  metricActive: string;
  emphasisCard: string;
  emphasisDot: string;
  emphasisBadge: string;
  emphasisText: string;
  emphasisDivider: string;
  emphasisTitle: string;
  emphasisEmpty: string;
  infoCard: string;
  infoTitle: string;
  infoButton: string;
};

const FINAL_CONFIRM_TONES: Record<"WEDDING" | "FUNERAL" | "DEFAULT", FinalConfirmTone> = {
  WEDDING: {
    banner: "border-[#ebdccf] bg-[#fcf7f1]",
    bannerIconWrap: "bg-[#fcf1e7] text-[#c4977a]",
    bannerEyebrow: "text-[#9b6b4f]",
    bannerCopy: "text-[#8c8275]",
    bannerButton: "bg-[#c4977a] hover:bg-[#b08569]",
    metricActive: "bg-[#fcf7f1] border-[#ebdccf] text-[#9b6b4f] font-bold",
    emphasisCard: "border-[#ebdccf] bg-[#fcfbf8]",
    emphasisDot: "bg-[#c4977a]",
    emphasisBadge: "bg-[#fcf7f1] text-[#9b6b4f] border border-[#ebdccf]",
    emphasisText: "text-[#9b6b4f]",
    emphasisDivider: "divide-[#f0e6da]",
    emphasisTitle: "text-[#7d5d47]",
    emphasisEmpty: "text-[#9b6b4f]/60",
    infoCard: "border-[#ebdccf] bg-[#fcf7f1]/70 text-[#7d5d47]",
    infoTitle: "text-[#7d5d47]",
    infoButton: "bg-[#c4977a] text-white hover:bg-[#b08569]"
  },
  FUNERAL: {
    banner: "border-[#cbd3e0] bg-[#f4f6fa]",
    bannerIconWrap: "bg-[#e6ebf3] text-[#2c3455]",
    bannerEyebrow: "text-[#2c3455]",
    bannerCopy: "text-[#475569]",
    bannerButton: "bg-[#2c3455] hover:bg-[#1e2645]",
    metricActive: "bg-[#eef2f6] border-[#cbd3e0] text-[#2c3455] font-bold",
    emphasisCard: "border-[#cbd3e0] bg-[#f7f8fb]",
    emphasisDot: "bg-[#2c3455]",
    emphasisBadge: "bg-[#eef2f6] text-[#2c3455] border border-[#cbd3e0]",
    emphasisText: "text-[#2c3455]",
    emphasisDivider: "divide-[#dbe2ec]",
    emphasisTitle: "text-[#2c3455]",
    emphasisEmpty: "text-[#475569]/60",
    infoCard: "border-[#cbd3e0] bg-[#eef2f6]/60 text-[#2c3455]",
    infoTitle: "text-[#2c3455]",
    infoButton: "bg-[#2c3455] text-white hover:bg-[#1e2645]"
  },
  DEFAULT: {
    banner: "border-[#cbd3e0] bg-[#f4f6fa]",
    bannerIconWrap: "bg-[#e6ebf3] text-[#2c3455]",
    bannerEyebrow: "text-[#2c3455]",
    bannerCopy: "text-[#475569]",
    bannerButton: "bg-[#2c3455] hover:bg-[#1e2645]",
    metricActive: "bg-[#eef2f6] border-[#cbd3e0] text-[#2c3455] font-bold",
    emphasisCard: "border-[#cbd3e0] bg-[#f7f8fb]",
    emphasisDot: "bg-[#2c3455]",
    emphasisBadge: "bg-[#eef2f6] text-[#2c3455] border border-[#cbd3e0]",
    emphasisText: "text-[#2c3455]",
    emphasisDivider: "divide-[#dbe2ec]",
    emphasisTitle: "text-[#2c3455]",
    emphasisEmpty: "text-[#475569]/60",
    infoCard: "border-[#cbd3e0] bg-[#eef2f6]/60 text-[#2c3455]",
    infoTitle: "text-[#2c3455]",
    infoButton: "bg-[#2c3455] text-white hover:bg-[#1e2645]"
  }
};

function getFinalConfirmTone(eventType?: string | null) {
  if (eventType === "WEDDING") return FINAL_CONFIRM_TONES.WEDDING;
  if (eventType === "FUNERAL") return FINAL_CONFIRM_TONES.FUNERAL;
  return FINAL_CONFIRM_TONES.DEFAULT;
}

function getServiceLabel(r: ReservationItem) {
  const isBundle = r.eventPlan.type === "FUNERAL" && 
    (r.vendor?.companyName?.includes("한결") || r.vendor?.name?.includes("한결") || 
     r.vendor?.companyName?.includes("의전") || r.vendor?.name?.includes("의전"));
  
  if (isBundle) {
    return "장례식장·기본 의전";
  }
  
  return getQuoteServiceModuleLabel({
    eventType: r.eventPlan.type,
    serviceCategory: r.serviceCategory,
    serviceName: r.serviceName
  });
}

function getQuoteRequestServiceLabel(qr: QuoteRequestForVendorDTO) {
  const modules = qr.selectedModuleDetails ?? [];
  if (modules.length === 0) return qr.plan?.title ?? "견적 요청";
  return modules.length === 1 ? modules[0].name : `${modules[0].name} 외 ${modules.length - 1}개`;
}

function getCurrentQuoteRevision(qr: QuoteRequestForVendorDTO) {
  return qr.responses[0]?.currentRevision ?? null;
}

function hasPendingAdjustment(qr: QuoteRequestForVendorDTO) {
  return qr.status === "RESPONDED" && getCurrentQuoteRevision(qr)?.status === "ADJUSTMENT_REQUESTED";
}

function getVendorRevisionLabel(revision: QuoteProposalRevisionData) {
  if (revision.status === "ACCEPTED") return "수락한 제안";
  if (revision.status === "ADJUSTMENT_REQUESTED") return "플래너 조정 요청";
  if (revision.status === "REVISED") return "업체 수정 제안";
  return revision.version === 1 ? "업체 최초 제안" : "업체 제안";
}

function getModulePricingTypeLabel(pricingType: VendorServiceModuleData["pricingType"]) {
  return pricingType === "PER_GUEST" ? "인원 기준" : "고정가";
}

function formatModuleBasePrice(module: VendorServiceModuleData) {
  return module.pricingType === "PER_GUEST"
    ? `${formatCurrency(module.price)} / 1인`
    : formatCurrency(module.price);
}

function formatModuleEstimatedTotal(module: VendorServiceModuleData, guestCount: number | null | undefined) {
  if (module.pricingType !== "PER_GUEST" || !guestCount) return null;
  return formatCurrency(module.price * guestCount);
}

function formatPackageSnapshotItemPrice(item: VendorPackageSnapshotItem) {
  if (item.price === 0) return "포함";
  if (item.pricingType === "PER_GUEST") {
    return `${formatCurrency(item.price)} × ${item.quantity}명 = ${formatCurrency(item.subtotal)}`;
  }
  if (item.quantity > 1) {
    return `${formatCurrency(item.price)} × ${item.quantity} = ${formatCurrency(item.subtotal)}`;
  }
  return formatCurrency(item.subtotal);
}

function getQuoteRequestDateLabel(qr: QuoteRequestForVendorDTO) {
  if (qr.preferredDateStart && qr.preferredDateEnd) {
    return `${formatDate(qr.preferredDateStart)} - ${formatDate(qr.preferredDateEnd)}`;
  }

  return formatDate(qr.preferredDate ?? qr.plan?.eventDate);
}

function getInitialProposalDate(qr: QuoteRequestForVendorDTO) {
  return (
    qr.responses[0]?.currentRevision?.proposedServiceDate ??
    qr.preferredDate ??
    qr.preferredDateStart ??
    qr.plan?.eventDate ??
    null
  );
}

function isFixedWeddingRequest(qr: QuoteRequestForVendorDTO | null | undefined) {
  return qr?.plan?.eventType === "WEDDING" && Boolean(qr.preferredDate) && !qr.preferredDateStart && !qr.preferredDateEnd;
}

function isWeddingRangeRequest(qr: QuoteRequestForVendorDTO | null | undefined) {
  return qr?.plan?.eventType === "WEDDING" && Boolean(qr.preferredDateStart && qr.preferredDateEnd);
}

function getPackageLineItems(
  priceSnapshot: VendorPackagePriceSnapshot | null | undefined,
  source: VendorPackageSnapshotItem["source"]
) {
  return (priceSnapshot?.lineItems ?? []).filter((item) => item.source === source);
}

function PackageSnapshotItemList({
  items,
  emptyText
}: {
  items: VendorPackageSnapshotItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-[11px] leading-5 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.source}:${item.id}:${item.packageItemId ?? "direct"}`}
          className="flex items-start justify-between gap-3 rounded-lg border border-[#f2ece4]/70 bg-white px-3 py-2"
        >
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#2c3455]">{item.name}</span>
              {item.source === "VENDOR_ADDON" && (
                <span className="rounded-full border border-[#ebdccf]/60 bg-[#fcfaf7] px-2 py-0.5 text-[9px] font-semibold text-[#8c8275]">
                  업체 전용
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-[10px] leading-4 text-muted-foreground">{item.description}</p>
            )}
          </div>
          <span className="shrink-0 text-[10px] font-bold text-[#c4977a]">
            {formatPackageSnapshotItemPrice(item)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PackageEstimateContext({
  packageSnapshot,
  priceSnapshot,
  requestMemo
}: {
  packageSnapshot: VendorPackageSnapshot;
  priceSnapshot?: VendorPackagePriceSnapshot | null;
  requestMemo?: string | null;
}) {
  const selectedOptionalItems = getPackageLineItems(priceSnapshot, "PACKAGE_OPTIONAL");
  const vendorAddOnItems = getPackageLineItems(priceSnapshot, "VENDOR_ADDON");

  return (
    <div className="rounded-xl border border-[#ebdccf]/50 bg-white p-4 text-xs text-[#2c3455] space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#c4977a]">원 요청 패키지 기준</p>
          <p className="font-bold">{packageSnapshot.name}</p>
          {packageSnapshot.description && (
            <p className="leading-5 text-muted-foreground">{packageSnapshot.description}</p>
          )}
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[9px] text-muted-foreground">요청 예상 총액</span>
          <span className="font-[var(--font-serif)] text-lg font-bold text-[#c4977a]">
            {priceSnapshot ? formatCurrency(priceSnapshot.estimatedTotal) : formatCurrency(packageSnapshot.basePrice)}
          </span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DetailRow label="패키지 기본가" value={formatCurrency(priceSnapshot?.packageBasePrice ?? packageSnapshot.basePrice)} />
        <DetailRow label="선택 추가 항목" value={formatCurrency(priceSnapshot?.selectedAddOnsSubtotal ?? 0)} />
        <DetailRow label="요청 인원" value={priceSnapshot?.guestCount ? `${priceSnapshot.guestCount}명` : "미정"} />
      </div>

      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">선택한 추가 항목</p>
        <PackageSnapshotItemList
          items={[...selectedOptionalItems, ...vendorAddOnItems]}
          emptyText="추가 선택 항목 없이 패키지 기본 구성으로 요청되었습니다."
        />
      </div>

      {requestMemo && (
        <div className="rounded-lg border border-[#f2ece4]/80 bg-[#faf9f5]/60 px-3 py-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">사용자 요청 메모</p>
          <p className="leading-5">{requestMemo}</p>
        </div>
      )}
    </div>
  );
}

function VendorProposalRevisionHistory({ quoteRequest }: { quoteRequest: QuoteRequestForVendorDTO }) {
  const response = quoteRequest.responses[0];
  if (!response) return null;

  const revisions = [...response.revisions].sort((a, b) => a.version - b.version);
  if (revisions.length === 0) return null;

  const currentId = response.currentRevision?.id ?? revisions[revisions.length - 1]?.id;
  const recordCount = revisions.reduce((count, revision) => {
    return count + 1 + (revision.adjustmentRequestMemo ? 1 : 0);
  }, 0);

  return (
    <details className="rounded-xl border border-[#ebdccf]/50 bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-[#2c3455]">
        <span>제안 조율 내역</span>
        <span className="text-[10px] font-semibold text-[#8c8275]">{recordCount}개 기록</span>
      </summary>
      <div className="space-y-2 border-t border-[#f2ece4] px-4 py-3">
        {revisions.map((revision) => {
          const isCurrent = revision.id === currentId;
          const isPlannerAdjustment = revision.status === "ADJUSTMENT_REQUESTED";
          const isAccepted = revision.status === "ACCEPTED";
          return (
            <div key={revision.id} className="space-y-2">
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isPlannerAdjustment
                    ? "border-amber-200/70 bg-amber-50/35 text-amber-900"
                    : isAccepted
                    ? "border-emerald-200/70 bg-emerald-50/35 text-emerald-900"
                    : isCurrent
                    ? "border-[#ebdccf] bg-[#faf9f5] text-[#2c3455]"
                    : "border-[#f2ece4] bg-white text-[#2c3455]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{getVendorRevisionLabel(revision)}</span>
                  <span className="font-bold text-[#c4977a]">{formatCurrency(revision.totalPrice)}</span>
                </div>
                {revision.memo && (
                  <p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">{revision.memo}</p>
                )}
              </div>
              {revision.adjustmentRequestMemo && (
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-xs text-amber-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">플래너 조정 요청</span>
                    {revision.plannerRequestedTotalPrice != null && (
                      <span className="font-bold">{formatCurrency(revision.plannerRequestedTotalPrice)}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 leading-5">{revision.adjustmentRequestMemo}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ReservationPackageContext({
  reservation,
  compact = false
}: {
  reservation: ReservationItem;
  compact?: boolean;
}) {
  const packageSnapshot = reservation.selectedPackageSnapshot;
  if (!packageSnapshot) return null;

  const priceSnapshot = reservation.priceSnapshot;
  const selectedOptionalItems = getPackageLineItems(priceSnapshot, "PACKAGE_OPTIONAL");
  const vendorAddOnItems = getPackageLineItems(priceSnapshot, "VENDOR_ADDON");
  const finalAmount = reservation.confirmedAmount ?? reservation.quotedAmount ?? 0;

  if (compact) {
    return (
      <details className="rounded-xl border border-[#ebdccf]/50 bg-[#faf9f5]/45 text-xs text-[#2c3455]">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 font-bold">
          <span>수락된 패키지 · {packageSnapshot.name}</span>
          <span className="text-[10px] text-[#8c8275]">상세 보기</span>
        </summary>
        <div className="space-y-3 border-t border-[#f2ece4] px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <DetailRow label="패키지 기본가" value={formatCurrency(priceSnapshot?.packageBasePrice ?? packageSnapshot.basePrice)} />
            <DetailRow label="선택 추가 항목" value={formatCurrency(priceSnapshot?.selectedAddOnsSubtotal ?? 0)} />
            <DetailRow label="요청 예상 총액" value={priceSnapshot ? formatCurrency(priceSnapshot.estimatedTotal) : "미정"} />
          </div>
          <PackageSnapshotItemList
            items={[...selectedOptionalItems, ...vendorAddOnItems]}
            emptyText="추가 선택 항목 없이 패키지 기본 구성으로 수락되었습니다."
          />
        </div>
      </details>
    );
  }

  return (
    <div className="rounded-xl border border-[#ebdccf]/50 bg-white p-4 text-xs text-[#2c3455] space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#c4977a]">
            수락된 패키지 / 제안 요약
          </p>
          <p className="font-bold">{packageSnapshot.name}</p>
          {packageSnapshot.description && !compact && (
            <p className="leading-5 text-muted-foreground">{packageSnapshot.description}</p>
          )}
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[9px] text-muted-foreground">최종 수락 총액</span>
          <span className="font-[var(--font-serif)] text-lg font-bold text-[#c4977a]">
            {formatCurrency(finalAmount)}
          </span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <DetailRow label="패키지 기본가" value={formatCurrency(priceSnapshot?.packageBasePrice ?? packageSnapshot.basePrice)} />
        <DetailRow label="선택 추가 항목" value={formatCurrency(priceSnapshot?.selectedAddOnsSubtotal ?? 0)} />
        <DetailRow label="요청 예상 총액" value={priceSnapshot ? formatCurrency(priceSnapshot.estimatedTotal) : "미정"} />
      </div>

      {!compact && packageSnapshot.includedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">패키지 포함 항목</p>
          <PackageSnapshotItemList
            items={packageSnapshot.includedItems}
            emptyText="패키지 포함 항목 정보가 없습니다."
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">선택한 추가 항목</p>
        <PackageSnapshotItemList
          items={[...selectedOptionalItems, ...vendorAddOnItems]}
          emptyText="추가 선택 항목 없이 패키지 기본 구성으로 수락되었습니다."
        />
      </div>
    </div>
  );
}

function ModuleRequestScope({
  modules,
  eventType,
  guestCount,
  heading,
  summaryTone = "accent"
}: {
  modules: VendorServiceModuleData[];
  eventType?: string | null;
  guestCount?: number | null;
  heading: string;
  summaryTone?: "accent" | "muted";
}) {
  if (modules.length === 0) return null;

  const toneClass =
    summaryTone === "accent"
      ? "border-[#ebdccf]/40 bg-white"
      : "border-[#e5e2da]/50 bg-[#fcfaf7]";

  return (
    <div className={`rounded-xl border p-4 text-xs text-[#2c3455] ${toneClass}`}>
      <p className="mb-3 text-[9px] font-bold uppercase tracking-wider text-[#c4977a]">{heading}</p>
      <div className="space-y-2.5">
        {modules.map((module) => {
          const estimatedTotal = formatModuleEstimatedTotal(module, guestCount);
          return (
            <div
              key={module.id}
              className="rounded-xl border border-[#f2ece4] bg-[#faf9f5]/55 px-3.5 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[#2c3455]">{module.name}</span>
                    <span className="rounded-full border border-[#ebdccf]/70 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#8c8275]">
                      {eventType
                        ? getQuoteServiceModuleLabel({ eventType, serviceCategory: module.category })
                        : module.category}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {module.isBaseIncluded ? "기본 포함" : "추가 선택"}
                    </span>
                    {module.catalogKey === null && (
                      <span className="rounded-full border border-[#ebdccf]/60 bg-white px-2 py-0.5 text-[9px] font-semibold text-[#8c8275]">
                        업체 전용
                      </span>
                    )}
                  </div>
                  {module.description && (
                    <p className="text-[11px] leading-5 text-muted-foreground">{module.description}</p>
                  )}
                </div>
                <div className="space-y-1 text-left sm:text-right">
                  <p className="text-[10px] font-semibold text-[#8c8275]">
                    기준가 {formatModuleBasePrice(module)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    가격 방식 {getModulePricingTypeLabel(module.pricingType)}
                  </p>
                  {estimatedTotal && (
                    <p className="text-[10px] font-semibold text-[#2c3455]">
                      요청 기준 예상 {estimatedTotal}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VendorWorkspace({
  viewerName,
  viewerEmail,
  companyName,
  reservations,
  pendingConfirmations,
  pendingChangeRequests = [],
  pendingCancellationRequests = [],
  supportedEventTypes,
  supportedServiceModules,
  vendorServices,
  vendorPackages,
  quoteRequests
}: Props) {
  const router = useRouter();
  const pendingConfirmationsRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();
  const [activePanel, setActivePanel] = useState<PanelKey>("home");
  const [showServiceManager, setShowServiceManager] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState("");

  function getRequestMemo(reservation: ReservationItem | null | undefined) {
    if (!reservation) return null;
    return reservation.requestMemo ?? (reservation.quoteResponseId ? null : reservation.notes);
  }

  const inboxReservations = useMemo(() => {
    const base = reservations.filter((r) => r.status === "PENDING" && r.quoteResponseId == null);
    if (!supportedEventTypes || supportedEventTypes.length === 0) return base;
    return base.filter((r) => !r.eventPlan.type || supportedEventTypes.includes(r.eventPlan.type as MvpQuoteEventType));
  }, [reservations, supportedEventTypes]);
  const pendingQuoteRequests = useMemo(
    () => (quoteRequests ?? []).filter((qr) => qr.status === "PENDING"),
    [quoteRequests]
  );
  const respondedQuoteRequests = useMemo(
    () => (quoteRequests ?? []).filter((qr) => qr.status === "RESPONDED" && qr.responses.length > 0),
    [quoteRequests]
  );

  const inboxItems = useMemo<InboxItem[]>(() => {
    const fromReservations: InboxItem[] = inboxReservations.map((r) => ({
      type: "reservation" as const,
      id: r.id,
      label: getServiceLabel(r),
      eventPlanTitle: r.eventPlan.title,
      eventType: r.eventPlan.type,
      requirements: getRequestMemo(r)
    }));
    const fromQuoteRequests: InboxItem[] = pendingQuoteRequests.map((qr) => ({
      type: "quoteRequest" as const,
      id: qr.id,
      label: getQuoteRequestServiceLabel(qr),
      eventPlanTitle: qr.plan?.title ?? "행사",
      eventType: qr.plan?.eventType,
      requirements: qr.requirements
    }));
    return [...fromReservations, ...fromQuoteRequests];
  }, [inboxReservations, pendingQuoteRequests]);
  const pendingConfirmationReservations = useMemo(
    () =>
      pendingConfirmations ??
      reservations.filter((r) => r.status === "PENDING" && r.quoteRequestStatus === "ACCEPTED"),
    [pendingConfirmations, reservations]
  );
  const pendingConfirmationIds = useMemo(
    () => new Set(pendingConfirmationReservations.map((reservation) => reservation.id)),
    [pendingConfirmationReservations]
  );
  const inProgressReservations = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.status === "PENDING" &&
          r.quoteResponseId != null &&
          r.quoteRequestStatus !== "ACCEPTED" &&
          !pendingConfirmationIds.has(r.id)
      ),
    [pendingConfirmationIds, reservations]
  );
  const confirmedReservations = useMemo(
    () => reservations.filter((r) => r.status === "CONFIRMED" || r.status === "COMPLETED"),
    [reservations]
  );

  const fallbackReservation =
    pendingConfirmationReservations[0] ?? inboxReservations[0] ?? inProgressReservations[0] ?? confirmedReservations[0] ?? null;
  const [selectedReservationId, setSelectedReservationId] = useState(fallbackReservation?.id ?? "");
  const selectedReservation =
    reservations.find((r) => r.id === selectedReservationId) ?? fallbackReservation;
  const vendorPrimaryType =
    supportedEventTypes?.includes("WEDDING") && supportedEventTypes?.includes("FUNERAL")
      ? null
      : supportedEventTypes?.includes("WEDDING")
      ? "WEDDING"
      : supportedEventTypes?.includes("FUNERAL")
      ? "FUNERAL"
      : null;
  const theme = getWorkspaceTheme(
    selectedReservation?.eventPlan.type ?? vendorPrimaryType
  );
  const finalConfirmTone = getFinalConfirmTone(
    selectedReservation?.eventPlan.type ?? vendorPrimaryType
  );
  const ThemeIcon = theme.toneIcon;
  const inboxEmptyText =
    vendorPrimaryType === "WEDDING"
      ? "새로운 웨딩 견적 요청이 없습니다."
      : vendorPrimaryType === "FUNERAL"
      ? "새로운 장례 서비스 요청이 없습니다."
      : "새 요청이 없습니다.";

  function getResponseMessage(reservation: ReservationItem | null | undefined) {
    if (!reservation?.quoteResponseId) return "";
    return reservation.responseMessage ?? "";
  }

  const [proposalForm, setProposalForm] = useState(() => ({
    reservationId: selectedReservation?.id ?? "",
    quoteRequestId: "",
    serviceDate: asDateInput(selectedReservation?.serviceDate ?? null),
    proposalAmount: selectedReservation?.confirmedAmount
      ? String(selectedReservation.confirmedAmount)
      : selectedReservation?.quotedAmount
      ? String(selectedReservation.quotedAmount)
      : "",
    notes: getResponseMessage(selectedReservation)
  }));

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);

  function loadReservation(reservation: ReservationItem, nextPanel?: PanelKey) {
    setSelectedReservationId(reservation.id);
    setProposalForm({
      reservationId: reservation.id,
      quoteRequestId: "",
      serviceDate: asDateInput(reservation.serviceDate),
      proposalAmount: reservation.confirmedAmount
        ? String(reservation.confirmedAmount)
        : reservation.quotedAmount
        ? String(reservation.quotedAmount)
        : "",
      notes: getResponseMessage(reservation)
    });
    setMessage(null);
    setError(null);
    if (nextPanel) setActivePanel(nextPanel);
  }

  function loadQuoteRequest(qr: QuoteRequestForVendorDTO, nextPanel?: PanelKey) {
    const currentRevision = getCurrentQuoteRevision(qr);
    const isAdjustmentRequest = currentRevision?.status === "ADJUSTMENT_REQUESTED";
    setProposalForm({
      reservationId: "",
      quoteRequestId: qr.id,
      serviceDate: asDateInput(getInitialProposalDate(qr)),
      proposalAmount: isAdjustmentRequest
        ? ""
        : currentRevision?.totalPrice
        ? String(currentRevision.totalPrice)
        : qr.priceSnapshot?.estimatedTotal
        ? String(qr.priceSnapshot.estimatedTotal)
        : qr.budget
        ? String(qr.budget)
        : "",
      notes: ""
    });
    setMessage(null);
    setError(null);
    if (nextPanel) setActivePanel(nextPanel);
  }

  function clearProposalForm() {
    setProposalForm({
      reservationId: "",
      quoteRequestId: "",
      serviceDate: "",
      proposalAmount: "",
      notes: ""
    });
  }

  async function acceptPlannerRequestedTotal() {
    if (!selectedQuoteRequest || !selectedCurrentRevision || selectedCurrentRevision.status !== "ADJUSTMENT_REQUESTED") {
      setError("조정 요청을 선택해 주세요.");
      return;
    }
    if (selectedCurrentRevision.plannerRequestedTotalPrice == null) {
      setError("플래너 희망 조정 금액을 찾을 수 없습니다.");
      return;
    }
    const response = selectedQuoteRequest.responses[0];
    if (!response) {
      setError("수정할 기존 제안을 찾을 수 없습니다.");
      return;
    }
    if (busyReservationId === selectedQuoteRequest.id) return;

    setBusyReservationId(selectedQuoteRequest.id);
    setMessage(null);
    setError(null);
    try {
      const result = await submitQuoteRevision({
        quoteResponseId: response.id,
        totalPrice: selectedCurrentRevision.plannerRequestedTotalPrice,
        memo: proposalForm.notes || undefined
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("요청 금액으로 수정 제안을 보냈습니다. 플래너 수락 대기 중입니다.");
      clearProposalForm();
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  async function updateReservation(action: "quote" | "decline") {
    const activeQuoteRequestId = proposalForm.quoteRequestId;

    // Canonical path: QuoteRequest without Reservation
    if (activeQuoteRequestId) {
      const selectedQr = (quoteRequests ?? []).find(qr => qr.id === activeQuoteRequestId);
      if (!selectedQr) {
        setError("견적 요청을 찾을 수 없습니다.");
        return;
      }

      if (action === "decline") {
        if (selectedQr.status !== "PENDING" || selectedQr.responses.length > 0) {
          setError("일정 불가 회신은 신규 요청에서만 보낼 수 있습니다.");
          return;
        }
        if (busyReservationId === activeQuoteRequestId) return;
        setBusyReservationId(activeQuoteRequestId);
        setMessage(null);
        setError(null);
        try {
          const result = await declineQuoteRequest(
            activeQuoteRequestId,
            proposalForm.notes || undefined
          );
          if (!result.success) {
            setError(result.error);
            return;
          }
          setMessage("일정 불가로 회신했습니다.");
          setProposalForm({
            reservationId: "",
            quoteRequestId: "",
            serviceDate: "",
            proposalAmount: "",
            notes: ""
          });
          startTransition(() => router.refresh());
        } finally {
          setBusyReservationId(null);
        }
        return;
      }
      if (!proposalForm.proposalAmount) {
        setError("최종 제안 총액을 입력해 주세요.");
        return;
      }
      if (busyReservationId === activeQuoteRequestId) return;
      setBusyReservationId(activeQuoteRequestId);
      setMessage(null);
      setError(null);
      try {
        const isAdjustmentReply = hasPendingAdjustment(selectedQr);
        if (selectedQr.status !== "PENDING" && !isAdjustmentReply) {
          setError("수정 요청이 있는 견적만 다시 제안할 수 있습니다.");
          return;
        }
        if (isAdjustmentReply) {
          const response = selectedQr.responses[0];
          if (!response) {
            setError("수정할 기존 제안을 찾을 수 없습니다.");
            return;
          }
          const result = await submitQuoteRevision({
            quoteResponseId: response.id,
            totalPrice: Number(proposalForm.proposalAmount),
            memo: proposalForm.notes || undefined
          });
          if (!result.success) { setError(result.error); return; }
          setMessage("수정 제안을 보냈습니다. 플래너 수락 대기 중입니다.");
          clearProposalForm();
          startTransition(() => router.refresh());
          return;
        }
        if ((isWeddingRangeRequest(selectedQr) || selectedQr.plan?.eventType === "FUNERAL") && !proposalForm.serviceDate) {
          setError(
            selectedQr.plan?.eventType === "FUNERAL"
              ? "빈소 접수일을 확인해 주세요."
              : "희망 날짜 범위 안에서 가능한 서비스 날짜를 선택해 주세요."
          );
          return;
        }
        const selectedModules = selectedQr.selectedModuleDetails ?? [];
        const result = await submitQuoteResponse({
          requestId: activeQuoteRequestId,
          basePrice: Number(proposalForm.proposalAmount),
          modules: {
            basePackage: {
              name: selectedQr.selectedPackageSnapshot?.name ?? selectedQr.plan?.title ?? "견적 제안",
              price: Number(proposalForm.proposalAmount),
              description:
                selectedQr.selectedPackageSnapshot?.description ??
                (proposalForm.notes || "업체가 제출한 견적 제안입니다.")
            },
            includedModules: selectedModules.map((module) => ({
              id: module.id,
              name: module.name,
              category: module.category,
              price: 0,
              description: module.description ?? undefined
            })),
            optionalModules: [],
            excludedModules: []
          },
          totalPrice: Number(proposalForm.proposalAmount),
          note: proposalForm.notes || undefined,
          proposedServiceDate: proposalForm.serviceDate || undefined
        });
        if (!result.success) { setError(result.error); return; }
        setMessage("견적 응답을 보냈습니다.");
        clearProposalForm();
        startTransition(() => router.refresh());
      } finally {
        setBusyReservationId(null);
      }
      return;
    }

    setError("응답할 견적 요청을 먼저 선택해 주세요.");
  }

  async function confirmAcceptedReservation(reservationId: string) {
    if (busyReservationId === reservationId) return;
    setBusyReservationId(reservationId);
    setMessage(null);
    setError(null);

    try {
      const result = await confirmReservation(reservationId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessage("예약이 최종 확정되었습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  async function decideChangeRequest(requestId: string, decision: "approve" | "reject") {
    if (busyRequestId === requestId) return;
    setBusyRequestId(requestId);
    setMessage(null);
    setError(null);

    try {
      const result =
        decision === "approve"
          ? await approveReservationChangeRequest(requestId)
          : await rejectReservationChangeRequest(requestId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessage(decision === "approve" ? "예약 변경 요청을 승인했습니다." : "예약 변경 요청을 거절했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyRequestId("");
    }
  }

  async function decideCancellationRequest(requestId: string, decision: "approve" | "reject") {
    if (busyRequestId === requestId) return;
    setBusyRequestId(requestId);
    setMessage(null);
    setError(null);

    try {
      const result =
        decision === "approve"
          ? await approveReservationCancellationRequest(requestId)
          : await rejectReservationCancellationRequest(requestId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessage(decision === "approve" ? "예약 취소 요청을 승인했습니다." : "예약 취소 요청을 거절했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyRequestId("");
    }
  }

  const confirmedTotal = confirmedReservations.reduce(
    (sum, r) => sum + (r.confirmedAmount ?? r.quotedAmount ?? 0),
    0
  );
  const proposalActivityCount = inProgressReservations.length + respondedQuoteRequests.length;
  const pendingReservationRequestCount = pendingChangeRequests.length + pendingCancellationRequests.length;

  const panelCount = {
    home: pendingConfirmationReservations.length + inboxItems.length + pendingReservationRequestCount,
    inbox: inboxItems.length,
    proposals: proposalActivityCount,
    final_confirm: pendingConfirmationReservations.length,
    reservation_requests: pendingReservationRequestCount,
    confirmed: confirmedReservations.length,
  };

  const selectedQuoteRequest = proposalForm.quoteRequestId
    ? (quoteRequests ?? []).find(qr => qr.id === proposalForm.quoteRequestId) ?? null
    : null;
  const isSelectedAdjustmentQuoteRequest = selectedQuoteRequest ? hasPendingAdjustment(selectedQuoteRequest) : false;
  const selectedCurrentRevision = selectedQuoteRequest ? getCurrentQuoteRevision(selectedQuoteRequest) : null;
  const selectedPendingQuoteRequest =
    selectedQuoteRequest?.status === "PENDING" && selectedQuoteRequest.responses.length === 0
      ? selectedQuoteRequest
      : null;
  const selectedAdjustmentMemo = selectedQuoteRequest
    ? selectedCurrentRevision?.adjustmentRequestMemo
    : null;
  const selectedPlannerRequestedTotal = selectedCurrentRevision?.plannerRequestedTotalPrice ?? null;
  const selectedAdjustmentDelta =
    selectedCurrentRevision?.totalPrice != null && selectedPlannerRequestedTotal != null
      ? selectedPlannerRequestedTotal - selectedCurrentRevision.totalPrice
      : null;
  const shouldShowReadOnlyProposalState =
    selectedQuoteRequest?.status === "RESPONDED" && !isSelectedAdjustmentQuoteRequest;

  function scrollToPendingConfirmations() {
    setActivePanel("final_confirm");
    window.setTimeout(() => {
      pendingConfirmationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="grid gap-6">
      {/* ── Partner Header (editorial) ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-1 border-b border-[#e5e2da] pb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ebdccf] bg-white text-[#c4977a]">
            <ThemeIcon className="h-4 w-4" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8c8275]">Partner Portal</p>
        </div>
        <h1 className="mt-2 font-[var(--font-serif)] text-2xl font-normal tracking-tight text-[#2c3455] sm:text-[1.75rem]">
          {companyName}
        </h1>
        <p className="text-xs text-[#8c8275]">{viewerName} · {viewerEmail}</p>
      </header>

      {/* ── Priority Queue (editorial numerals) ─────────────────────────────────── */}
      <section className="grid grid-cols-1 divide-y divide-[#e5e2da] rounded-2xl border border-[#e5e2da] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <PriorityCell
          eyebrow="새 견적 요청"
          count={inboxItems.length}
          hint={inboxItems.length > 0 ? "검토가 필요합니다" : "대기 중인 요청 없음"}
          active={inboxItems.length > 0}
          accent="accent"
          onClick={() => setActivePanel("inbox")}
        />
        <PriorityCell
          eyebrow="견적서 작성 진행"
          count={proposalActivityCount}
          hint={proposalActivityCount > 0 ? "조율 중인 제안" : "진행 중인 제안 없음"}
          active={false}
          accent="neutral"
          onClick={() => setActivePanel("proposals")}
        />
        <PriorityCell
          eyebrow="최종 확정 필요"
          count={pendingConfirmationReservations.length}
          hint={pendingConfirmationReservations.length > 0 ? "고객 수락 완료 · 승인 대기" : "확정 대기 건 없음"}
          active={pendingConfirmationReservations.length > 0}
          accent={selectedReservation?.eventPlan.type === "WEDDING" || vendorPrimaryType === "WEDDING" ? "accent" : "primary"}
          onClick={scrollToPendingConfirmations}
        />
      </section>

      {/* ── Confirmed summary line ─────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 text-xs text-[#8c8275]">
        <span>
          확정 예약 <span className="font-semibold text-[#2c3455] tabular-nums">{confirmedReservations.length}건</span>
        </span>
        <span>
          확정 계약 총액 <span className="font-[var(--font-serif)] text-sm font-semibold text-[#c4977a] tabular-nums">{formatCurrency(confirmedTotal)}</span>
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-xs font-semibold text-rose-800 animate-fade-in flex justify-between items-center shadow-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm">×</button>
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-[#eafaf1]/40 text-emerald-800 px-4 py-3 text-xs font-semibold animate-fade-in flex justify-between items-center shadow-sm">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2 text-sm">×</button>
        </div>
      )}

      {/* ── Panel tab bar (Editorial Slider Style) ──────────────────────────────────────────── */}
      <section className="mb-6 flex flex-col gap-3 border-b border-[#ebdccf]/60 bg-transparent px-1 py-0.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap">
          {PANELS.map((panel) => {
            const count = panelCount[panel.key];
            const isActive = activePanel === panel.key;
            return (
              <button
                key={panel.key}
                onClick={() => {
                  setActivePanel(panel.key);
                  setShowServiceManager(false);
                }}
                className={`relative -mb-[2px] border-b-2 px-4 py-3 text-xs font-semibold transition-[color,border-color] duration-200 ${
                  isActive && !showServiceManager
                    ? "border-[#c4977a] text-[#c4977a]"
                    : "border-transparent text-muted-foreground hover:text-[#2c3455]"
                }`}
              >
                {panel.label}
                {count > 0 && (
                  <span className="ml-1.5 align-text-top text-[10px] font-semibold tabular-nums text-[#8c8275]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowServiceManager((current) => !current)}
          className={`mb-2 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors lg:mb-0 ${
            showServiceManager
              ? "border-[#c4977a] bg-[#fcf8f2] text-[#9b6b4f]"
              : "border-[#e5e2da] bg-white text-[#2c3455] hover:bg-[#faf9f5]"
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          서비스 관리
        </button>
      </section>

      {showServiceManager && (
        <section className="animate-fade-in space-y-4 rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#f2ece4] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">서비스 관리</p>
              <p className="text-xs leading-5 text-muted-foreground">
                운영 탭과 분리된 공급 서비스 설정 영역입니다.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowServiceManager(false)}
              className="rounded-xl text-xs"
            >
              운영 화면으로 돌아가기
            </Button>
          </div>
          <ServiceManager
            supportedEventTypes={supportedEventTypes ?? []}
            supportedModules={supportedServiceModules ?? []}
            existingServices={vendorServices ?? []}
            existingPackages={vendorPackages ?? []}
          />
        </section>
      )}

      {/* ── 1. Home Panel (업무 홈) ──────────────────────────────────────────── */}
      {activePanel === "home" && (
        <section className="animate-fade-in space-y-6">
          {/* Priority Task: Pending Final Confirmations */}
          <div className={`rounded-2xl border p-6 shadow-sm ${finalConfirmTone.emphasisCard}`}>
            <div className={`mb-4 flex items-center justify-between border-b pb-3 ${finalConfirmTone.emphasisDivider}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${finalConfirmTone.emphasisDot}`} />
                <h3 className={`font-[var(--font-serif)] text-sm font-bold ${finalConfirmTone.emphasisTitle}`}>최종 확정 대기 목록</h3>
              </div>
              <Badge className={`${finalConfirmTone.emphasisBadge} text-[10px] rounded-full shadow-none font-bold`}>
                {pendingConfirmationReservations.length}건 대기
              </Badge>
            </div>

            {pendingConfirmationReservations.length ? (
              <div className={`divide-y ${finalConfirmTone.emphasisDivider}`}>
                {pendingConfirmationReservations.map((r) => (
                  <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className={`font-[var(--font-serif)] text-xs font-bold ${finalConfirmTone.emphasisTitle}`}>{r.eventPlan.title}</p>
                      <p className={`text-[10px] ${finalConfirmTone.bannerCopy}`}>
                        {getServiceLabel(r)} · {formatDate(r.serviceDate)} · {formatCurrency(r.confirmedAmount ?? r.quotedAmount)}
                      </p>
                    </div>
                    <Button
                      onClick={scrollToPendingConfirmations}
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-[10px] h-8 font-semibold shadow-sm shrink-0 px-3.5 whitespace-nowrap break-keep border-[#e5e2da] bg-white text-[#2c3455] hover:bg-[#faf9f5]"
                    >
                      <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                      최종 확정 화면으로 이동
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`py-6 text-center text-xs font-medium ${finalConfirmTone.emphasisEmpty}`}>오늘 최종 확정이 필요한 대기 건이 없습니다.</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Inbox Quick View */}
            <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-[#f2ece4] pb-3">
                <h3 className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">새로 도착한 요청</h3>
                <button onClick={() => setActivePanel("inbox")} className="text-[10px] font-bold text-[#c4977a] hover:underline shrink-0">Inbox 가기 →</button>
              </div>

              {inboxItems.length ? (
                <div className="space-y-3">
                  {inboxItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl border border-[#e5e2da]/70 bg-white p-4 transition-[border-color] duration-150 hover:border-[#ebdccf]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-xs text-[#2c3455]">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground/80 mt-0.5">{item.eventPlanTitle}</p>
                        </div>
                        <Button
                          onClick={() => {
                            if (item.type === "reservation") {
                              const r = reservations.find(r => r.id === item.id);
                              if (r) loadReservation(r, "inbox");
                            } else {
                              const qr = (quoteRequests ?? []).find(qr => qr.id === item.id);
                              if (qr) loadQuoteRequest(qr, "inbox");
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="rounded-lg text-[9px] h-7 border-[#e5e2da] text-[#c4977a] hover:bg-[#faf9f5] font-bold px-2.5 shrink-0"
                        >
                          견적 작성
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-xs text-muted-foreground">새로 접수된 요청이 없습니다.</p>
                </div>
              )}
            </div>

            {/* Proposals & Confirmed Quick View */}
            <div className="flex flex-col justify-between gap-5 rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <h3 className="border-b border-[#f2ece4] pb-3 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">진행 현황 요약</h3>
                <button
                  onClick={() => setActivePanel("proposals")}
                  className="flex w-full items-baseline justify-between border-b border-[#f2ece4]/70 pb-3 text-left transition-[color] duration-150 hover:text-[#c4977a]"
                >
                  <span className="text-xs text-[#8c8275]">진행 중인 제안</span>
                  <span className="font-[var(--font-serif)] text-xl font-normal tabular-nums text-[#2c3455]">{proposalActivityCount}</span>
                </button>
                <button
                  onClick={() => setActivePanel("confirmed")}
                  className="flex w-full items-baseline justify-between text-left transition-[color] duration-150 hover:text-[#c4977a]"
                >
                  <span className="text-xs text-[#8c8275]">확정된 예약</span>
                  <span className="font-[var(--font-serif)] text-xl font-normal tabular-nums text-[#2c3455]">{confirmedReservations.length}</span>
                </button>
              </div>

              <button
                onClick={() => setShowServiceManager(true)}
                className="flex items-center justify-between rounded-xl border border-[#ebdccf]/40 bg-[#faf9f5]/50 px-4 py-3 text-left transition-[background-color] duration-150 hover:bg-[#faf9f5]"
              >
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">공급 서비스 설정</p>
                  <p className="text-[11px] font-bold text-[#2c3455]">내 제공 서비스 목록 관리</p>
                </div>
                <ClipboardList className="h-4 w-4 text-[#8c8275]" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. Inbox Panel (새 요청) ──────────────────────────────────────────── */}
      {activePanel === "inbox" && (
        <section className="animate-fade-in grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">새 견적 요청 목록</p>
              <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[10px]">{inboxItems.length}건 대기</Badge>
            </div>

            <div className="grid gap-3">
              {inboxItems.length ? (
                inboxItems.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-4 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4977a] ${
                      (item.type === "reservation" ? selectedReservationId === item.id : proposalForm.quoteRequestId === item.id)
                        ? "border-[#c4977a] bg-[#faf9f5]"
                        : "border-[#e5e2da]/70 bg-white hover:border-[#ebdccf] hover:bg-[#faf9f5]/30"
                    }`}
                  >
                    <button
                      className="w-full text-left focus-visible:outline-none"
                      onClick={() => {
                        if (item.type === "reservation") {
                          const r = reservations.find(r => r.id === item.id);
                          if (r) loadReservation(r);
                        } else {
                          const qr = (quoteRequests ?? []).find(qr => qr.id === item.id);
                          if (qr) loadQuoteRequest(qr);
                        }
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-[#2c3455]">
                             {item.label}
                           </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.eventPlanTitle} · {getEventTypeLabel(item.eventType ?? "ETC")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {item.eventType === "WEDDING" ? (
                            <Heart className="h-3 w-3 text-rose-400" />
                          ) : (
                            <Shield className="h-3 w-3 text-indigo-500" />
                          )}
                          <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/40 text-[9px] font-bold">신규</Badge>
                        </div>
                      </div>
                    </button>
                    <button
                      className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[#ebdccf]/60 bg-[#fcfaf7] px-3.5 py-2.5 text-left text-xs font-semibold text-[#a87f63] transition-colors hover:bg-[#faf9f5] focus-visible:outline-none"
                      onClick={() => {
                        if (item.type === "reservation") {
                          const r = reservations.find(r => r.id === item.id);
                          if (r) loadReservation(r, "inbox");
                        } else {
                          const qr = (quoteRequests ?? []).find(qr => qr.id === item.id);
                          if (qr) loadQuoteRequest(qr, "inbox");
                        }
                      }}
                      type="button"
                    >
                      <span className="font-normal text-muted-foreground/75">가능 일정과 금액을 입력하세요.</span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MessageSquareQuote className="h-3.5 w-3.5" />
                        견적 제안 작성
                      </span>
                    </button>
                  </article>
                ))
              ) : (
                <EmptyState icon={Inbox} title={inboxEmptyText} description="새 견적 요청이 접수되면 이곳에 표시됩니다." />
              )}
            </div>
          </div>

          {/* Request detail */}
          <div className="rounded-2xl border border-[#e5e2da] bg-[#faf9f5] p-6 shadow-sm">
            <h3 className="mb-5 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">상세 요청 내역</h3>
            <div className="grid gap-3">
              {selectedQuoteRequest ? (
                <>
                  <DetailRow label="행사명" value={selectedQuoteRequest.plan?.title ?? "행사"} />
                  <DetailRow label="행사 유형" value={getEventTypeLabel(selectedQuoteRequest.plan?.eventType ?? "ETC")} />
                  <DetailRow label={isWeddingRangeRequest(selectedQuoteRequest) ? "희망 일정 범위" : "희망 일정"} value={getQuoteRequestDateLabel(selectedQuoteRequest)} />
                  <DetailRow label="행사 지역" value={selectedQuoteRequest.plan?.location ?? "미정"} />
                  {selectedQuoteRequest.plan?.guestCount != null && (
                    <DetailRow label="예상 인원" value={`${selectedQuoteRequest.plan.guestCount}명`} />
                  )}
                  {selectedQuoteRequest.budget != null && (
                    <DetailRow label="희망 예산" value={formatCurrency(selectedQuoteRequest.budget)} />
                  )}
                  <DetailRow label="사용자 요청사항" value={selectedQuoteRequest.requirements} />
                  {selectedQuoteRequest.selectedModuleDetails && selectedQuoteRequest.selectedModuleDetails.length > 0 && (
                    <ModuleRequestScope
                      modules={selectedQuoteRequest.selectedModuleDetails}
                      eventType={selectedQuoteRequest.plan?.eventType}
                      guestCount={selectedQuoteRequest.plan?.guestCount}
                      heading="사용자가 선택한 모듈"
                      summaryTone="muted"
                    />
                  )}
                  {selectedPendingQuoteRequest && (
                    <div className="mt-2 rounded-xl border border-[#ebdccf]/70 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <Badge className="bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/60 text-[10px] shadow-none">
                            신규 견적/제안서 작성
                          </Badge>
                          <p className="text-xs leading-5 text-muted-foreground">
                            새 요청에 대한 최초 제안만 이곳에서 작성합니다.
                          </p>
                        </div>
                      </div>

                      {selectedPendingQuoteRequest.selectedPackageSnapshot && (
                        <div className="mb-4">
                          <PackageEstimateContext
                            packageSnapshot={selectedPendingQuoteRequest.selectedPackageSnapshot}
                            priceSnapshot={selectedPendingQuoteRequest.priceSnapshot}
                            requestMemo={selectedPendingQuoteRequest.requirements}
                          />
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label={
                            selectedPendingQuoteRequest.plan?.eventType === "FUNERAL"
                              ? "빈소 접수일 확인"
                              : isWeddingRangeRequest(selectedPendingQuoteRequest)
                                ? "가능 서비스 날짜 선택"
                                : "행사 예정일 확인"
                          }
                          name="serviceDate"
                        >
                          <Input
                            id="serviceDate"
                            type="date"
                            value={proposalForm.serviceDate}
                            disabled={isFixedWeddingRequest(selectedPendingQuoteRequest)}
                            onChange={(e) => setProposalForm((c) => ({ ...c, serviceDate: e.target.value }))}
                            className="h-10 rounded-xl border-[#e5e2da] bg-white text-xs focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                          />
                        </Field>
                        <Field label="최종 제안 총액" name="proposalAmount">
                          <Input
                            id="proposalAmount"
                            inputMode="numeric"
                            value={proposalForm.proposalAmount}
                            onChange={(e) => setProposalForm((c) => ({ ...c, proposalAmount: e.target.value }))}
                            className="h-10 rounded-xl border-[#e5e2da] bg-white text-xs focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                          />
                        </Field>
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                        {selectedPendingQuoteRequest.plan?.eventType === "FUNERAL"
                          ? "장례 요청은 접수일 기준 3일 의전 일정으로 확인합니다."
                          : isWeddingRangeRequest(selectedPendingQuoteRequest)
                            ? "플래너가 지정한 범위 안에서 실제 가능한 서비스 날짜를 선택해 주세요."
                            : "플래너가 지정한 확정 웨딩 날짜는 업체가 임의로 변경할 수 없습니다."}
                      </p>

                      <div className="mt-4">
                        <Field label="제안 메모" name="notes">
                          <Textarea
                            id="notes"
                            placeholder="포함 범위나 조정 사유를 입력해 주세요."
                            value={proposalForm.notes}
                            onChange={(e) => setProposalForm((c) => ({ ...c, notes: e.target.value }))}
                            className="min-h-[90px] resize-none rounded-xl border-[#e5e2da] bg-white text-xs focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                          />
                        </Field>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          disabled={isPending || busyReservationId === proposalForm.quoteRequestId}
                          onClick={() => updateReservation("quote")}
                          className="h-10 flex-1 rounded-xl bg-[#2c3455] text-xs font-semibold text-white transition-[background-color] hover:bg-[#1e2645] whitespace-nowrap break-keep"
                        >
                          <MessageSquareQuote className="mr-1.5 h-4 w-4" />
                          {busyReservationId === proposalForm.quoteRequestId ? "제안 전송 중..." : "견적 제안 전송"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : selectedReservation ? (
                <>
                  <DetailRow label="행사명" value={selectedReservation.eventPlan.title} />
                  {(() => {
                    const type = selectedReservation.eventPlan?.type;
                    if (!type) return null;
                    const label = getEventTypeLabel(type);
                    if (label === type || !label) return null;
                    return <DetailRow label="행사 유형" value={label} />;
                  })()}
                  <DetailRow
                    label="요청 서비스"
                    value={getServiceLabel(selectedReservation)}
                  />
                  <DetailRow label="희망 일정" value={formatDate(selectedReservation.serviceDate)} />
                  <DetailRow label="희망 예산" value={formatCurrency(selectedReservation.quotedAmount)} />
                  {selectedReservation.guestCount != null && (
                    <DetailRow label="참석 인원" value={`${selectedReservation.guestCount}명`} />
                  )}
                  {getRequestMemo(selectedReservation) && (
                    <DetailRow label="사용자 요청사항" value={getRequestMemo(selectedReservation) ?? ""} />
                  )}
                  {selectedReservation.selectedServiceOptions && selectedReservation.selectedServiceOptions.length > 0 && (
                    <div className="rounded-xl border border-[#ebdccf]/50 bg-white p-4">
                      <p className="mb-3 text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">선택 세부 항목</p>
                      <div className="space-y-2">
                        {selectedReservation.selectedServiceOptions.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between text-xs border-b border-[#f2ece4]/40 pb-2 last:border-0 last:pb-0">
                            <span className="text-[#2c3455] font-medium">{opt.name}</span>
                            <span className="font-bold text-[#2c3455]">
                              {opt.price === 0
                                ? "포함"
                                : opt.pricingType === "PER_GUEST" && opt.quantity != null
                                ? `${opt.price.toLocaleString()}원 × ${opt.quantity}인 = ${(opt.subtotal ?? opt.price * opt.quantity).toLocaleString()}원`
                                : `${opt.price.toLocaleString()}원`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between border-t border-[#f2ece4] pt-2">
                        <span className="text-xs font-semibold text-muted-foreground">견적 합계</span>
                        <span className="text-xs font-bold text-[#c4977a]">{(selectedReservation.quotedAmount ?? 0).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState icon={ArrowUp} title="요청을 선택해 주세요." description="왼쪽 목록에서 요청을 클릭하면 상세 요건을 확인하실 수 있습니다." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Proposals Panel (견적 응답) ──────────────────────────────────────────── */}
      {activePanel === "proposals" && (
        <section className="animate-fade-in grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-[#e5e2da] bg-[#faf9f5] p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-1">
              <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">선택한 제안 상태</p>
              <p className="text-xs leading-5 text-muted-foreground">
                이미 보낸 제안과 조정 요청만 확인합니다. 신규 견적 작성은 `새 요청`에서 진행합니다.
              </p>
            </div>

            <div className="grid gap-5">
              {!selectedQuoteRequest && (
                <EmptyState
                  icon={MessageSquare}
                  title="진행 중인 제안을 선택해 주세요."
                  description="오른쪽 목록에서 조정 요청이나 플래너 수락 대기 중인 제안을 선택하면 상세 상태가 표시됩니다."
                />
              )}

              {selectedQuoteRequest && selectedQuoteRequest.status === "PENDING" && (
                <div className="rounded-xl border border-[#e5e2da] bg-white p-4 text-xs leading-5 text-[#2c3455]">
                  이 요청은 아직 신규 상태입니다. `새 요청` 탭에서 최초 견적을 작성해 주세요.
                </div>
              )}

              {selectedQuoteRequest && selectedQuoteRequest.status === "RESPONDED" && (
                <>
                  {selectedQuoteRequest.selectedPackageSnapshot && (
                    <PackageEstimateContext
                      packageSnapshot={selectedQuoteRequest.selectedPackageSnapshot}
                      priceSnapshot={selectedQuoteRequest.priceSnapshot}
                      requestMemo={selectedQuoteRequest.requirements}
                    />
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label={isWeddingRangeRequest(selectedQuoteRequest) ? "희망 일정 범위" : "행사 예정일"} value={getQuoteRequestDateLabel(selectedQuoteRequest)} />
                    {selectedQuoteRequest.responses[0]?.currentRevision?.proposedServiceDate && (
                      <DetailRow label="제안 서비스일" value={formatDate(selectedQuoteRequest.responses[0].currentRevision.proposedServiceDate)} />
                    )}
                    <DetailRow label="행사 지역" value={selectedQuoteRequest.plan?.location ?? "미정"} />
                    <DetailRow label="예상 인원" value={selectedQuoteRequest.plan?.guestCount != null ? `${selectedQuoteRequest.plan.guestCount}명` : "미정"} />
                    <DetailRow label="희망 예산" value={selectedQuoteRequest.budget != null ? formatCurrency(selectedQuoteRequest.budget) : "미정"} />
                  </div>

                  {selectedQuoteRequest.selectedModuleDetails && selectedQuoteRequest.selectedModuleDetails.length > 0 && (
                    <ModuleRequestScope
                      modules={selectedQuoteRequest.selectedModuleDetails}
                      eventType={selectedQuoteRequest.plan?.eventType}
                      guestCount={selectedQuoteRequest.plan?.guestCount}
                      heading="이번 제안의 요청 범위"
                    />
                  )}

                  {selectedAdjustmentMemo && (
                    <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 text-xs text-amber-900 space-y-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider">플래너 조정 요청</p>
                      {selectedCurrentRevision?.totalPrice != null && (
                        <div className="grid gap-2 rounded-lg bg-white/70 px-3 py-2 text-[#2c3455]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">이전 제안 총액</span>
                            <span className="font-bold text-[#c4977a]">{formatCurrency(selectedCurrentRevision.totalPrice)}</span>
                          </div>
                          {selectedPlannerRequestedTotal != null && (
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">플래너 희망 조정 금액</span>
                              <span className="font-bold text-[#2c3455]">{formatCurrency(selectedPlannerRequestedTotal)}</span>
                            </div>
                          )}
                          {selectedAdjustmentDelta != null && (
                            <div className="flex items-center justify-between gap-3 border-t border-[#f2ece4] pt-2">
                              <span className="text-muted-foreground">차이</span>
                              <span className={`font-bold ${selectedAdjustmentDelta < 0 ? "text-emerald-700" : selectedAdjustmentDelta > 0 ? "text-amber-700" : "text-[#2c3455]"}`}>
                                {selectedAdjustmentDelta > 0 ? "+" : ""}
                                {formatCurrency(selectedAdjustmentDelta)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="leading-relaxed font-normal">{selectedAdjustmentMemo}</p>
                    </div>
                  )}

                  {isSelectedAdjustmentQuoteRequest && selectedPlannerRequestedTotal != null && (
                    <div className="rounded-xl border border-[#ebdccf]/70 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[#2c3455]">요청 금액 수락</p>
                          <p className="font-[var(--font-serif)] text-lg font-bold text-[#c4977a]">
                            {formatCurrency(selectedPlannerRequestedTotal)}
                          </p>
                        </div>
                        <Button
                          disabled={isPending || busyReservationId === proposalForm.quoteRequestId}
                          onClick={acceptPlannerRequestedTotal}
                          className="rounded-xl h-10 text-xs font-semibold whitespace-nowrap break-keep bg-[#2c3455] text-white hover:bg-[#1e2645]"
                        >
                          <BadgeCheck className="mr-1.5 h-4 w-4" />
                          {busyReservationId === proposalForm.quoteRequestId ? "전송 중..." : "요청 금액 수락"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isSelectedAdjustmentQuoteRequest && (
                    <div className="rounded-xl border border-[#e5e2da] bg-white p-4">
                      <p className="mb-3 text-sm font-bold text-[#2c3455]">다른 금액으로 수정 제안</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="수정 제안 총액" name="proposalAmount">
                          <Input
                            id="proposalAmount"
                            inputMode="numeric"
                            value={proposalForm.proposalAmount}
                            onChange={(e) => setProposalForm((c) => ({ ...c, proposalAmount: e.target.value }))}
                            className="h-10 rounded-xl border-[#e5e2da] bg-white text-xs focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                          />
                        </Field>
                        <Field label="수정 제안 메모" name="notes">
                          <Textarea
                            id="notes"
                            placeholder="포함 범위나 조정 사유를 입력해 주세요."
                            value={proposalForm.notes}
                            onChange={(e) => setProposalForm((c) => ({ ...c, notes: e.target.value }))}
                            className="min-h-[76px] resize-none rounded-xl border-[#e5e2da] bg-white text-xs focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                          />
                        </Field>
                      </div>
                      <Button
                        disabled={isPending || busyReservationId === proposalForm.quoteRequestId}
                        onClick={() => updateReservation("quote")}
                        className="mt-3 h-10 w-full rounded-xl bg-[#2c3455] text-xs font-semibold text-white transition-[background-color] hover:bg-[#1e2645] whitespace-nowrap break-keep"
                      >
                        <MessageSquareQuote className="mr-1.5 h-4 w-4" />
                        {busyReservationId === proposalForm.quoteRequestId ? "제안 전송 중..." : "다른 금액으로 수정 제안"}
                      </Button>
                    </div>
                  )}

                  {shouldShowReadOnlyProposalState && selectedCurrentRevision && (
                    <div className="rounded-xl border border-[#ebdccf]/70 bg-[#faf9f5]/70 p-4">
                      <Badge className="bg-white text-[#9b6b4f] border border-[#ebdccf]/70 text-[10px] shadow-none">
                        플래너 수락 대기 중
                      </Badge>
                      <div className="mt-3 grid gap-2 text-xs text-[#2c3455] sm:grid-cols-2">
                        <DetailRow
                          label={selectedCurrentRevision.status === "REVISED" ? "전송한 수정 제안" : "전송한 제안"}
                          value={formatCurrency(selectedCurrentRevision.totalPrice)}
                        />
                        <DetailRow
                          label="상태"
                          value={selectedCurrentRevision.status === "REVISED" ? "수정 제안 전송 완료" : "플래너 수락 대기"}
                        />
                      </div>
                      {selectedCurrentRevision.memo && (
                        <div className="mt-3 rounded-lg border border-[#f2ece4]/80 bg-white px-3 py-2 text-xs text-[#2c3455]">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">제안 메모</p>
                          <p className="leading-5">{selectedCurrentRevision.memo}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedQuoteRequest.responses[0] && (
                    <VendorProposalRevisionHistory quoteRequest={selectedQuoteRequest} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* In-progress list */}
          <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">진행 중인 견적 현황</h3>
            <div className="grid gap-3">
              {proposalActivityCount ? (
                <>
                  {inProgressReservations.map((r) => (
                    <div key={r.id} className="rounded-xl border border-[#e5e2da]/70 bg-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-[#ebdccf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-[#2c3455]">
                            {getServiceLabel(r)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{r.eventPlan.title}</p>
                        </div>
                        <Badge className={r.quoteRequestStatus === "ACCEPTED" ? `${finalConfirmTone.emphasisBadge} text-[9px] font-bold` : "bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[9px] font-bold"}>
                          {r.quoteRequestStatus === "ACCEPTED" ? "사용자 수락 완료" : "제안 발송 완료"}
                        </Badge>
                      </div>

                        <div className="mt-3.5 grid gap-1.5 text-xs text-[#8c8275] border-t border-[#f2ece4]/40 pt-3">
                          <div className="flex items-center gap-2 text-[#2c3455]"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />{formatDate(r.serviceDate)}</div>
                          <div className="flex items-center gap-2 text-[#2c3455]"><Wallet className="h-3.5 w-3.5 text-muted-foreground/60" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                          {r.quoteRequestStatus === "ACCEPTED" && r.vendorConfirmationDueAt && (
                          <div className={`flex items-center gap-2 font-semibold ${finalConfirmTone.emphasisText}`}>
                            <Clock className="h-3.5 w-3.5" />
                            확정 요청 기한: {formatDate(r.vendorConfirmationDueAt)}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-1 flex items-center justify-between">
                        {r.quoteRequestStatus === "ACCEPTED" ? (
                          <Button
                            onClick={scrollToPendingConfirmations}
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs h-8 font-semibold px-3 whitespace-nowrap break-keep border-[#e5e2da] bg-white text-[#2c3455] hover:bg-[#faf9f5]"
                          >
                            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                            최종 확정 화면으로 이동
                          </Button>
                        ) : (
                          <span className="text-[10px] text-[#8c8275]/60">사용자의 수락 및 피드백 대기 중</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {respondedQuoteRequests.map((qr) => {
                    const response = qr.responses[0];
                    const currentRevision = getCurrentQuoteRevision(qr);
                    const adjustmentRequested = hasPendingAdjustment(qr);
                    const revisedWaitingForPlanner = currentRevision?.status === "REVISED";
                    const cardStatusLabel = adjustmentRequested
                      ? "조정 요청 도착"
                      : revisedWaitingForPlanner
                      ? "수정 제안 전송 완료"
                      : "플래너 수락 대기 중";
                    return (
                      <button
                        key={`responded:${qr.id}`}
                        type="button"
                        onClick={() => loadQuoteRequest(qr, "proposals")}
                        className="w-full rounded-xl border border-[#e5e2da]/70 bg-white p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 hover:border-[#ebdccf] hover:bg-[#faf9f5]/40 hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-xs text-[#2c3455]">
                              {response.modules.basePackage.name || qr.plan?.title || "견적 제안"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{qr.plan?.title ?? "행사"}</p>
                          </div>
                          <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[9px] font-bold">
                            {cardStatusLabel}
                          </Badge>
                        </div>

                        <div className="mt-3.5 grid gap-1.5 text-xs text-[#8c8275] border-t border-[#f2ece4]/40 pt-3">
                          <div className="flex items-center gap-2 text-[#2c3455]"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />{getQuoteRequestDateLabel(qr)}</div>
                          <div className="flex items-center gap-2 text-[#2c3455]"><Wallet className="h-3.5 w-3.5 text-muted-foreground/60" />{formatCurrency(currentRevision?.totalPrice ?? response.totalPrice)}</div>
                          {qr.plan?.guestCount != null && (
                            <div className="flex items-center gap-2 text-[#2c3455]"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/60" />{qr.plan.guestCount}명</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <EmptyState icon={MessageSquare} title="진행 중인 견적이 없습니다." description="견적 제안을 회신하시면 이곳에서 모니터링하실 수 있습니다." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Final Confirm Panel (최종 확정 대기 목록) ────────────────────── */}
      {activePanel === "final_confirm" && (
        <section
          ref={pendingConfirmationsRef}
          className={`scroll-mt-6 animate-fade-in rounded-2xl border p-6 space-y-6 ${finalConfirmTone.emphasisCard}`}
        >
          <div className="border-b border-[#f2ece4] pb-4">
            <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">예약 최종 승인 대기 목록</h2>
            <p className="text-xs text-[#8c8275] mt-1">
              고객이 견적 제안을 최종 수락했습니다. 날짜와 사양을 재확인한 후 예약을 최종 승인해 주세요.
            </p>
          </div>

          <div className="divide-y divide-[#f2ece4]">
            {pendingConfirmationReservations.length ? (
              pendingConfirmationReservations.map((r) => {
                const requestMemo = getRequestMemo(r);
                const amount = r.confirmedAmount ?? r.quotedAmount;

                return (
                  <article key={r.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold border rounded ${finalConfirmTone.emphasisBadge}`}>
                            최종 확정 승인 대기
                          </span>
                          <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">{r.eventPlan.title}</p>
                        </div>
                        <p className="text-[11px] text-[#8c8275]">
                          {getServiceLabel(r)} · {getEventTypeLabel(r.eventPlan.type ?? "ETC")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[9px] text-[#8c8275] block">희망 날짜</span>
                          <span className="font-semibold text-[#2c3455]">{formatDate(r.serviceDate)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#8c8275] block">행사 지역</span>
                          <span className="font-semibold text-[#2c3455]">{r.eventPlan.region ?? "미정"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#8c8275] block">예상 인원</span>
                          <span className="font-semibold text-[#2c3455]">{r.guestCount ? `${r.guestCount}명` : "미정"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#8c8275] block">최종 합계</span>
                          <span className="font-bold text-[#c4977a]">{formatCurrency(amount)}</span>
                        </div>
                      </div>

                      <ReservationPackageContext reservation={r} />

                      {requestMemo && (
                        <div className="rounded-xl bg-white border border-[#ebdccf]/40 p-3.5 text-xs text-[#2c3455] space-y-1 max-w-2xl">
                          <span className="text-[9px] font-bold text-[#c4977a] uppercase tracking-wider block">사용자 요청사항</span>
                          <p className="leading-relaxed font-normal">{requestMemo}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end border-t border-[#f2ece4] pt-4">
                      <Button
                        disabled={isPending || busyReservationId === r.id}
                        onClick={() => confirmAcceptedReservation(r.id)}
                        size="sm"
                        className={`text-white rounded-xl h-9 text-xs font-semibold px-4 transition-[background-color] whitespace-nowrap break-keep ${finalConfirmTone.infoButton}`}
                      >
                        <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                        {busyReservationId === r.id ? "승인 중..." : "최종 예약 승인"}
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="py-12">
                <EmptyState icon={Clock} title="최종 확정 대기 중인 일정이 없습니다." description="고객이 보낸 견적 제안을 수락하면 이곳에 대기 목록으로 올라옵니다." />
              </div>
            )}
          </div>
        </section>
      )}

      {activePanel === "reservation_requests" && (
        <section className="animate-fade-in rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">예약 변경/취소 승인 요청</p>
              <p className="mt-1 text-xs text-muted-foreground">
                고객 요청은 승인 전까지 기존 예약에 반영되지 않습니다. 승인 또는 거절로 처리해 주세요.
              </p>
            </div>
            <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[10px]">
              {pendingReservationRequestCount}건 대기
            </Badge>
          </div>

          <div className="grid gap-4">
            {pendingChangeRequests.map((request) => {
              const reservation = request.reservation;
              const requestedOptions = request.requestedSelectedServiceOptions ?? [];

              return (
                <article key={request.id} className="rounded-xl border border-[#e5e2da]/80 bg-[#fcfbf8] p-5">
                  <div className="mb-4 flex flex-col gap-2 border-b border-[#f2ece4] pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">
                        예약 변경 승인 대기
                      </Badge>
                      <p className="mt-2 font-semibold text-sm text-[#2c3455]">{reservation.eventPlan.title}</p>
                      <p className="mt-1 text-[11px] text-[#8c8275]">{getServiceLabel(reservation)}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">요청일 {formatDate(request.createdAt)}</p>
                  </div>

                  <div className="grid gap-3 text-xs text-[#2c3455] sm:grid-cols-2">
                    <div className="rounded-lg border border-[#f2ece4] bg-white p-3">
                      <p className="text-[10px] font-bold text-[#8c8275]">현재 예약</p>
                      <p className="mt-2">날짜: {formatDate(reservation.serviceDate)}</p>
                      <p>인원: {reservation.guestCount ? `${reservation.guestCount}명` : "미정"}</p>
                      <p>메모: {reservation.notes ?? "없음"}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-3">
                      <p className="text-[10px] font-bold text-amber-800">요청 변경</p>
                      <p className="mt-2">날짜: {request.requestedServiceDate ? formatDate(request.requestedServiceDate) : "변경 없음"}</p>
                      <p>인원: {request.requestedGuestCount ? `${request.requestedGuestCount}명` : "변경 없음"}</p>
                      <p>메모: {request.requestedNotes ?? "변경 없음"}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-[#f2ece4] bg-white p-3 text-xs leading-5 text-[#2c3455]">
                    <p className="font-bold text-[#8c8275]">요청 사유</p>
                    <p className="mt-1">{request.requestedReason}</p>
                    {requestedOptions.length > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        선택 서비스 변경 요청: {requestedOptions.map((option) => option.name).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending || busyRequestId === request.id}
                      onClick={() => decideChangeRequest(request.id, "reject")}
                      className="h-9 rounded-xl text-xs font-semibold"
                    >
                      {busyRequestId === request.id ? "처리 중..." : "거절"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isPending || busyRequestId === request.id}
                      onClick={() => decideChangeRequest(request.id, "approve")}
                      className="h-9 rounded-xl bg-[#2c3455] px-4 text-xs font-semibold text-white hover:bg-[#1f2745]"
                    >
                      {busyRequestId === request.id ? "처리 중..." : "변경 승인"}
                    </Button>
                  </div>
                </article>
              );
            })}

            {pendingCancellationRequests.map((request) => {
              const reservation = request.reservation;

              return (
                <article key={request.id} className="rounded-xl border border-rose-200/70 bg-rose-50/20 p-5">
                  <div className="mb-4 flex flex-col gap-2 border-b border-rose-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Badge className="bg-white text-rose-700 border border-rose-200 text-[9px] font-bold">
                        예약 취소 승인 대기
                      </Badge>
                      <p className="mt-2 font-semibold text-sm text-[#2c3455]">{reservation.eventPlan.title}</p>
                      <p className="mt-1 text-[11px] text-[#8c8275]">
                        {getServiceLabel(reservation)} · {formatDate(reservation.serviceDate)}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">요청일 {formatDate(request.createdAt)}</p>
                  </div>

                  <div className="rounded-lg border border-rose-100 bg-white p-3 text-xs leading-5 text-[#2c3455]">
                    <p className="font-bold text-rose-700">취소 사유</p>
                    <p className="mt-1">{request.reason}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      승인 전까지 예약 상태는 {reservation.status === "CONFIRMED" ? "확정" : "대기"}로 유지됩니다.
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending || busyRequestId === request.id}
                      onClick={() => decideCancellationRequest(request.id, "reject")}
                      className="h-9 rounded-xl text-xs font-semibold"
                    >
                      {busyRequestId === request.id ? "처리 중..." : "거절"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isPending || busyRequestId === request.id}
                      onClick={() => decideCancellationRequest(request.id, "approve")}
                      className="h-9 rounded-xl bg-rose-700 px-4 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      {busyRequestId === request.id ? "처리 중..." : "취소 승인"}
                    </Button>
                  </div>
                </article>
              );
            })}

            {pendingReservationRequestCount === 0 && (
              <EmptyState icon={LayoutList} title="처리할 변경/취소 요청이 없습니다." description="고객이 예약 변경 또는 취소 승인을 요청하면 이곳에 표시됩니다." />
            )}
          </div>
        </section>
      )}

      {/* ── 5. Confirmed Panel (확정 예약) ──────────────────────────────────────────── */}
      {activePanel === "confirmed" && (
        <section className="animate-fade-in rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">최종 확정된 예약 일정</p>
            <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[10px]">{confirmedReservations.length}건 확정</Badge>
          </div>

          {confirmedReservations.length > 0 && (
            <div className="mb-6 rounded-xl border border-[#ebdccf]/40 bg-[#fdfbf9] p-4 flex justify-between items-center shadow-[0_1px_4px_rgba(0,0,0,0.005)]">
              <span className="text-xs font-semibold text-muted-foreground">확정 완료 계약 총액</span>
              <span className="font-[var(--font-serif)] text-base font-bold text-[#c4977a]">{formatCurrency(confirmedTotal)}</span>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {confirmedReservations.length ? (
              confirmedReservations.map((r) => (
                <article
                  key={r.id}
                  className="rounded-xl border border-[#e5e2da]/70 bg-white p-5 transition-[border-color] duration-200 hover:border-[#ebdccf]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f2ece4]/40 pb-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className="bg-[#eafaf1] text-[#0f9652] border border-emerald-100 hover:bg-[#eafaf1] text-[9px] font-bold">
                          {getQuoteStatusMeta(r).label}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] border-[#e5e2da]/80 text-[#8c8275] font-bold">{getEventTypeLabel(r.eventPlan.type ?? "ETC")}</Badge>
                      </div>
                      <p className="font-semibold text-xs text-[#2c3455] pt-1">{r.eventPlan.title}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />{formatDate(r.serviceDate)}</div>
                    <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/50" />{r.guestCount ?? 0}명</div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/50" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                    <div className="flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5 text-muted-foreground/50" />{r.status === "COMPLETED" ? "행사 완료" : "예약 확정"}</div>
                  </div>

                  {r.selectedPackageSnapshot && (
                    <div className="mt-4">
                      <ReservationPackageContext reservation={r} compact />
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="col-span-2">
                <EmptyState icon={CalendarCheck} title="확정된 예약 일정이 없습니다." description="최종 예약을 확정하시면 스케줄 목록에 반영됩니다." />
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
}

function PriorityCell({
  eyebrow,
  count,
  hint,
  active,
  accent,
  onClick
}: {
  eyebrow: string;
  count: number;
  hint: string;
  active: boolean;
  accent: "accent" | "primary" | "neutral";
  onClick: () => void;
}) {
  const numeralColor = !active
    ? "text-[#d8d2c7]"
    : accent === "accent"
    ? "text-[#c4977a]"
    : accent === "primary"
    ? "text-[#2c3455]"
    : "text-[#2c3455]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-1 px-6 py-6 text-left transition-[background-color] duration-200 hover:bg-[#faf9f5] focus-visible:outline-none focus-visible:bg-[#faf9f5]"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">{eyebrow}</span>
      <span className={`font-[var(--font-serif)] text-5xl font-normal leading-none tabular-nums ${numeralColor}`}>
        {count}
      </span>
      <span className="mt-1.5 text-[11px] text-[#8c8275]">{hint}</span>
    </button>
  );
}

function Field({
  label,
  name,
  hint,
  children
}: {
  label: string;
  name: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name} className="text-xs font-semibold text-[#2c3455]">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}



function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5e2da]/50 bg-white px-4 py-3 transition-[background-color] duration-150 hover:bg-[#faf9f5]/30">
      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#2c3455]">{value}</p>
    </div>
  );
}

function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon?: ElementType }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-[#ebdccf] bg-[#faf9f5]/30 p-8 text-center">
      {Icon ? (
        <Icon className="mx-auto mb-3 h-5 w-5 text-[#bcae9c]" aria-hidden="true" />
      ) : (
        <span className="mx-auto mb-3 block h-px w-8 bg-[#ebdccf]" />
      )}
      <p className="text-xs font-semibold text-[#2c3455]">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#8c8275]">{description}</p>
    </div>
  );
}
