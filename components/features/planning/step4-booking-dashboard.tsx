"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  Clock,
  FileText,
  MessageSquareQuote,
  PackageCheck,
  ShieldCheck,
  Wallet
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  QuoteRequestWithResponses,
  QuoteResponseData,
  Step4CategoryStatusDTO
} from "@/types/quote";
import type {
  VendorPackagePriceSnapshot,
  VendorPackageSnapshot,
  VendorPackageSnapshotItem
} from "@/types/vendor-package";
import type { VendorServiceModuleData } from "@/types/vendor-module";

interface Step4BookingDashboardProps {
  eventType: "WEDDING" | "FUNERAL";
  quoteRequestsData: QuoteRequestWithResponses[] | null;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  planReservations: any[];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  confirmedRes: any[];
  totalCost: number;
  isQuoteActionPending: boolean;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  handleAcceptQuote: (responseId: string, quoteProposalRevisionId?: string) => Promise<any> | void;
  handleRequestQuoteAdjustment: (
    responseId: string,
    plannerRequestedTotalPrice: number,
    memo: string
  ) => Promise<QuoteActionResult> | QuoteActionResult | void;
  requestForm: { guestCount: string };
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  theme: any;
  step4DashboardData?: Step4CategoryStatusDTO[] | null;
}

type QuoteActionResult = {
  success: boolean;
  error?: string;
};

type Step4PanelKey = "summary" | "history" | "reservation";

const STEP4_PANELS: Array<{ key: Step4PanelKey; label: string }> = [
  { key: "summary", label: "제안 요약" },
  { key: "history", label: "조율 내역" },
  { key: "reservation", label: "예약 진행" }
];

const MODULE_CATEGORY_LABELS: Record<string, string> = {
  VENUE: "예식장·공간",
  PHOTO: "사진·영상",
  DRESS: "드레스",
  MAKEUP: "메이크업",
  DECORATION: "꽃장식·연출",
  CATERING: "식음료",
  INVITATION: "초대장",
  FUNERAL_HALL: "장례식장·빈소",
  WREATH: "제단꽃·화환",
  TRANSPORT: "운구",
  CEREMONY: "의전",
  MEAL: "문상객 식사",
  OBITUARY: "부고 안내"
};

function categoryLabel(category: string | null | undefined) {
  if (!category) return "선택 항목";
  return MODULE_CATEGORY_LABELS[category] ?? category;
}

function isVendorSpecificModule(
  module: VendorServiceModuleData | { id: string; name: string; category: string; price: number }
): module is VendorServiceModuleData {
  return "catalogKey" in module && module.catalogKey === null;
}

function getLatestResponse(request: QuoteRequestWithResponses) {
  return request.responses[0] ?? null;
}

function getCurrentProposal(response: QuoteResponseData) {
  return response.currentRevision ?? {
    id: "",
    quoteResponseId: response.id,
    requestId: response.requestId,
    vendorId: response.vendorId,
    version: 1,
    totalPrice: response.totalPrice,
    memo: response.note,
    adjustmentRequestMemo: null,
    plannerRequestedTotalPrice: null,
    proposedServiceDate: null,
    status: "SUBMITTED" as const,
    createdAt: response.createdAt
  };
}

function formatRequestedDate(request: QuoteRequestWithResponses) {
  if (request.preferredDateStart && request.preferredDateEnd) {
    return `${formatDate(request.preferredDateStart)} - ${formatDate(request.preferredDateEnd)}`;
  }

  return formatDate(request.preferredDate ?? request.plan?.eventDate);
}

function formatProposalDate(response: QuoteResponseData | null) {
  const proposedDate = response?.currentRevision?.proposedServiceDate ?? null;
  return proposedDate ? formatDate(proposedDate) : null;
}

function getProposalStatusLabel(
  revision: QuoteResponseData["revisions"][number]
) {
  if (revision.status === "ACCEPTED") return "수락한 제안";
  if (revision.status === "ADJUSTMENT_REQUESTED") return "플래너 조정 요청";
  if (revision.status === "REVISED") return "업체 수정 제안";
  return revision.version === 1 ? "업체 최초 제안" : "업체 제안";
}

function getLinkedReservation(
  request: QuoteRequestWithResponses,
  planReservations: Step4BookingDashboardProps["planReservations"]
) {
  return (
    request.reservation ??
    planReservations.find((reservation) => reservation.quoteRequestId === request.id) ??
    null
  );
}

