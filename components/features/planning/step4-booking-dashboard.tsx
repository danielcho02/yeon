"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  Clock,
  FileText,
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
  handleAcceptQuote: (responseId: string) => Promise<any> | void;
  requestForm: { guestCount: string };
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  theme: any;
  step4DashboardData?: Step4CategoryStatusDTO[] | null;
}

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

function moduleSelectionLabel(module: VendorServiceModuleData) {
  return module.isBaseIncluded ? "기본 포함" : "추가 선택";
}

function getLatestResponse(request: QuoteRequestWithResponses) {
  return request.responses[0] ?? null;
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
  isAccepted
}: {
  response: QuoteResponseData;
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
            {isAccepted ? "수락한 제안서" : "업체 제안서"}
          </Badge>
          <p className="text-sm font-bold text-[#2c3455]">{response.modules.basePackage.name}</p>
          {response.note && (
            <p className="max-w-xl text-xs leading-5 text-muted-foreground">{response.note}</p>
          )}
        </div>
        <div className="text-left sm:text-right">
          <span className="block text-[9px] text-muted-foreground">총 제안 금액</span>
          <span className="font-[var(--font-serif)] text-xl font-bold text-[#c4977a]">
            {formatCurrency(response.totalPrice)}
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

function getPricingTypeLabel(pricingType: VendorServiceModuleData["pricingType"]) {
  return pricingType === "PER_GUEST" ? "인원 기준" : "고정가";
}

function formatRequestedModulePrice(module: VendorServiceModuleData, guestCount?: number | null) {
  if (module.pricingType === "PER_GUEST") {
    const total = guestCount ? ` · 요청 기준 ${formatCurrency(module.price * guestCount)}` : "";
    return `${formatCurrency(module.price)} / 1인${total}`;
  }
  return formatCurrency(module.price);
}

function ModuleWorkflowDetail({
  requests,
  planReservations
}: {
  requests: QuoteRequestWithResponses[];
  planReservations: Step4BookingDashboardProps["planReservations"];
}) {
  if (requests.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#e5e2da] bg-white p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">요청 범위 진행 상세</p>
        <p className="text-sm font-bold text-[#2c3455]">요청 범위부터 예약 확정까지 한 화면에서 확인합니다.</p>
      </div>

      <div className="space-y-3">
        {requests.map((request) => {
          const response = getLatestResponse(request);
          const reservation = getLinkedReservation(request, planReservations);
          const status = getStatusTone(request, reservation);
          const finalIncludedModules = response
            ? [...(response.modules.includedModules ?? []), ...(response.modules.optionalModules ?? [])]
            : [];

          return (
            <details
              key={request.id}
              className="rounded-xl border border-[#f2ece4] bg-[#faf9f5]/45 p-4"
              open={request.status !== "PENDING"}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#2c3455]">
                      {request.vendor?.companyName ?? "파트너 제안"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {request.selectedModuleDetails?.length
                        ? `${request.selectedModuleDetails[0].name}${request.selectedModuleDetails.length > 1 ? ` 외 ${request.selectedModuleDetails.length - 1}개` : ""}`
                        : "선택 모듈 확인"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.tone}`}>
                    {status.label}
                  </span>
                </div>
              </summary>

              <div className="mt-4 space-y-3">
                <SectionBlock title="요청 범위">
                  <div className="space-y-2.5">
                    {(request.selectedModuleDetails ?? []).map((module) => (
                      <div
                        key={module.id}
                        className="rounded-xl border border-[#f2ece4] bg-white px-3.5 py-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#2c3455]">{module.name}</span>
                              <span className="rounded-full border border-[#ebdccf]/70 bg-[#faf9f5] px-2 py-0.5 text-[10px] font-semibold text-[#8c8275]">
                                {categoryLabel(module.category)}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {moduleSelectionLabel(module)}
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
                              기준가 {formatRequestedModulePrice(module, request.plan?.guestCount)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              가격 방식 {getPricingTypeLabel(module.pricingType)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(request.selectedModuleDetails ?? []).length === 0 && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        요청 모듈 상세가 없습니다. 상단 제안 카드의 메모와 금액을 기준으로 확인해 주세요.
                      </p>
                    )}
                  </div>
                </SectionBlock>

                <SectionBlock title="업체 제안">
                  {response ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">최종 제안 총액</span>
                        <span className="font-bold text-[#c4977a]">{formatCurrency(response.totalPrice)}</span>
                      </div>
                      {response.note && (
                        <p className="rounded-lg bg-white px-3 py-2 leading-5 text-[#2c3455]">{response.note}</p>
                      )}
                      {finalIncludedModules.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {finalIncludedModules.map((module) => (
                            <span
                              key={`${module.id}:${module.name}`}
                              className="inline-flex items-center gap-1 rounded-full border border-[#ebdccf]/70 bg-white px-2.5 py-1 text-[10px] font-semibold text-[#2c3455]"
                            >
                              {module.name}
                              <span className="text-[#8c8275]">{categoryLabel(module.category)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      아직 업체 제안이 도착하지 않았습니다. 업체 응답을 기다리는 중입니다.
                    </p>
                  )}
                </SectionBlock>

                <SectionBlock title="예약 상태">
                  {reservation ? (
                    <div className="space-y-2 text-xs text-[#2c3455]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">현재 상태</span>
                        <span className="font-semibold">
                          {reservation.status === "CONFIRMED" || reservation.status === "COMPLETED"
                            ? "예약 확정 완료"
                            : "업체 최종 확정 대기"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">예약 금액</span>
                        <span className="font-semibold">{formatCurrency(reservation.totalAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">예정 일자</span>
                        <span className="font-semibold">{formatDate(reservation.reservedDate)}</span>
                      </div>
                      {reservation.vendorConfirmationDueAt && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">업체 확정 기한</span>
                          <span className="font-semibold">{formatDate(reservation.vendorConfirmationDueAt)}</span>
                        </div>
                      )}
                    </div>
                  ) : request.status === "RESPONDED" ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      제안서는 도착했지만 아직 수락 전입니다. 아직 예약 확정 전입니다.
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      현재는 요청 단계입니다. 업체 응답을 기다리는 중입니다.
                    </p>
                  )}
                </SectionBlock>
              </div>
            </details>
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
  theme
}: Step4BookingDashboardProps) {
  const isWedding = eventType === "WEDDING";
  const activeRequests = (quoteRequestsData ?? []).filter((request) => request.status !== "CANCELED");

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

          return (
            <article key={request.id} className="rounded-2xl border border-[#e5e2da] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 border-b border-[#f2ece4] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Badge className={`${status.tone} text-[10px] shadow-none`}>{status.label}</Badge>
                  <h3 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
                    {request.vendor?.companyName ?? "파트너 제안"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {request.plan?.title ?? "행사"} · {formatDate(request.preferredDate ?? request.plan?.eventDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#faf9f5] px-3 py-2 text-[10px] font-semibold text-[#8c8275]">
                  {reservation ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {reservation ? "예약 요청이 생성되었습니다" : "아직 예약 확정 전입니다"}
                </div>
              </div>

              <div className="space-y-4">
                <SectionBlock title="Step 3에서 요청한 선택 모듈">
                  <ModulePills
                    modules={request.selectedModuleDetails ?? []}
                    emptyText="요청 모듈 상세가 없습니다. 업체 요청 메모와 제안서를 기준으로 확인해 주세요."
                  />
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

                {response && request.status === "RESPONDED" && (
                  <>
                    <ProposalSummary response={response} />
                    <div className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-50/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-amber-800">
                        이 제안을 수락하면 예약 요청이 생성되고, 업체의 최종 확정을 기다립니다.
                      </p>
                      <button
                        disabled={isQuoteActionPending}
                        className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap break-keep min-w-[8.5rem] ${theme.btnAccent}`}
                        onClick={() => handleAcceptQuote(response.id)}
                        type="button"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {isQuoteActionPending ? "수락 중..." : "제안 수락"}
                      </button>
                    </div>
                  </>
                )}

                {response && isAccepted && !isConfirmed && (
                  <>
                    <ProposalSummary response={response} isAccepted />
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
                  </>
                )}

                {response && isConfirmed && reservation && (
                  <>
                    <ProposalSummary response={response} isAccepted />
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
                  </>
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

        <ModuleWorkflowDetail requests={activeRequests} planReservations={planReservations} />
      </aside>
    </div>
  );
}
