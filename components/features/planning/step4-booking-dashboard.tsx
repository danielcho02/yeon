"use client";

import {
  Building2,
  Utensils,
  Flower2,
  ClipboardList,
  Shield,
  Sparkles,
  Check,
  CheckCheck,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuoteComparison, mapQuoteRequestsToVendorQuotes } from "./quote-comparison";
import type { QuoteRequestWithResponses } from "@/types/quote";
import { formatCurrency, formatDate } from "@/lib/format";

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
}

export function Step4BookingDashboard({
  eventType,
  quoteRequestsData,
  planReservations,
  confirmedRes,
  totalCost,
  isQuoteActionPending,
  handleAcceptQuote,
  requestForm,
  theme
}: Step4BookingDashboardProps) {
  const isWedding = eventType === "WEDDING";

  // Helper definitions
  const WEDDING_CATEGORIES = [
    { key: "venue", name: "예식장/공간", dbCategory: ["venue"] },
    { key: "catering", name: "식음료", dbCategory: ["catering"] },
    { key: "floral", name: "플라워/장식", dbCategory: ["floral"] },
    { key: "invitation", name: "초대장", dbCategory: ["invitation"] },
    { key: "etc", name: "기타 옵션", dbCategory: ["studio", "dress", "makeup", "honeymoon", "weddingOther"] },
  ];

  const FUNERAL_CATEGORIES = [
    { key: "funeralHall", name: "장례식장", dbCategory: ["funeralHall"] },
    { key: "meal", name: "문상객 식사", dbCategory: ["meal"] },
    { key: "obituary", name: "부고 안내", dbCategory: ["obituary", "funeralOther"] },
    { key: "hearse", name: "운구", dbCategory: ["hearse", "cremation", "ossuary", "shroud"] },
    { key: "altarFloral", name: "제단꽃/화환", dbCategory: ["altarFloral"] },
  ];

  const categories = isWedding ? WEDDING_CATEGORIES : FUNERAL_CATEGORIES;

  const getCategoryKeyOfRequest = (req: QuoteRequestWithResponses): string => {
    if (req.vendor?.category) {
      return req.vendor.category.toLowerCase();
    }
    if (req.selectedModules && req.selectedModules.length > 0) {
      return req.selectedModules[0].toLowerCase();
    }
    return "etc";
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const getCategoryKeyOfReservation = (res: any): string => {
    if (res.serviceCategory) {
      return res.serviceCategory.toLowerCase();
    }
    if (res.vendor?.category) {
      return res.vendor.category.toLowerCase();
    }
    return "etc";
  };

  const getCategoryIcon = (categoryKey: string) => {
    switch (categoryKey) {
      case "venue":
      case "funeralHall":
        return Building2;
      case "catering":
      case "meal":
        return Utensils;
      case "floral":
      case "altarFloral":
        return Flower2;
      case "invitation":
      case "obituary":
        return ClipboardList;
      case "hearse":
        return Shield;
      default:
        return Sparkles;
    }
  };

  const categoryGroups = categories.map(catItem => {
    const matchedRequests = (quoteRequestsData ?? []).filter(req => {
      const cat = getCategoryKeyOfRequest(req);
      return catItem.dbCategory.map(c => c.toLowerCase()).includes(cat) || cat === catItem.key.toLowerCase();
    });

    const matchedReservations = planReservations.filter(res => {
      const cat = getCategoryKeyOfReservation(res);
      return catItem.dbCategory.map(c => c.toLowerCase()).includes(cat) || cat === catItem.key.toLowerCase();
    });

    let status: "요청 전" | "응답 대기" | "견적 도착" | "수락 가능" | "업체 최종 확정 대기" | "예약 확정 완료" = "요청 전";
    
    const hasConfirmed = matchedReservations.some(r => r.status === "CONFIRMED" || r.status === "COMPLETED");
    const hasAccepted = matchedRequests.some(req => req.status === "ACCEPTED") || matchedReservations.some(r => r.status === "PENDING" && r.quoteRequestStatus === "ACCEPTED");
    const hasResponded = matchedRequests.some(req => req.status === "RESPONDED");
    const hasPending = matchedRequests.some(req => req.status === "PENDING");

    if (hasConfirmed) {
      status = "예약 확정 완료";
    } else if (hasAccepted) {
      status = "업체 최종 확정 대기";
    } else if (hasResponded) {
      status = "수락 가능";
    } else if (hasPending) {
      status = "응답 대기";
    }

    return {
      categoryKey: catItem.key,
      categoryName: catItem.name,
      requests: matchedRequests,
      reservations: matchedReservations,
      status
    };
  });

  const STATUS_METAS: Record<string, { label: string; tone: string }> = {
    "요청 전": { label: "요청 전", tone: "bg-slate-100 text-slate-600 border border-slate-200/50" },
    "응답 대기": { label: "응답 대기", tone: "bg-amber-50 text-amber-700 border border-amber-200/50" },
    "견적 도착": { label: "견적 도착", tone: "bg-blue-50 text-blue-700 border border-blue-200/50" },
    "수락 가능": { label: "수락 가능", tone: "bg-amber-100 text-[#b45309] border border-amber-200" },
    "업체 최종 확정 대기": { label: "최종 확정 대기", tone: "bg-purple-50 text-purple-700 border border-purple-200/50" },
    "예약 확정 완료": { label: "예약 확정 완료", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200/50" },
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      {/* Left column: category-based prep lanes */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
            {isWedding ? "웨딩 서비스 카테고리별 준비 상태" : "장례 절차별 카테고리 준비 상태"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isWedding 
              ? "예식에 필요한 품목별 견적 수신, 승인 및 예약 최종 확정 상태를 차분히 정리해 드립니다."
              : "장례 진행에 꼭 필요한 의전별 상담 수신, 승인 및 최종 예약을 정중히 안내해 드립니다."}
          </p>
        </div>

        <div className="space-y-4">
          {categoryGroups.map((group) => {
            const IconComp = getCategoryIcon(group.categoryKey);
            const meta = STATUS_METAS[group.status] || STATUS_METAS["요청 전"];
            return (
              <div 
                key={group.categoryKey} 
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 ${
                  group.status === "예약 확정 완료" 
                    ? "border-emerald-100 bg-emerald-50/5" 
                    : group.status === "업체 최종 확정 대기"
                    ? "border-purple-100 bg-purple-50/5"
                    : group.status === "수락 가능"
                    ? "border-amber-200 bg-amber-50/5 ring-1 ring-amber-500/10"
                    : "border-border/40"
                }`}
              >
                {/* Header line of the category */}
                <div className="flex items-center justify-between pb-3.5 border-b border-border/40 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-slate-50 text-[#2c3455] border border-slate-100`}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    <span className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">{group.categoryName}</span>
                  </div>
                  <Badge className={`${meta.tone} text-[10px] px-2 py-0.5 font-medium rounded-full shadow-none`}>
                    {meta.label}
                  </Badge>
                </div>

                {/* Category Body depends on the status */}
                {group.status === "요청 전" && (
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 py-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      아직 견적을 요청하지 않은 항목입니다. 추천 구성을 확인하고 견적을 진행할 수 있습니다.
                    </p>
                  </div>
                )}

                {group.status === "응답 대기" && (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center gap-2 text-xs text-[#8c8275] bg-[#faf9f5] border border-[#e5e2da] px-3.5 py-2.5 rounded-xl">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[#c4977a]" />
                      <span>
                        {group.requests.map(r => r.vendor?.companyName ?? "업체").join(", ")} 파트너사가 맞춤 명세를 작성하고 있습니다.
                      </span>
                    </div>
                  </div>
                )}

                {group.status === "수락 가능" && (() => {
                  // Filter responded requests in this category
                  const responded = group.requests.filter(req => req.status === "RESPONDED");
                  
                  // Check if we have multiple responses in this specific category
                  const hasMultiple = responded.length > 1;

                  if (hasMultiple) {
                    // Render a localized QuoteComparison for this category
                    const localQuotes = mapQuoteRequestsToVendorQuotes(responded);
                    return (
                      <div className="space-y-3 pt-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {group.categoryName} 복수 견적 비교
                        </p>
                        <QuoteComparison
                          quotes={localQuotes}
                          theme={eventType === "WEDDING" ? "wedding" : "funeral"}
                          guestCount={Math.max(1, Number.parseInt(requestForm.guestCount, 10) || 100)}
                          isLoading={false}
                          isAccepting={isQuoteActionPending}
                          onAccept={handleAcceptQuote}
                        />
                      </div>
                    );
                  } else {
                    // Render a single luxury card
                    const req = responded[0];
                    if (!req) return null;
                    const resp = req.responses[0];
                    if (!resp) return null;
                    const vendorName = resp.vendor?.companyName ?? "업체";
                    return (
                      <div className="space-y-4 pt-1">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/20">
                          <div className="space-y-1">
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 font-semibold">추천 제안서 도착</span>
                            <p className="text-xs font-bold text-[#2c3455]">{vendorName}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                              {resp.note || "제안 및 포함 범위 안내에 따라 예약을 결정하실 수 있습니다."}
                            </p>
                            {resp.modules.includedModules && resp.modules.includedModules.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {resp.modules.includedModules.map(m => (
                                  <span key={m.id} className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-left sm:text-right sm:shrink-0 space-y-2">
                            <div>
                              <span className="text-[9px] text-muted-foreground block">총 제안 금액</span>
                              <span className="text-sm font-bold text-[#c4977a]">{formatCurrency(resp.totalPrice)}</span>
                            </div>
                            <button
                              disabled={isQuoteActionPending}
                              className={`flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold ${theme.btnAccent} w-full sm:w-auto`}
                              onClick={() => handleAcceptQuote(resp.id)}
                              type="button"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                              {isQuoteActionPending ? "수락 중..." : "이 제안 수락하기"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}

                {group.status === "업체 최종 확정 대기" && (() => {
                  const acceptedReqItem = group.requests.find(r => r.status === "ACCEPTED");
                  if (!acceptedReqItem) return null;
                  const resp = acceptedReqItem.responses[0];
                  const vendorName = resp?.vendor?.companyName ?? "업체";
                  const price = resp?.totalPrice ?? 0;

                  return (
                    <div className="rounded-xl border border-purple-100 bg-purple-50/10 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                      <div className="space-y-1 pl-2">
                        <p className="text-xs font-bold text-[#2c3455]">{vendorName}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          고객님께서 견적을 승인하셨습니다. 파트너사에서 일정을 조율해 최종 예약을 확정하는 단계입니다.
                        </p>
                        {acceptedReqItem.reservation?.vendorConfirmationDueAt && (
                          <p className="text-[10px] text-purple-700 font-semibold">
                            확정 예정 기한: {formatDate(acceptedReqItem.reservation.vendorConfirmationDueAt)}
                          </p>
                        )}
                      </div>
                      <div className="text-right sm:shrink-0 pl-2">
                        <span className="text-[9px] text-muted-foreground block">승인 견적 금액</span>
                        <span className="text-sm font-bold text-purple-700">{formatCurrency(price)}</span>
                      </div>
                    </div>
                  );
                })()}

                {group.status === "예약 확정 완료" && (() => {
                  const confirmedResItem = group.reservations.find(r => r.status === "CONFIRMED" || r.status === "COMPLETED");
                  if (!confirmedResItem) return null;
                  const vendorName = confirmedResItem.vendor.companyName ?? confirmedResItem.vendor.name;
                  const price = confirmedResItem.confirmedAmount ?? confirmedResItem.quotedAmount ?? 0;

                  return (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/10 p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                      <div className="space-y-1 pl-2">
                        <p className="text-xs font-bold text-[#2c3455]">{vendorName}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          예약이 최종 확정되었습니다. 당일에 맞추어 엄선된 파트너가 책임을 다해 준비합니다.
                        </p>
                        {confirmedResItem.serviceDate && (
                          <p className="text-[10px] text-emerald-700 font-semibold">
                            확정일: {formatDate(confirmedResItem.serviceDate)}
                          </p>
                        )}
                      </div>
                      <div className="text-right sm:shrink-0 pl-2">
                        <span className="text-[9px] text-muted-foreground block">최종 예약 확정 금액</span>
                        <span className="text-sm font-bold text-emerald-700">{formatCurrency(price)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmed + cost sidebar (Completed Lane) */}
      <div className="space-y-4">
        <h3 className="font-[var(--font-serif)] text-sm font-bold text-[#2c3455]">확정 완료된 명세서</h3>

        {confirmedRes.length > 0 ? (
          <div className="space-y-3">
            {confirmedRes.map((r) => (
              <div key={r.id} className="rounded-2xl border border-emerald-200/60 bg-[#eafaf1]/30 p-5 shadow-sm transition-all duration-200 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 pl-1">
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-[#eafaf1] text-[#0f9652] border border-emerald-100 hover:bg-[#eafaf1] text-[10px]">최종 예약 확정</Badge>
                      <Check className="h-3.5 w-3.5 text-[#0f9652]" />
                    </div>
                    <p className="text-sm font-bold text-[#2c3455]">
                      {r.vendor.companyName ?? r.vendor.name}
                    </p>
                    <div className="grid gap-1 text-[11px] text-muted-foreground">
                      <span>{isWedding ? "예식일" : "장례일"}: {formatDate(r.serviceDate)}</span>
                      {r.eventPlan.region && <span>지역: {r.eventPlan.region}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground block">최종 합의 금액</span>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</span>
                  </div>
                </div>
              </div>
            ))}

            <div className={`rounded-2xl border p-5 ${theme.cardHighlight}`}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">총 예약 확정 예산</p>
              <p className="font-[var(--font-serif)] text-2xl font-bold text-[#2c3455]">{formatCurrency(totalCost)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{confirmedRes.length}개 서비스 합계</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-border/40 bg-white/50 p-8 text-center flex flex-col items-center justify-center">
            <div className="mb-3 rounded-xl bg-muted/40 p-2.5 text-muted-foreground/60">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">확정된 예약 내역이 없습니다.</p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground max-w-xs">견적을 승인하신 후 파트너사의 승인이 완료되면 최종 확정서가 자동 발행됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