function getStatusTone(request: QuoteRequestWithResponses, reservation: ReturnType<typeof getLinkedReservation>) {
  if (reservation?.status === "CONFIRMED" || reservation?.status === "COMPLETED") {
    return { label: "예약 확정 완료", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" };
  }
  if (request.status === "ACCEPTED") {
    return { label: "업체 최종 확정 대기", tone: "bg-[#faf8f4] text-[#8c8275] border border-[#e5e2da]" };
  }
  if (request.status === "RESPONDED") {
    const currentRevision = request.responses[0]?.currentRevision;
    if (currentRevision?.status === "ADJUSTMENT_REQUESTED") {
      return { label: "조정 요청 보냄", tone: "bg-[#faf8f4] text-[#8c8275] border border-[#e5e2da]" };
    }
    if (currentRevision?.status === "REVISED") {
      return { label: "수정 제안 도착", tone: "bg-amber-50 text-amber-700 border border-amber-200/60" };
    }
    return { label: "제안서 도착", tone: "bg-amber-50 text-amber-700 border border-amber-200/60" };
  }
  return { label: "업체 응답 대기", tone: "bg-slate-100 text-slate-600 border border-slate-200/60" };
}

function ModulePills({
  modules,
  emptyText,
  hidePrices = false
}: {
  modules: Array<VendorServiceModuleData | { id: string; name: string; category: string; price: number }>;
  emptyText: string;
  hidePrices?: boolean;
}) {
  if (modules.length === 0) {
    return <p className="text-xs leading-5 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {modules.map((module) => (
        <span
          key={`${module.id}:${module.name}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ebdccf]/70 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#2c3455]"
        >
          {module.name}
          <span className="text-[#8c8275]">{categoryLabel(module.category)}</span>
          {isVendorSpecificModule(module) && (
            <span className="text-[#9b6b4f]">업체 전용</span>
          )}
          {!hidePrices && module.price > 0 && (
            <span className="font-mono text-[#c4977a]">{formatCurrency(module.price)}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function SectionBlock({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#f2ece4]/80 bg-[#faf9f5]/45 p-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c8275]">{title}</p>
      {children}
    </div>
  );
}

function ProposalSummary({
  response,
  totalPrice,
  memo,
  label,
  isAccepted
}: {
  response: QuoteResponseData;
  totalPrice?: number;
  memo?: string | null;
  label?: string;
  isAccepted?: boolean;
}) {
  const proposalModules = [
    ...(response.modules.includedModules ?? []),
    ...(response.modules.optionalModules ?? [])
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-amber-50/25 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Badge className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] shadow-none">
            {label ?? (isAccepted ? "수락한 제안서" : "업체 제안서")}
          </Badge>
          <p className="text-sm font-bold text-[#2c3455]">{response.modules.basePackage.name}</p>
          {(memo ?? response.note) && (
            <div className="max-w-xl rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-[#2c3455]">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">업체 제안 메모</p>
              <p>{memo ?? response.note}</p>
            </div>
          )}
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[9px] text-muted-foreground">총 제안 금액</span>
          <span className="font-[var(--font-serif)] text-xl font-bold text-[#c4977a]">
            {formatCurrency(totalPrice ?? response.totalPrice)}
          </span>
        </div>
      </div>

      <SectionBlock title="제안에 반영된 요청 항목">
        <ModulePills
          modules={proposalModules}
          emptyText="업체가 총액 중심으로 제안했습니다. 요청 항목은 아래 원 요청 범위를 기준으로 확인해 주세요."
          hidePrices
        />
      </SectionBlock>
    </div>
  );
}

function formatSnapshotItemPrice(item: VendorPackageSnapshotItem) {
  if (item.price === 0) return "포함";
  if (item.pricingType === "PER_GUEST") {
    return `${formatCurrency(item.price)} × ${item.quantity}명 = ${formatCurrency(item.subtotal)}`;
  }
  if (item.quantity > 1) {
    return `${formatCurrency(item.price)} × ${item.quantity} = ${formatCurrency(item.subtotal)}`;
  }
  return formatCurrency(item.subtotal);
}

function lineItemsBySource(
  priceSnapshot: VendorPackagePriceSnapshot | null | undefined,
  source: VendorPackageSnapshotItem["source"]
) {
  return (priceSnapshot?.lineItems ?? []).filter((item) => item.source === source);
}

function SnapshotItemList({
  items,
  emptyText
}: {
  items: VendorPackageSnapshotItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs leading-5 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.source}:${item.id}:${item.packageItemId ?? "direct"}`}
          className="flex flex-col gap-1 rounded-xl border border-[#f2ece4] bg-white px-3.5 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#2c3455]">{item.name}</span>
              <span className="rounded-full border border-[#ebdccf]/70 bg-[#faf9f5] px-2 py-0.5 text-[10px] font-semibold text-[#8c8275]">
                {categoryLabel(item.category)}
              </span>
              {item.source === "VENDOR_ADDON" && (
                <span className="rounded-full border border-[#ebdccf]/60 bg-white px-2 py-0.5 text-[9px] font-semibold text-[#8c8275]">
                  업체 전용
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-[11px] leading-5 text-muted-foreground">{item.description}</p>
            )}
          </div>
          <span className="text-[10px] font-bold text-[#c4977a]">{formatSnapshotItemPrice(item)}</span>
        </div>
      ))}
    </div>
  );
}

