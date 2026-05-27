"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";

import type { VendorServiceOption } from "@/components/features/planning/workspace-types";
import { getQuoteServiceModuleLabel } from "@/lib/step3.shared";
import { createQuoteRequest } from "../actions";

type Plan = {
  id: string;
  title: string;
  type: string;
  budget: number | null;
  guestTarget?: number | null;
};

function calcTotal(
  checkedIds: Set<string>,
  services: VendorServiceOption[],
  guestCount: number
): number {
  let total = 0;
  for (const svc of services) {
    if (!checkedIds.has(svc.id)) continue;
    total +=
      svc.pricingType === "PER_GUEST"
        ? svc.basePrice * Math.max(1, guestCount)
        : svc.basePrice;
  }
  return total;
}

function groupByModule(services: VendorServiceOption[]) {
  const map: Record<string, VendorServiceOption[]> = {};
  for (const svc of services) {
    (map[svc.module] ??= []).push(svc);
  }
  return map;
}

export function QuoteRequestModal({
  vendorId,
  vendorName,
  fallbackEventType,
  plans,
  services = [],
}: {
  vendorId: string;
  vendorName: string;
  fallbackEventType?: string;
  plans: Plan[];
  supportedServiceModules?: string[];
  services?: VendorServiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [guestCount, setGuestCount] = useState(1);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const filteredServices = selectedPlan
    ? services.filter((s) => s.eventType === selectedPlan.type && s.isActive)
    : [];
  const groupedServices = groupByModule(filteredServices);
  const hasPerGuest = filteredServices.some(
    (s) => checkedIds.has(s.id) && s.pricingType === "PER_GUEST"
  );
  const total = calcTotal(checkedIds, filteredServices, guestCount);

  const createPlanHref = `/plans/new${fallbackEventType ? `?type=${fallbackEventType}` : ""}`;

  function handlePlanChange(planId: string) {
    const plan = plans.find((p) => p.id === planId) ?? null;
    setSelectedPlanId(planId);
    setCheckedIds(new Set());
    setGuestCount(plan?.guestTarget ?? 1);
  }

  function toggleItem(serviceId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checkedIds.size === 0) {
      setError("최소 1개 이상의 항목을 선택해 주세요.");
      return;
    }
    const formData = new FormData(e.currentTarget);

    // attach checked service IDs
    for (const id of checkedIds) {
      formData.append("selectedItemIds", id);
    }
    formData.set("quotedAmount", String(total));
    formData.set("guestCount", String(guestCount));

    startTransition(async () => {
      const result = await createQuoteRequest(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setCheckedIds(new Set());
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSuccess(false); setError(null); }}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 sm:w-auto"
      >
        견적 요청하기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-border/60 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-border/40 px-6 py-5">
              <div>
                <h2 className="font-[var(--font-display)] text-xl font-bold text-foreground">
                  견적 요청
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{vendorName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {success ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
                  <p className="mb-1 font-[var(--font-display)] text-base font-bold text-foreground">
                    견적 요청이 접수되었습니다
                  </p>
                  <p className="text-sm text-muted-foreground">업체에서 검토 후 연락드립니다.</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                  <input type="hidden" name="vendorId" value={vendorId} />

                  {/* Plan selection */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">
                      연결할 플랜 <span className="text-rose-500">*</span>
                    </label>
                    {plans.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        먼저{" "}
                        <a href={createPlanHref} className="font-semibold text-primary hover:underline">
                          플랜을 만들어주세요
                        </a>
                      </p>
                    ) : (
                      <select
                        name="eventPlanId"
                        required
                        value={selectedPlanId}
                        onChange={(e) => handlePlanChange(e.target.value)}
                        className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">플랜 선택</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Service checklist */}
                  {selectedPlan && (
                    <div>
                      <label className="mb-3 block text-sm font-semibold text-foreground">
                        원하는 항목 선택 <span className="text-rose-500">*</span>
                      </label>

                      {filteredServices.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                          이 행사 유형에 대해 등록된 서비스 항목이 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(groupedServices).map(([moduleValue, svcs]) => (
                            <div key={moduleValue}>
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">
                                {getQuoteServiceModuleLabel({
                                  eventType: selectedPlan.type,
                                  serviceCategory: moduleValue
                                })}
                              </p>
                              <div className="space-y-1.5">
                                {svcs.map((svc) => {
                                  const checked = checkedIds.has(svc.id);
                                  const isPerGuest = svc.pricingType === "PER_GUEST";
                                  const subtotal = isPerGuest
                                    ? svc.basePrice * Math.max(1, guestCount)
                                    : svc.basePrice;
                                  return (
                                    <label
                                      key={svc.id}
                                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                                        checked
                                          ? "border-primary/40 bg-primary/5"
                                          : "border-border/40 bg-white hover:border-primary/20 hover:bg-primary/3"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 shrink-0 rounded border-input text-primary accent-primary"
                                        checked={checked}
                                        onChange={() => toggleItem(svc.id)}
                                      />
                                      <span className="min-w-0 flex-1 text-sm text-foreground">
                                        {svc.name}
                                        {svc.catalogKey === null && (
                                          <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground/60">커스텀</span>
                                        )}
                                      </span>
                                      <span className="shrink-0 text-sm font-semibold text-primary">
                                        {isPerGuest ? (
                                          checked ? (
                                            <span className="text-right">
                                              <span className="text-xs font-normal text-muted-foreground">
                                                {svc.basePrice.toLocaleString()}원/인 × {guestCount}인 ={" "}
                                              </span>
                                              {subtotal.toLocaleString()}원
                                            </span>
                                          ) : (
                                            <span>
                                              {svc.basePrice.toLocaleString()}
                                              <span className="text-xs font-normal text-muted-foreground">원/인</span>
                                            </span>
                                          )
                                        ) : (
                                          `${svc.basePrice.toLocaleString()}원`
                                        )}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Guest count input (shown when any PER_GUEST item is checked) */}
                      {hasPerGuest && (
                        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-2.5">
                          <span className="text-xs font-semibold text-amber-700">인원 수</span>
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={guestCount}
                            onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
                            className="w-20 rounded-xl border border-amber-200 bg-white px-2.5 py-1 text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <span className="text-xs text-amber-700">명</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desired date */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">희망 날짜</label>
                    <input
                      name="serviceDate"
                      type="date"
                      className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-foreground">요청 메시지</label>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="원하시는 내용이나 요청 사항을 자유롭게 적어주세요"
                      className="w-full resize-none rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {error && (
                    <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                      {error}
                    </p>
                  )}

                  {/* Footer: total + submit */}
                  <div className="border-t border-border/40 pt-4">
                    {checkedIds.size > 0 && (
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-muted-foreground">
                          선택 합계 ({checkedIds.size}개 항목)
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {total.toLocaleString()}원
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="flex-1 rounded-2xl border border-border bg-white py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isPending ||
                          plans.length === 0 ||
                          !selectedPlan ||
                          checkedIds.size === 0
                        }
                        className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                      >
                        {isPending ? "전송 중..." : "요청 보내기"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
