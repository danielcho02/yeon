"use client";

import {
  Building2,
  ClipboardList,
  Sparkles,
  Check,
  CheckCheck,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QuoteRequestWithResponses, Step4CategoryStatusDTO } from "@/types/quote";
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
  step4DashboardData?: Step4CategoryStatusDTO[] | null;
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
  theme,
  step4DashboardData
}: Step4BookingDashboardProps) {
  const isWedding = eventType === "WEDDING";

  // Safe empty / loading fallback when step4DashboardData is absent
  if (!step4DashboardData) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border/40 bg-white/50 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <ClipboardList className="h-8 w-8 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-semibold text-foreground">견적 상태 분석 데이터를 조회하고 있습니다.</p>
        <p className="mt-1.5 text-xs text-muted-foreground">잠시만 기다려 주십시오...</p>
      </div>
    );
  }

  // Find the single active vendor request and reservation
  const activeRequest = (quoteRequestsData ?? []).find(r => r.vendor !== undefined);
  const activeReservation = planReservations.find(res => res.vendor !== undefined);
  const isConfirmed = confirmedRes.some(r => r.vendor !== undefined);

  // Deriving the single unified status
  let currentStatus: "요청 전" | "응답 대기" | "수락 가능" | "최종 확정 대기" | "예약 완료" = "요청 전";
  if (isConfirmed) {
    currentStatus = "예약 완료";
  } else if (activeRequest?.status === "ACCEPTED" || activeReservation?.status === "CONFIRMED") {
    currentStatus = "최종 확정 대기";
  } else if (activeRequest?.status === "RESPONDED") {
    currentStatus = "수락 가능";
  } else if (activeRequest?.status === "PENDING") {
    currentStatus = "응답 대기";
  }

  const steps = [
    { label: "요청 전", desc: "패키지 구성 선택", statusKey: "요청 전" },
    { label: "응답 대기", desc: "제안서 작성 중", statusKey: "응답 대기" },
    { label: "수락 대기", desc: "제안서 검토 및 수락", statusKey: "수락 가능" },
    { label: "최종 조율", desc: "파트너 일정 확정 대기", statusKey: "최종 확정 대기" },
    { label: "예약 완료", desc: "계약 확정 및 예약 완료", statusKey: "예약 완료" }
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      {/* Left column: Single Unified Vendor Proposal Card & Timeline */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
            {isWedding ? "웨딩 서비스 통합 견적 및 예약 관리" : "장례 서비스 통합 의전 및 예약 관리"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isWedding 
              ? "예식에 필요한 품목별 견적 수신, 승인 및 예약 최종 확정 상태를 차분히 정리해 드립니다."
              : "장례 진행에 꼭 필요한 의전별 상담 수신, 승인 및 최종 예약을 정중히 안내해 드립니다."}
          </p>
        </div>

        {/* Timeline Progression */}
        <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-sm">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground/60">
            {isWedding ? "Wedding Proposal Timeline" : "Funeral Service Timeline"}
          </p>
          <div className="grid grid-cols-5 gap-2 relative">
            {steps.map((s, idx) => {
              const isActive = currentStatus === s.statusKey;
              const isPast = steps.findIndex(st => st.statusKey === currentStatus) >= idx;
              return (
                <div key={s.label} className="flex flex-col items-center text-center relative z-10">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${
                    isActive 
                      ? isWedding 
                        ? "bg-[#c4977a] text-white border-[#c4977a] shadow-[0_0_12px_rgba(196,151,122,0.2)]" 
                        : "bg-[#2c3455] text-white border-[#2c3455] shadow-[0_0_12px_rgba(44,52,85,0.2)]"
                      : isPast
                        ? isWedding
                          ? "bg-[#c4977a]/10 text-[#c4977a] border-[#c4977a]/30"
                          : "bg-[#2c3455]/10 text-[#2c3455] border-[#2c3455]/30"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}>
                    {idx + 1}
                  </div>
                  <span className={`mt-2 block text-[11px] font-bold ${
                    isActive ? "text-[#2c3455]" : "text-muted-foreground/80"
                  }`}>
                    {s.label}
                  </span>
                  <span className="hidden sm:block mt-0.5 text-[9px] text-muted-foreground/60 leading-tight">
                    {s.desc}
                  </span>
                </div>
              );
            })}
            {/* Background Line */}
            <div className="absolute left-[10%] right-[10%] top-[18px] h-0.5 bg-slate-100 -z-0" />
            <div 
              className={`absolute left-[10%] top-[18px] h-0.5 transition-all duration-500 -z-0 ${
                isWedding ? "bg-[#c4977a]/50" : "bg-[#2c3455]/50"
              }`}
              style={{ 
                width: `${(steps.findIndex(st => st.statusKey === currentStatus) / 4) * 80}%` 
              }}
            />
          </div>
        </div>

        {/* Unified Vendor Proposal Card */}
        <div className="rounded-3xl border border-border/40 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 pb-5 border-b border-border/30">
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl ${
                isWedding ? "bg-[#faf6f0] text-[#c4977a]" : "bg-slate-50 text-[#2c3455]"
              } border ${isWedding ? "border-[#ebdccf]/40" : "border-slate-100"}`}>
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455]">
                    {isWedding ? "모먼트 가든 (Moment Garden)" : "한결 의전 (Hankyul Memorial)"}
                  </h3>
                  <Badge className={`${
                    isWedding ? "bg-[#fcf8f2] text-[#c4977a] border-[#ebdccf]/50" : "bg-slate-100 text-[#2c3455] border-slate-200/50"
                  } text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0 shadow-none hover:bg-transparent`}>
                    {isWedding ? "공간 패키지 벤더" : "통합 의전 파트너"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isWedding ? "공간 대여 + 식사 + 꽃장식 올인원 웨딩 명세" : "장례식장 + 문상객 식사 + 상조 지원 통합 의전 명세"}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">현재 상태</span>
              <Badge className={`${
                currentStatus === "예약 완료"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : currentStatus === "최종 확정 대기"
                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                  : currentStatus === "수락 가능"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : currentStatus === "응답 대기"
                  ? "bg-amber-50 text-amber-600 border border-amber-100"
                  : "bg-slate-100 text-slate-600 border border-slate-200/50"
              } text-[10px] px-2.5 py-0.5 font-semibold rounded-full shadow-none hover:bg-transparent`}>
                {currentStatus}
              </Badge>
            </div>
          </div>

          {/* Body Content based on State */}
          {currentStatus === "요청 전" && (
            <div className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-[#2c3455]">
                {isWedding 
                  ? "아직 견적 요청이 발송되지 않았습니다. 3단계(예식 공간 & 구성품 추천)로 돌아가 원하시는 웨딩 구성을 세팅하고 '제안서 요청' 버튼을 누르시면, 모먼트 가든에서 올인원 맞춤 제안서를 설계하여 이곳에 등록해 드립니다."
                  : "아직 통합 상담 및 견적 요청이 발송되지 않았습니다. 3단계로 이동하여 기본적인 장례 패키지와 절차 구성을 선택한 후 '상담 및 견적 요청'을 완료해 주십시오."}
              </p>
              <div className="rounded-2xl border border-dashed border-border/60 bg-slate-50/50 p-5 text-center text-xs text-muted-foreground">
                3단계 추천 구성 세팅 후 제안서 조회가 시작됩니다.
              </div>
            </div>
          )}

          {currentStatus === "응답 대기" && (
            <div className="space-y-4 py-2">
              <div className="flex gap-3 p-4.5 rounded-2xl border border-amber-100 bg-amber-50/10 text-xs text-amber-800 leading-relaxed">
                <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">파트너사가 고객님의 일정에 맞춰 견적 및 서비스 구성을 작성하고 있습니다.</p>
                  <p className="text-amber-700/80">제안서 작성이 완료되는 대로 이곳에 제안 금액과 포함/제외 항목의 상세 내역이 표기됩니다.</p>
                </div>
              </div>
              
              {activeRequest && (
                <div className="rounded-2xl border border-border/40 p-4.5 bg-slate-50/30 space-y-3">
                  <h4 className="text-xs font-bold text-[#2c3455]">{isWedding ? "요청된 웨딩 정보" : "요청된 장례 정보"}</h4>
                  <div className="grid gap-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>희망 일자</span>
                      <span className="font-semibold text-[#2c3455]">{activeRequest.preferredDate ? formatDate(activeRequest.preferredDate) : "미정 (협의)"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>예상 하객 / 조문객</span>
                      <span className="font-semibold text-[#2c3455]">{requestForm.guestCount}명</span>
                    </div>
                    {activeRequest.budget && (
                      <div className="flex justify-between">
                        <span>희망 예산 범위</span>
                        <span className="font-semibold text-[#2c3455]">{formatCurrency(activeRequest.budget)}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-border/20">
                      <span>요청 사항 메모</span>
                      <p className="text-[#2c3455] bg-white border border-border/30 rounded-xl p-3 mt-1 text-[11px] leading-relaxed italic break-all">
                        &ldquo;{activeRequest.requirements || "특별히 기재된 요청 사항이 없습니다."}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStatus === "수락 가능" && (() => {
            const resp = activeRequest?.responses?.[0];
            if (!resp) return null;
            return (
              <div className="space-y-5 py-2">
                <div className="p-4.5 rounded-2xl border border-amber-200 bg-amber-50/15 space-y-1.5 text-xs text-[#2c3455]">
                  <p className="font-bold text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    맞춤형 통합 제안서 도착
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {resp.note || "파트너사에서 고객님의 행사 조건에 최적화된 맞춤 구성을 설계했습니다. 포함 범위를 상세히 보시고 수락 여부를 결정해 주십시오."}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/40 p-5 bg-slate-50/30 space-y-4">
                  <div className="space-y-2 pb-3.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">기본 상품 패키지</span>
                    <p className="text-xs font-bold text-[#2c3455]">{resp.modules?.basePackage?.name || "기본 올인원 서비스 패키지"}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{resp.modules?.basePackage?.description}</p>
                  </div>

                  {resp.modules?.includedModules && resp.modules.includedModules.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">포함 서비스 구성 내역</span>
                      <div className="grid gap-2">
                        {resp.modules.includedModules.map((m: { id: string; name: string; price: number; description?: string | null }) => (
                          <div key={m.id} className="flex justify-between items-center text-xs bg-white border border-border/30 rounded-xl p-3">
                            <div className="space-y-0.5">
                              <span className="font-bold text-[#2c3455]">{m.name}</span>
                              {m.description && <p className="text-[10px] text-muted-foreground">{m.description}</p>}
                            </div>
                            <span className="font-semibold text-slate-600">{m.price > 0 ? formatCurrency(m.price) : "기본 포함"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-5 rounded-2xl border border-[#c4977a]/30 bg-[#faf8f5]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">제안 총 예산</span>
                    <p className="text-xl font-bold text-[#2c3455]">{formatCurrency(resp.totalPrice)}</p>
                  </div>
                  <button
                    disabled={isQuoteActionPending}
                    className={`flex items-center justify-center gap-2 px-6 py-3 text-xs font-bold rounded-2xl ${theme.btnAccent} shrink-0 transition-transform active:scale-95 shadow-sm`}
                    onClick={() => handleAcceptQuote(resp.id)}
                    type="button"
                  >
                    <CheckCheck className="h-4 w-4" />
                    {isQuoteActionPending ? "수락 처리 중..." : "이 제안 수락하기"}
                  </button>
                </div>
              </div>
            );
          })()}

          {currentStatus === "최종 확정 대기" && (() => {
            const resp = activeRequest?.responses?.[0];
            const price = resp?.totalPrice ?? activeReservation?.quotedAmount ?? 0;
            return (
              <div className="space-y-4 py-2">
                <div className="flex gap-3 p-4.5 rounded-2xl border border-purple-100 bg-purple-50/10 text-xs text-purple-900 leading-relaxed">
                  <Clock className="h-4 w-4 shrink-0 text-purple-600 mt-0.5 animate-none" />
                  <div className="space-y-1">
                    <p className="font-bold">고객님께서 제안서를 최종 승인하셨습니다.</p>
                    <p className="text-purple-700/80">현재 파트너가 식장 및 서비스 공급팀의 일정을 최종 조율하고 예약 확정을 처리하는 단계입니다. 확정이 완료되는 즉시 문자와 메일로 확정 통지서를 전송해 드립니다.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 p-4.5 bg-slate-50/30 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">승인된 상품명</span>
                    <span className="font-semibold text-[#2c3455]">{resp?.modules?.basePackage?.name || "올인원 맞춤 패키지"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">승인된 예산액</span>
                    <span className="font-bold text-purple-700">{formatCurrency(price)}</span>
                  </div>
                  {activeReservation?.vendorConfirmationDueAt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">확정 예정 일시</span>
                      <span className="font-semibold text-purple-700">{formatDate(activeReservation.vendorConfirmationDueAt)} 이내</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {currentStatus === "예약 완료" && (() => {
            const confirmedResItem = confirmedRes.find(r => r.vendor?.isActive === true);
            const price = confirmedResItem?.confirmedAmount ?? confirmedResItem?.quotedAmount ?? 0;
            return (
              <div className="space-y-4 py-2">
                <div className="flex gap-3 p-4.5 rounded-2xl border border-emerald-100 bg-emerald-50/10 text-xs text-emerald-900 leading-relaxed">
                  <CheckCheck className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">최종 예약 확정이 완료되었습니다!</p>
                    <p className="text-emerald-700/80">고객님의 소중한 그 날을 위해 최고의 전문가가 준비에 돌입했습니다. 상세 조율이 필요할 시 마이페이지의 예약 통지함 또는 전화를 통해 개별 연락을 드리겠습니다.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 p-4.5 bg-slate-50/30 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">예약 확정 상품</span>
                    <span className="font-semibold text-[#2c3455]">{confirmedResItem?.serviceName || "올인원 맞춤 패키지"}</span>
                  </div>
                  {confirmedResItem?.serviceDate && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">행사 일자</span>
                      <span className="font-semibold text-[#2c3455]">{formatDate(confirmedResItem.serviceDate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">최종 계약 금액</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(price)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
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
              {isWedding ? (
                <Sparkles className="h-5 w-5" />
              ) : (
                <ClipboardList className="h-5 w-5" />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">확정된 예약 내역이 없습니다.</p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground max-w-xs">견적을 승인하신 후 파트너사의 승인이 완료되면 최종 확정서가 자동 발행됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
