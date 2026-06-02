"use client";

import { type ElementType, type ReactNode, useMemo, useRef, useState, useTransition } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Heart,
  Inbox,
  MapPin,
  MessageSquareQuote,
  Shield,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Wallet,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmReservation } from "@/app/actions/reservation";
import { declineQuoteRequest, submitQuoteResponse } from "@/app/actions/quote";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getQuoteStatusMeta,
  type MvpQuoteEventType
} from "@/lib/step3.shared";
import { ServiceManager } from "@/app/vendor/dashboard/service-manager";
import type { QuoteRequestForVendorDTO } from "@/types/quote";
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
  supportedEventTypes?: MvpQuoteEventType[];
  supportedServiceModules?: string[];
  vendorServices?: ServiceRow[];
  vendorPackages?: PackageRow[];
  quoteRequests?: QuoteRequestForVendorDTO[];
};

type PanelKey = "home" | "inbox" | "proposals" | "final_confirm" | "confirmed" | "services";

const PANELS: Array<{ key: PanelKey; label: string; description: string; icon: ElementType }> = [
  { key: "home",          label: "업무 홈",       description: "오늘 처리할 일",        icon: TrendingUp },
  { key: "inbox",         label: "새 요청",       description: "신규 수신 요청",        icon: Inbox },
  { key: "proposals",     label: "견적 응답",     description: "제안서 작성 및 관리",   icon: MessageSquareQuote },
  { key: "final_confirm", label: "최종 확정",     description: "고객 수락 완료 및 대기",  icon: Clock },
  { key: "confirmed",     label: "확정 예약",     description: "확정 일정 관리",        icon: BadgeCheck },
  { key: "services",      label: "서비스 관리",   description: "내 공급 서비스 목록",    icon: ClipboardList },
];