function PackageRequestSummary({
  packageSnapshot,
  priceSnapshot
}: {
  packageSnapshot: VendorPackageSnapshot;
  priceSnapshot?: VendorPackagePriceSnapshot | null;
}) {
  const selectedOptionalItems = lineItemsBySource(priceSnapshot, "PACKAGE_OPTIONAL");
  const vendorAddOnItems = lineItemsBySource(priceSnapshot, "VENDOR_ADDON");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#ebdccf]/70 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#2c3455]">{packageSnapshot.name}</p>
            {packageSnapshot.description && (
              <p className="text-xs leading-5 text-muted-foreground">{packageSnapshot.description}</p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <span className="block text-[9px] text-muted-foreground">패키지 기본가</span>
            <span className="font-bold text-[#c4977a]">{formatCurrency(packageSnapshot.basePrice)}</span>
          </div>
        </div>
      </div>

      <SectionBlock title="패키지 포함 모듈">
        <SnapshotItemList
          items={packageSnapshot.includedItems}
          emptyText="패키지 포함 모듈 정보가 없습니다."
        />
      </SectionBlock>

      <SectionBlock title="선택한 패키지 옵션">
        <SnapshotItemList
          items={selectedOptionalItems}
          emptyText="선택한 패키지 옵션이 없습니다."
        />
      </SectionBlock>

      <SectionBlock title="선택한 업체 전용 추가 항목">
        <SnapshotItemList
          items={vendorAddOnItems}
          emptyText="선택한 업체 전용 추가 항목이 없습니다."
        />
      </SectionBlock>

      {priceSnapshot && (
        <SectionBlock title="요청 기준 예상 금액">
          <div className="space-y-2 text-xs text-[#2c3455]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">패키지 기본가</span>
              <span className="font-semibold">{formatCurrency(priceSnapshot.packageBasePrice)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">선택 추가 항목 합계</span>
              <span className="font-semibold">{formatCurrency(priceSnapshot.selectedAddOnsSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">요청 인원</span>
              <span className="font-semibold">{priceSnapshot.guestCount}명</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#f2ece4] pt-2">
              <span className="font-bold text-[#2c3455]">요청 예상 총액</span>
              <span className="font-bold text-[#c4977a]">{formatCurrency(priceSnapshot.estimatedTotal)}</span>
            </div>
            {priceSnapshot.lineItems.length > 0 && (
              <div className="mt-3 rounded-lg border border-[#f2ece4] bg-white px-3 py-2">
                <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[#8c8275]">Line items</p>
                <div className="space-y-1.5">
                  {priceSnapshot.lineItems.map((item) => (
                    <div
                      key={`line:${item.source}:${item.id}:${item.packageItemId ?? "direct"}`}
                      className="flex items-center justify-between gap-3 text-[10px]"
                    >
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-semibold text-[#2c3455]">{formatSnapshotItemPrice(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionBlock>
      )}
    </div>
  );
}

function ProposalPriceComparison({
  request,
  response,
  totalPrice
}: {
  request: QuoteRequestWithResponses;
  response: QuoteResponseData;
  totalPrice?: number;
}) {
  const estimatedTotal = request.priceSnapshot?.estimatedTotal;
  if (estimatedTotal == null) return null;

  const proposalTotal = totalPrice ?? response.totalPrice;
  const delta = proposalTotal - estimatedTotal;
  const deltaLabel =
    delta === 0
      ? "예상 금액과 동일"
      : delta > 0
      ? `예상보다 ${formatCurrency(delta)} 증가`
      : `예상보다 ${formatCurrency(Math.abs(delta))} 감소`;

  return (
    <SectionBlock title="요청 예상 금액과 최종 제안 비교">
      <div className="space-y-2 text-xs text-[#2c3455]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">요청 예상 총액</span>
          <span className="font-semibold">{formatCurrency(estimatedTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">업체 최종 제안 총액</span>
          <span className="font-bold text-[#c4977a]">{formatCurrency(proposalTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
          <span className="text-muted-foreground">차액</span>
          <span className={`font-bold ${delta > 0 ? "text-amber-700" : delta < 0 ? "text-emerald-700" : "text-[#2c3455]"}`}>
            {deltaLabel}
          </span>
        </div>
      </div>
    </SectionBlock>
  );
}

function ProposalRevisionHistory({ response }: { response: QuoteResponseData }) {
  const revisions = response.revisions.length > 0
    ? [...response.revisions].sort((a, b) => a.version - b.version)
    : [getCurrentProposal(response)];
  const currentId = response.currentRevision?.id ?? revisions[revisions.length - 1]?.id;
  const itemCount = revisions.reduce((count, revision) => {
    return count + 1 + (revision.adjustmentRequestMemo ? 1 : 0);
  }, 0);

  return (
    <div className="rounded-xl border border-[#f2ece4] bg-white/70">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-[#2c3455]">
        <span>제안 조율 내역</span>
        <span className="text-[10px] font-semibold text-[#8c8275]">{itemCount}개 기록</span>
      </div>
      <div className="space-y-2 border-t border-[#f2ece4] px-3 py-3">
        {revisions.map((revision) => {
          const isCurrent = revision.id === currentId;
          const isPlannerAdjustment = revision.status === "ADJUSTMENT_REQUESTED";
          const isAccepted = revision.status === "ACCEPTED";

          return (
            <div key={revision.id || `${revision.quoteResponseId}:fallback`} className="space-y-2">
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
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold">{getProposalStatusLabel(revision)}</span>
                  <span className="font-bold text-[#c4977a]">{formatCurrency(revision.totalPrice)}</span>
                </div>
                {revision.memo && (
                  <p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">{revision.memo}</p>
                )}
              </div>
              {revision.adjustmentRequestMemo && (
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/35 px-3 py-2 text-xs text-amber-900">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
    </div>
  );
}

export function Step4BookingDashboard({
  eventType,
  quoteRequestsData,
  planReservations,
  confirmedRes,
  totalCost,
  isQuoteActionPending,
  handleAcceptQuote,
  handleRequestQuoteAdjustment,
  theme
}: Step4BookingDashboardProps) {
  const isWedding = eventType === "WEDDING";
  const activeRequests = (quoteRequestsData ?? []).filter((request) => request.status !== "CANCELED");
  const [adjustingResponseId, setAdjustingResponseId] = useState<string | null>(null);
  const [openAdjustmentResponseId, setOpenAdjustmentResponseId] = useState<string | null>(null);
  const [adjustmentTargetByResponseId, setAdjustmentTargetByResponseId] = useState<Record<string, string>>({});
  const [adjustmentMemoByResponseId, setAdjustmentMemoByResponseId] = useState<Record<string, string>>({});
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [panelByRequestId, setPanelByRequestId] = useState<Record<string, Step4PanelKey>>({});

  async function handleRequestAdjustment(response: QuoteResponseData) {
    const requestedTotal = Number(adjustmentTargetByResponseId[response.id]);
    const memo = adjustmentMemoByResponseId[response.id]?.trim() ?? "";
    if (!Number.isInteger(requestedTotal) || requestedTotal <= 0) {
      setAdjustmentError("희망 조정 금액을 숫자로 입력해 주세요.");
      return;
    }
    if (!memo) {
      setAdjustmentError("조정 요청 메모를 입력해 주세요.");
      return;
    }

    setAdjustmentError(null);
    setAdjustingResponseId(response.id);
    try {
      const result = await handleRequestQuoteAdjustment(response.id, requestedTotal, memo);
      if (result && !result.success) {
        setAdjustmentError(result.error ?? "조정 요청을 처리하지 못했습니다.");
        return;
      }
      setAdjustmentTargetByResponseId((current) => ({ ...current, [response.id]: "" }));
      setAdjustmentMemoByResponseId((current) => ({ ...current, [response.id]: "" }));
      setOpenAdjustmentResponseId(null);
    } finally {
      setAdjustingResponseId(null);
    }
  }

  if (!quoteRequestsData) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border/40 bg-white/50 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <ClipboardList className="h-8 w-8 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-semibold text-foreground">제안서와 예약 상태를 조회하고 있습니다.</p>
        <p className="mt-1.5 text-xs text-muted-foreground">잠시만 기다려 주십시오...</p>
      </div>
    );
  }

  if (activeRequests.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border/40 bg-white/50 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <FileText className="h-8 w-8 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-semibold text-foreground">아직 확인할 제안서가 없습니다.</p>
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
          Step 3에서 파트너에게 견적 요청을 보내면 이곳에서 제안서와 예약 진행 상태를 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
            {isWedding ? "제안서 확인 및 예약 진행" : "의전 제안서 확인 및 예약 진행"}
          </h2>
          <p className="text-xs leading-5 text-muted-foreground">
            선택한 모듈을 기준으로 업체가 보낸 제안서를 확인하고, 수락 후 예약 최종 확정까지 이어지는 흐름입니다.
          </p>
        </div>

        {activeRequests.map((request) => {
          const response = getLatestResponse(request);
          const reservation = getLinkedReservation(request, planReservations);
          const status = getStatusTone(request, reservation);
          const isConfirmed = reservation?.status === "CONFIRMED" || reservation?.status === "COMPLETED";
          const isAccepted = request.status === "ACCEPTED";
          const currentProposal = response ? getCurrentProposal(response) : null;
          const isAdjustmentRequested = currentProposal?.status === "ADJUSTMENT_REQUESTED";
          const isRevisedProposal = currentProposal?.status === "REVISED";
          const activePanel = panelByRequestId[request.id] ?? "summary";

          return (
            <article key={request.id} className="rounded-2xl border border-[#e5e2da] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 border-b border-[#f2ece4] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Badge className={`${status.tone} text-[10px] shadow-none`}>{status.label}</Badge>
                  <h3 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
                    {request.vendor?.companyName ?? "파트너 제안"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {request.plan?.title ?? "행사"} · 요청일 {formatRequestedDate(request)}
                  </p>
                  {formatProposalDate(response) && (
                    <p className="text-[11px] font-semibold text-[#2c3455]">
                      업체 확정 서비스일 {formatProposalDate(response)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#faf9f5] px-3 py-2 text-[10px] font-semibold text-[#8c8275]">
                  {reservation ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {reservation ? "예약 요청이 생성되었습니다" : "아직 예약 확정 전입니다"}
                </div>
              </div>

              <div className="space-y-4">
                <SectionBlock title="Step 3에서 요청한 선택 모듈">
                  {request.selectedPackageSnapshot ? (
                    <PackageRequestSummary
                      packageSnapshot={request.selectedPackageSnapshot}
                      priceSnapshot={request.priceSnapshot}
                    />
                  ) : (
                    <ModulePills
                      modules={request.selectedModuleDetails ?? []}
                      emptyText="요청 모듈 상세가 없습니다. 업체 요청 메모와 제안서를 기준으로 확인해 주세요."
                    />
                  )}
                </SectionBlock>

                {request.requirements && (
                  <SectionBlock title="요청 메모">
                    <p className="text-xs leading-5 text-[#2c3455]">{request.requirements}</p>
                  </SectionBlock>
                )}

                {request.status === "PENDING" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs leading-5 text-slate-700">
                    업체가 선택 모듈과 요청 메모를 검토하고 있습니다. 업체 응답을 기다리는 중입니다.
                  </div>
                )}

                {(response || reservation) && (
                  <div className="rounded-xl border border-[#f2ece4] bg-[#faf9f5]/45 p-2">
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      {STEP4_PANELS.map((panel) => {
                        const isPanelActive = activePanel === panel.key;
                        return (
                          <button
                            key={panel.key}
                            type="button"
                            onClick={() =>
                              setPanelByRequestId((current) => ({
                                ...current,
                                [request.id]: panel.key
                              }))
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                              isPanelActive
                                ? "bg-white text-[#2c3455] shadow-sm"
                                : "text-[#8c8275] hover:bg-white/60"
                            }`}
                          >
                            {panel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activePanel === "summary" && response && request.status === "RESPONDED" && (
                  <>
                    {currentProposal && (
                      <ProposalSummary
                        response={response}
                        totalPrice={currentProposal.totalPrice}
                        memo={currentProposal.memo}
                        label={isRevisedProposal ? "수정 제안 도착" : "업체 제안서"}
                      />
                    )}
                    <ProposalPriceComparison
                      request={request}
                      response={response}
                      totalPrice={currentProposal?.totalPrice}
                    />

                    {isAdjustmentRequested && currentProposal ? (
                      <div className="rounded-xl border border-amber-200/70 bg-amber-50/35 p-4">
                        <Badge className="bg-white text-amber-800 border border-amber-200/70 text-[10px] shadow-none">
                          조정 요청 보냄
                        </Badge>
                        <p className="mt-2 text-sm font-bold text-[#2c3455]">업체 수정 제안 대기 중</p>
                        <p className="mt-1 text-xs leading-5 text-amber-900">
                          수정 제안이 오면 다시 수락할 수 있습니다.
                        </p>
                        {currentProposal.adjustmentRequestMemo && (
                          <div className="mt-3 rounded-lg border border-[#f2ece4] bg-white px-3 py-2 text-xs leading-5 text-[#2c3455]">
                            {currentProposal.plannerRequestedTotalPrice != null && (
                              <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#f2ece4] pb-2">
                                <span className="font-semibold text-muted-foreground">희망 조정 금액</span>
                                <span className="font-bold text-[#c4977a]">
                                  {formatCurrency(currentProposal.plannerRequestedTotalPrice)}
                                </span>
                              </div>
                            )}
                            <p>{currentProposal.adjustmentRequestMemo}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#e5e2da] bg-[#faf9f5]/70 p-4">
                          <p className="text-sm font-bold text-[#2c3455]">이 제안 수락</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            수락하면 예약 요청이 생성됩니다.
                          </p>
                          <button
                            disabled={isQuoteActionPending}
                            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap break-keep ${theme.btnAccent}`}
                            onClick={() => handleAcceptQuote(response.id, currentProposal?.id || undefined)}
                            type="button"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            {isQuoteActionPending ? "수락 중..." : "이 제안 수락"}
                          </button>
                        </div>

                        <div className="rounded-xl border border-[#e5e2da] bg-white p-4">
                          <p className="text-sm font-bold text-[#2c3455]">조정 요청하기</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            희망 금액과 메모를 업체에 전달합니다.
                          </p>
                          {openAdjustmentResponseId === response.id ? (
                            <div className="mt-3 rounded-lg border border-[#f2ece4] bg-[#faf9f5]/60 p-3">
                              <label className="block text-[10px] font-bold text-[#8c8275]" htmlFor={`adjustment-price:${response.id}`}>
                                희망 조정 금액
                              </label>
                              <input
                                id={`adjustment-price:${response.id}`}
                                inputMode="numeric"
                                value={adjustmentTargetByResponseId[response.id] ?? ""}
                                onChange={(event) =>
                                  setAdjustmentTargetByResponseId((current) => ({
                                    ...current,
                                    [response.id]: event.target.value.replace(/[^\d]/g, "")
                                  }))
                                }
                                placeholder="5000000"
                                className="mt-2 h-10 w-full rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-semibold text-[#2c3455] outline-none focus:border-[#c4977a]"
                              />
                              <label className="mt-3 block text-[10px] font-bold text-[#8c8275]" htmlFor={`adjustment:${response.id}`}>
                                조정 요청 메모
                              </label>
                              <textarea
                                id={`adjustment:${response.id}`}
                                value={adjustmentMemoByResponseId[response.id] ?? ""}
                                onChange={(event) =>
                                  setAdjustmentMemoByResponseId((current) => ({
                                    ...current,
                                    [response.id]: event.target.value
                                  }))
                                }
                                placeholder="예산을 500만원 안으로 맞추고 싶어요. 꽃장식 옵션을 줄이면 금액 조정이 가능한가요?"
                                className="mt-2 min-h-[88px] w-full resize-none rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs text-[#2c3455] outline-none focus:border-[#c4977a]"
                              />
                              {adjustmentError && (
                                <p className="mt-2 text-[11px] font-semibold text-red-600">{adjustmentError}</p>
                              )}
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <button
                                  disabled={adjustingResponseId === response.id || isQuoteActionPending}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-semibold text-[#2c3455] hover:bg-[#faf9f5] disabled:opacity-60"
                                  onClick={() => handleRequestAdjustment(response)}
                                  type="button"
                                >
                                  <MessageSquareQuote className="h-3.5 w-3.5" />
                                  {adjustingResponseId === response.id ? "요청 중..." : "조정 요청 보내기"}
                                </button>
                                <button
                                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-[#8c8275] hover:bg-white"
                                  onClick={() => {
                                    setOpenAdjustmentResponseId(null);
                                    setAdjustmentError(null);
                                  }}
                                  type="button"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              disabled={isQuoteActionPending}
                              className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#e5e2da] bg-white px-3 py-2 text-xs font-semibold text-[#2c3455] hover:bg-[#faf9f5] disabled:opacity-60"
                              onClick={() => {
                                setOpenAdjustmentResponseId(response.id);
                                setAdjustmentError(null);
                              }}
                              type="button"
                            >
                              <MessageSquareQuote className="h-3.5 w-3.5" />
                              조정 요청하기
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activePanel === "summary" && response && isAccepted && (
                  <>
                    <ProposalSummary
                      response={response}
                      totalPrice={currentProposal?.totalPrice}
                      memo={currentProposal?.memo}
                      isAccepted
                    />
                    <ProposalPriceComparison
                      request={request}
                      response={response}
                      totalPrice={currentProposal?.totalPrice}
                    />
                  </>
                )}

                {activePanel === "history" && response && (
                  <ProposalRevisionHistory response={response} />
                )}

                {activePanel === "reservation" && response && isAccepted && !isConfirmed && (
                  <div className="rounded-xl border border-[#e5e2da] bg-[#faf8f4]/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-[#8c8275]">업체 최종 확정 대기</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          예약 요청이 생성되었습니다. 업체가 일정과 사양을 최종 확인하면 예약이 확정됩니다.
                        </p>
                      </div>
                      {reservation?.vendorConfirmationDueAt && (
                        <div className="rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-[#8c8275]">
                          확정 기한: {formatDate(reservation.vendorConfirmationDueAt)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activePanel === "reservation" && response && isConfirmed && reservation && (
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <p className="text-sm font-bold text-emerald-800">예약 확정 완료</p>
                    </div>
                    <div className="grid gap-2 text-xs text-[#2c3455] sm:grid-cols-3">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
                        {formatDate(reservation.reservedDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-emerald-700" />
                        {formatCurrency(reservation.totalAmount)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <PackageCheck className="h-3.5 w-3.5 text-emerald-700" />
                        최종 확정 완료
                      </span>
                    </div>
                  </div>
                )}

                {activePanel === "reservation" && response && request.status === "RESPONDED" && (
                  <div className="rounded-xl border border-[#e5e2da] bg-[#faf9f5]/70 p-4">
                    <p className="text-sm font-bold text-[#2c3455]">아직 예약 확정 전입니다</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      제안을 수락하면 예약 요청이 생성되고 업체 최종 확정 단계로 넘어갑니다.
                    </p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <aside className="space-y-4">
        <div className={`rounded-2xl border p-5 ${theme.cardHighlight}`}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">진행 요약</p>
          <p className="font-[var(--font-serif)] text-2xl font-bold text-[#2c3455]">
            {confirmedRes.length > 0 ? formatCurrency(totalCost) : `${activeRequests.length}건 진행 중`}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {confirmedRes.length > 0
              ? `${confirmedRes.length}개 예약이 최종 확정되었습니다.`
              : "제안 수락 전에는 아직 예약 확정 전입니다."}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e2da] bg-white p-5 shadow-sm">
          <p className="mb-3 font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">예약 전환 기준</p>
          <div className="space-y-3 text-xs leading-5 text-muted-foreground">
            <p>1. 업체 제안서가 도착하면 금액과 포함 범위를 확인합니다.</p>
            <p>2. 제안을 수락하면 예약 요청이 생성됩니다.</p>
            <p>3. 업체가 최종 확정하면 예약 확정 완료 상태가 됩니다.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