const selectClassName =
  "h-11 w-full rounded-xl border border-[#e5e2da] bg-white px-4 text-xs text-[#2c3455] shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4977a]";

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
  const editableProposalReservations = useMemo(
    () => [...inboxReservations, ...inProgressReservations],
    [inboxReservations, inProgressReservations]
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
  const selectedProposalReservation =
    reservations.find((item) => item.id === proposalForm.reservationId) ?? null;
  const isSelectedAcceptedProposal =
    selectedProposalReservation?.quoteRequestStatus === "ACCEPTED";
  const editableProposalIds = useMemo(
    () => new Set(editableProposalReservations.map((reservation) => reservation.id)),
    [editableProposalReservations]
  );
  const editableQuoteRequestIds = useMemo(
    () => new Set(pendingQuoteRequests.map(qr => qr.id)),
    [pendingQuoteRequests]
  );
  const proposalSelectValue = proposalForm.quoteRequestId && editableQuoteRequestIds.has(proposalForm.quoteRequestId)
    ? `qr:${proposalForm.quoteRequestId}`
    : editableProposalIds.has(proposalForm.reservationId)
    ? proposalForm.reservationId
    : "";

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
    setProposalForm({
      reservationId: "",
      quoteRequestId: qr.id,
      serviceDate: qr.preferredDate ? qr.preferredDate.slice(0, 10) : "",
      proposalAmount: qr.priceSnapshot?.estimatedTotal
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

  async function updateReservation(action: "quote" | "decline") {
    const activeQuoteRequestId = proposalForm.quoteRequestId;
    const activeReservationId = proposalForm.reservationId;

    // Canonical path: QuoteRequest without Reservation
    if (activeQuoteRequestId && !activeReservationId) {
      if (action === "decline") {
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
      if (!proposalForm.serviceDate || !proposalForm.proposalAmount) {
        setError("행사 예정일 확인과 최종 제안 총액을 모두 입력해 주세요.");
        return;
      }
      if (busyReservationId === activeQuoteRequestId) return;
      setBusyReservationId(activeQuoteRequestId);
      setMessage(null);
      setError(null);
      try {
        const selectedQr = (quoteRequests ?? []).find(qr => qr.id === activeQuoteRequestId);
        if (!selectedQr) { setError("견적 요청을 찾을 수 없습니다."); return; }
        if (selectedQr.status !== "PENDING") {
          setError("이미 견적 응답을 보낸 요청입니다.");
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
          note: proposalForm.notes || undefined
        });
        if (!result.success) { setError(result.error); return; }
        setMessage("견적 응답을 보냈습니다.");
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

    // Legacy path: Reservation-based
    if (!activeReservationId) { setError("응답할 요청을 먼저 선택해 주세요."); return; }
    if (busyReservationId === activeReservationId) return;
    if (isSelectedAcceptedProposal) {
      setError("사용자가 이미 수락한 견적입니다. 이제 예약 최종 확정만 진행할 수 있습니다.");
      return;
    }
    if (action === "quote" && (!proposalForm.serviceDate || !proposalForm.proposalAmount)) {
      setError("행사 예정일 확인과 최종 제안 총액을 모두 입력해 주세요.");
      return;
    }
    setBusyReservationId(activeReservationId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/vendor/reservations/${activeReservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          serviceDate: proposalForm.serviceDate,
          proposalAmount: proposalForm.proposalAmount,
          notes: proposalForm.notes
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "응답 저장에 실패했습니다."); return; }
      setMessage(action === "quote" ? "견적 응답을 보냈습니다." : "일정 불가로 응답했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  async function completeReservation(reservationId: string) {
    if (busyReservationId === reservationId) return;
    setBusyReservationId(reservationId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/vendor/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "완료 처리에 실패했습니다."); return; }
      setMessage("예약을 완료 처리했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
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

  const confirmedTotal = confirmedReservations.reduce(
    (sum, r) => sum + (r.confirmedAmount ?? r.quotedAmount ?? 0),
    0
  );
  const proposalActivityCount = inProgressReservations.length + respondedQuoteRequests.length;

  const panelCount = {
    home: pendingConfirmationReservations.length + inboxItems.length,
    inbox: inboxItems.length,
    proposals: proposalActivityCount,
    final_confirm: pendingConfirmationReservations.length,
    confirmed: confirmedReservations.length,
    services: 0,
  };

  const selectedQuoteRequest = proposalForm.quoteRequestId
    ? (quoteRequests ?? []).find(qr => qr.id === proposalForm.quoteRequestId) ?? null
    : null;
  const isSelectedRespondedQuoteRequest = selectedQuoteRequest?.status === "RESPONDED";
  const selectedProposalRequestMemo = selectedQuoteRequest
    ? selectedQuoteRequest.requirements
    : getRequestMemo(selectedProposalReservation);

  function scrollToPendingConfirmations() {
    setActivePanel("final_confirm");
    window.setTimeout(() => {
      pendingConfirmationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="grid gap-6">
      {/* ── Priority Banner for Pending Confirmations ──────────────────────────────────── */}
      {pendingConfirmationReservations.length > 0 && (
        <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in ${finalConfirmTone.banner}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${finalConfirmTone.bannerIconWrap}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-xs font-bold ${finalConfirmTone.bannerEyebrow}`}>예약 최종 확정 필요</p>
              <p className={`text-[11px] ${finalConfirmTone.bannerCopy}`}>고객이 견적을 최종 수락했습니다. 실제 승인은 최종 확정 화면에서만 진행됩니다.</p>
            </div>
          </div>
          <button
            onClick={scrollToPendingConfirmations}
            className={`px-4 h-9 text-xs font-bold text-white rounded-xl transition-all shadow-sm whitespace-nowrap break-keep ${finalConfirmTone.bannerButton}`}
          >
            최종 확정 화면으로 이동
          </button>
        </div>
      )}

      {/* ── Compact Partner Header ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-[#e5e2da] bg-[#faf9f5] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#ebdccf] text-[#c4977a]">
            <ThemeIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">{companyName}</h2>
              <Badge className="bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/60 text-[8px] px-1.5 py-0.5 rounded shadow-none font-bold">파트너</Badge>
            </div>
            <p className="text-[10px] text-[#8c8275]">{viewerEmail} · {viewerName}</p>
          </div>
        </div>

        {/* ── Today Work Summary (Compact Metric Cards) ── */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#2c3455]">
          <div className="flex items-center gap-1.5 bg-white border border-[#ebdccf]/40 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-muted-foreground text-[10px]">새 요청</span>
            <span className={inboxItems.length > 0 ? "text-amber-600 font-bold" : "text-[#2c3455]"}>{inboxItems.length}건</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-[#ebdccf]/40 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-muted-foreground text-[10px]">진행 제안</span>
            <span>{proposalActivityCount}건</span>
          </div>
          <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg shadow-sm transition-all ${
            pendingConfirmationReservations.length > 0
              ? finalConfirmTone.metricActive
              : "bg-white border-[#ebdccf]/40 text-[#2c3455]"
          }`}>
            <span className="text-[10px]">최종 확정 필요</span>
            <span>{pendingConfirmationReservations.length}건</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-[#ebdccf]/40 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-muted-foreground text-[10px]">확정 예약</span>
            <span>{confirmedReservations.length}건</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-[#ebdccf]/40 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-muted-foreground text-[10px]">확정 총액</span>
            <span className="text-[#c4977a] font-bold font-mono">{formatCurrency(confirmedTotal)}</span>
          </div>
        </div>
      </section>

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
      <section className="flex border-b border-[#ebdccf]/60 bg-transparent px-1 py-0.5 mb-6">
        {PANELS.map((panel) => {
          const count = panelCount[panel.key];
          const isActive = activePanel === panel.key;
          return (
            <button
              key={panel.key}
              onClick={() => setActivePanel(panel.key)}
              className={`relative py-3 px-4 text-xs font-semibold transition-all duration-200 border-b-2 -mb-[2px] ${
                isActive
                  ? "border-[#c4977a] text-[#c4977a]"
                  : "border-transparent text-muted-foreground hover:text-[#2c3455]"
              }`}
            >
              {panel.label}
              {count > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  isActive ? "bg-[#c4977a] text-white" : "bg-[#f2ece4] text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </section>

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
                    <div key={item.id} className="rounded-xl border border-[#e5e2da]/70 bg-white p-4 transition-all duration-150 hover:border-[#ebdccf]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-xs text-[#2c3455]">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground/80 mt-0.5">{item.eventPlanTitle}</p>
                        </div>
                        <Button
                          onClick={() => {
                            if (item.type === "reservation") {
                              const r = reservations.find(r => r.id === item.id);
                              if (r) loadReservation(r, "proposals");
                            } else {
                              const qr = (quoteRequests ?? []).find(qr => qr.id === item.id);
                              if (qr) loadQuoteRequest(qr, "proposals");
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
            <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455] border-b border-[#f2ece4] pb-3 mb-4">내 비즈니스 업무 요약</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#e5e2da]/60 bg-[#faf9f5]/50 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground">진행 제안</p>
                    <p className="text-base font-extrabold font-mono text-[#2c3455] mt-1">{proposalActivityCount}건</p>
                    <button onClick={() => setActivePanel("proposals")} className="mt-2 text-[9px] font-bold text-[#c4977a] hover:underline block mx-auto">제안 보기 →</button>
                  </div>
                  <div className="rounded-xl border border-[#e5e2da]/60 bg-[#faf9f5]/50 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground">확정 예약</p>
                    <p className="text-base font-extrabold font-mono text-[#2c3455] mt-1">{confirmedReservations.length}건</p>
                    <button onClick={() => setActivePanel("confirmed")} className="mt-2 text-[9px] font-bold text-[#c4977a] hover:underline block mx-auto">스케줄 보기 →</button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#faf9f5]/50 border border-[#ebdccf]/40 p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">공급 서비스 설정</p>
                  <p className="text-[11px] font-bold text-[#2c3455]">내 제공 서비스 목록</p>
                </div>
                <Button 
                  onClick={() => setActivePanel("services")}
                  variant="outline" 
                  className="rounded-xl text-[10px] h-8 border-[#e5e2da] text-[#2c3455] bg-white hover:bg-[#faf9f5]"
                >
                  목록 관리
                </Button>
              </div>
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
                    className={`rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4977a] ${
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
                          if (r) loadReservation(r, "proposals");
                        } else {
                          const qr = (quoteRequests ?? []).find(qr => qr.id === item.id);
                          if (qr) loadQuoteRequest(qr, "proposals");
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
                <EmptyState emoji="📭" title={inboxEmptyText} description="새 견적 요청이 접수되면 이곳에 표시됩니다." />
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
                  <DetailRow label="희망 일정" value={formatDate(selectedQuoteRequest.preferredDate ?? selectedQuoteRequest.plan?.eventDate)} />
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
                <EmptyState emoji="👆" title="요청을 선택해 주세요." description="왼쪽 목록에서 요청을 클릭하면 상세 요건을 확인하실 수 있습니다." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Proposals Panel (견적 응답) ──────────────────────────────────────────── */}
      {activePanel === "proposals" && (
        <section className="animate-fade-in grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          {/* Response form */}
          <div className="rounded-2xl border border-[#e5e2da] bg-[#faf9f5] p-6 shadow-sm">
            <div className="mb-5 flex items-center">
              <Badge className="bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/60 text-[10px]">
                {selectedQuoteRequest ? "신규 견적/제안서 작성" : selectedProposalReservation?.quoteResponseId ? "기존 제안 수정 및 재조율" : "신규 견적/제안서 작성"}
              </Badge>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="reservationId" className="text-xs font-bold text-[#2c3455]">응답 대상 요청 선택</Label>
                <select
                  className={selectClassName}
                  id="reservationId"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val.startsWith("qr:")) {
                      const qrId = val.slice(3);
                      const qr = (quoteRequests ?? []).find(q => q.id === qrId);
                      if (qr) loadQuoteRequest(qr);
                    } else {
                      const r = reservations.find((item) => item.id === val) ?? null;
                      if (r) loadReservation(r);
                    }
                  }}
                  value={proposalSelectValue}
                >
                  <option value="">요청 선택</option>
                  {editableProposalReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getServiceLabel(r)} / {r.eventPlan.title}
                    </option>
                  ))}
                  {pendingQuoteRequests.map((qr) => (
                    <option key={`qr:${qr.id}`} value={`qr:${qr.id}`}>
                      {qr.plan?.title ?? "견적 요청"} (견적요청)
                    </option>
                  ))}
                </select>
              </div>

              {isSelectedAcceptedProposal && selectedProposalReservation && (
                <div className={`rounded-xl border p-4 text-xs space-y-2 ${finalConfirmTone.infoCard}`}>
                  <p className="font-bold">사용자가 이 견적을 최종 수락했습니다.</p>
                  <p className="text-muted-foreground leading-relaxed">
                    견적 금액이나 상세 정보의 수정은 불가능하며, 이제 예약 최종 확정을 진행할 수 있습니다.
                  </p>
                  {selectedProposalReservation.vendorConfirmationDueAt && (
                    <p className={`font-semibold ${finalConfirmTone.infoTitle}`}>
                      예약 확정 기한: {formatDate(selectedProposalReservation.vendorConfirmationDueAt)} 까지
                    </p>
                  )}
                  <Button
                    className="mt-2 rounded-xl text-xs h-9 font-semibold whitespace-nowrap break-keep border-[#e5e2da] bg-white text-[#2c3455] hover:bg-[#faf9f5]"
                    onClick={scrollToPendingConfirmations}
                    variant="outline"
                    size="sm"
                  >
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                    최종 확정 화면으로 이동
                  </Button>
                </div>
              )}

              {selectedProposalRequestMemo && (
                <div className="rounded-xl border border-[#ebdccf]/40 bg-white p-4 text-xs text-[#2c3455] space-y-1">
                  <p className="text-[9px] font-bold text-[#c4977a] uppercase tracking-wider">사용자 특별 요청 사항</p>
                  <p className="leading-relaxed font-normal">{selectedProposalRequestMemo}</p>
                </div>
              )}

              {selectedQuoteRequest?.selectedPackageSnapshot && (
                <PackageEstimateContext
                  packageSnapshot={selectedQuoteRequest.selectedPackageSnapshot}
                  priceSnapshot={selectedQuoteRequest.priceSnapshot}
                  requestMemo={selectedQuoteRequest.requirements}
                />
              )}

              {selectedQuoteRequest && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="행사 예정일" value={formatDate(selectedQuoteRequest.preferredDate ?? selectedQuoteRequest.plan?.eventDate)} />
                  <DetailRow label="행사 지역" value={selectedQuoteRequest.plan?.location ?? "미정"} />
                  <DetailRow label="예상 인원" value={selectedQuoteRequest.plan?.guestCount != null ? `${selectedQuoteRequest.plan.guestCount}명` : "미정"} />
                  <DetailRow label="희망 예산" value={selectedQuoteRequest.budget != null ? formatCurrency(selectedQuoteRequest.budget) : "미정"} />
                </div>
              )}

              {selectedQuoteRequest?.selectedModuleDetails && selectedQuoteRequest.selectedModuleDetails.length > 0 && (
                <ModuleRequestScope
                  modules={selectedQuoteRequest.selectedModuleDetails}
                  eventType={selectedQuoteRequest.plan?.eventType}
                  guestCount={selectedQuoteRequest.plan?.guestCount}
                  heading="이번 제안의 요청 범위"
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="행사 예정일 확인"
                  name="serviceDate"
                  hint="플래너가 선택한 날짜가 기본값입니다. 가능하면 그대로 두시고, 불가할 때만 대체 가능한 날짜를 제안해 주세요."
                >
                  <Input
                    id="serviceDate"
                    type="date"
                    disabled={isSelectedAcceptedProposal || isSelectedRespondedQuoteRequest}
                    value={proposalForm.serviceDate}
                    onChange={(e) => setProposalForm((c) => ({ ...c, serviceDate: e.target.value }))}
                    className="rounded-xl border-[#e5e2da] bg-white text-xs h-10 focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                  />
                </Field>
                <Field
                  label="선택 모듈 기준 최종 제안 총액"
                  name="proposalAmount"
                  hint="개별 모듈 단가를 다시 나누지 않고, 이번 요청 범위 전체에 대한 최종 총액으로 입력합니다."
                >
                  <Input
                    id="proposalAmount"
                    inputMode="numeric"
                    disabled={isSelectedAcceptedProposal || isSelectedRespondedQuoteRequest}
                    value={proposalForm.proposalAmount}
                    onChange={(e) => setProposalForm((c) => ({ ...c, proposalAmount: e.target.value }))}
                    className="rounded-xl border-[#e5e2da] bg-white text-xs h-10 focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                  />
                </Field>
              </div>

              <Field
                label="조정 사유 및 안내 메시지"
                name="notes"
                hint="포함 범위, 일정 확인 결과, 조정 이유, 고객에게 전달할 안내를 함께 적어 주세요."
              >
                <Textarea
                  id="notes"
                  placeholder="선택 모듈 기준 안내, 일정 확인 결과, 조정 사유를 입력해 주세요."
                  disabled={isSelectedAcceptedProposal || isSelectedRespondedQuoteRequest}
                  value={proposalForm.notes}
                  onChange={(e) => setProposalForm((c) => ({ ...c, notes: e.target.value }))}
                  className="rounded-xl border-[#e5e2da] bg-white text-xs min-h-[90px] resize-none focus-visible:ring-1 focus-visible:ring-[#c4977a]"
                />
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row mt-2">
                <Button
                  disabled={isPending || isSelectedAcceptedProposal || isSelectedRespondedQuoteRequest || busyReservationId === (proposalForm.quoteRequestId || proposalForm.reservationId)}
                  onClick={() => updateReservation("quote")}
                  className="flex-1 bg-[#2c3455] text-white hover:bg-[#1e2645] transition-all rounded-xl h-10 text-xs font-semibold whitespace-nowrap break-keep min-w-[10rem]"
                >
                  <MessageSquareQuote className="mr-1.5 h-4 w-4" />
                  {busyReservationId === (proposalForm.quoteRequestId || proposalForm.reservationId)
                    ? "제안 전송 중..."
                    : isSelectedRespondedQuoteRequest
                    ? "이미 제안 발송 완료"
                    : selectedProposalReservation?.quoteResponseId
                    ? "견적 제안 수정"
                    : "견적 제안 전송"}
                </Button>
                <Button
                  disabled={isPending || isSelectedAcceptedProposal || isSelectedRespondedQuoteRequest || busyReservationId === (proposalForm.quoteRequestId || proposalForm.reservationId)}
                  onClick={() => updateReservation("decline")}
                  variant="destructive"
                  className="rounded-xl h-10 text-xs font-semibold whitespace-nowrap break-keep min-w-[9rem]"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  일정 불가 회신
                </Button>
              </div>
            </div>
          </div>

          {/* In-progress list */}
          <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
            <h3 className="mb-5 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">진행 중인 견적 현황</h3>
            <div className="grid gap-3">
              {proposalActivityCount ? (
                <>
                  {inProgressReservations.map((r) => (
                    <div key={r.id} className="rounded-xl border border-[#e5e2da]/70 bg-white p-4 transition-all duration-200 hover:border-[#ebdccf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)]">
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
                    return (
                      <div key={`responded:${qr.id}`} className="rounded-xl border border-[#e5e2da]/70 bg-white p-4 transition-all duration-200 hover:border-[#ebdccf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-xs text-[#2c3455]">
                              {response.modules.basePackage.name || qr.plan?.title || "견적 제안"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{qr.plan?.title ?? "행사"}</p>
                          </div>
                          <Badge className="bg-[#faf6f2] text-[#c4977a] border border-[#ebdccf]/50 text-[9px] font-bold">
                            제안 발송 완료
                          </Badge>
                        </div>

                        <div className="mt-3.5 grid gap-1.5 text-xs text-[#8c8275] border-t border-[#f2ece4]/40 pt-3">
                          <div className="flex items-center gap-2 text-[#2c3455]"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />{formatDate(qr.preferredDate ?? qr.plan?.eventDate)}</div>
                          <div className="flex items-center gap-2 text-[#2c3455]"><Wallet className="h-3.5 w-3.5 text-muted-foreground/60" />{formatCurrency(response.totalPrice)}</div>
                          {qr.plan?.guestCount != null && (
                            <div className="flex items-center gap-2 text-[#2c3455]"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/60" />{qr.plan.guestCount}명</div>
                          )}
                        </div>

                        {response.note && (
                          <p className="mt-3 rounded-lg border border-[#f2ece4]/70 bg-[#faf9f5]/50 px-3 py-2 text-[11px] leading-relaxed text-[#2c3455]">
                            {response.note}
                          </p>
                        )}

                        <div className="mt-4 pt-1">
                          <span className="text-[10px] text-[#8c8275]/60">사용자의 수락 및 피드백 대기 중</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <EmptyState emoji="💌" title="진행 중인 견적이 없습니다." description="견적 제안을 회신하시면 이곳에서 모니터링하실 수 있습니다." />
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
                  <article key={r.id} className="py-5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1">
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

                      {requestMemo && (
                        <div className="rounded-xl bg-white border border-[#ebdccf]/40 p-3.5 text-xs text-[#2c3455] space-y-1 max-w-2xl">
                          <span className="text-[9px] font-bold text-[#c4977a] uppercase tracking-wider block">사용자 요청사항</span>
                          <p className="leading-relaxed font-normal">{requestMemo}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0">
                      <Button
                        disabled={isPending || busyReservationId === r.id}
                        onClick={() => confirmAcceptedReservation(r.id)}
                        size="sm"
                        className={`text-white rounded-xl h-9 text-xs font-semibold px-4 transition-all whitespace-nowrap break-keep ${finalConfirmTone.infoButton}`}
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
                <EmptyState emoji="✨" title="최종 확정 대기 중인 일정이 없습니다." description="고객이 보낸 견적 제안을 수락하면 이곳에 대기 목록으로 올라옵니다." />
              </div>
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
                  className="rounded-xl border border-[#e5e2da]/70 bg-white p-5 transition-all duration-200 hover:border-[#ebdccf]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f2ece4]/40 pb-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className="bg-[#eafaf1] text-[#0f9652] border border-emerald-100 hover:bg-[#eafaf1] text-[9px] font-bold">
                          {getQuoteStatusMeta(r).label}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] border-[#e5e2da]/80 text-[#8c8275] font-bold">{getEventTypeLabel(r.eventPlan.type ?? "ETC")}</Badge>
                      </div>
                      <p className="font-semibold text-xs text-[#2c3455] pt-1">
                        {getServiceLabel(r)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{r.eventPlan.title}</p>
                    </div>
                    <Button
                      disabled={isPending || busyReservationId === r.id || r.status === "COMPLETED"}
                      onClick={() => completeReservation(r.id)}
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-8 border-[#e5e2da] text-muted-foreground hover:bg-[#faf9f5]"
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      {busyReservationId === r.id ? "처리 중..." : "행사 완료"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />{formatDate(r.serviceDate)}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground/50" />{r.eventPlan.region ?? "지역 미정"}</div>
                    <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/50" />{r.guestCount ?? 0}명</div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/50" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                  </div>
                </article>
              ))
            ) : (
              <div className="col-span-2">
                <EmptyState emoji="✨" title="확정된 예약 일정이 없습니다." description="최종 예약을 확정하시면 스케줄 목록에 반영됩니다." />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 6. Services Panel (서비스 관리) ──────────────────────────────────────────── */}
      {activePanel === "services" && (
        <section className="animate-fade-in space-y-4">
          <div className="rounded-2xl border border-[#e5e2da] bg-white p-6 shadow-sm">
            <ServiceManager
              supportedEventTypes={supportedEventTypes ?? []}
              supportedModules={supportedServiceModules ?? []}
              existingServices={vendorServices ?? []}
              existingPackages={vendorPackages ?? []}
            />
          </div>
        </section>
      )}
    </div>
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
    <div className="rounded-xl border border-[#e5e2da]/50 bg-white px-4 py-3 transition-all duration-150 hover:bg-[#faf9f5]/30">
      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#2c3455]">{value}</p>
    </div>
  );
}

function EmptyState({ title, description, emoji }: { title: string; description: string; emoji?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#ebdccf] bg-[#faf9f5]/30 p-8 text-center max-w-md mx-auto">
      {emoji && <p className="mb-3 text-2xl">{emoji}</p>}
      <p className="text-xs font-semibold text-[#2c3455]">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#8c8275]">{description}</p>
    </div>
  );
}
