"use client";

import { useState } from "react";

import {
  getEventTypeLabel,
  mvpQuoteEventTypes,
  quoteServiceModules,
  type MvpQuoteEventType
} from "@/lib/step3.shared";

import { completeVendorOnboarding } from "../actions";

export function VendorOnboardingForm() {
  const [selectedTypes, setSelectedTypes] = useState<MvpQuoteEventType[]>([]);

  function toggleType(type: MvpQuoteEventType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  const visibleModules = mvpQuoteEventTypes.flatMap((et) =>
    selectedTypes.includes(et) ? quoteServiceModules[et].map((m) => ({ ...m, eventType: et })) : []
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-[2rem] border border-white/70 bg-white/92 p-8 shadow-sm">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground/55">
          첫 설정
        </p>
        <h1 className="mb-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
          업체 유형을 먼저 설정해 주세요
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          지원하는 행사 유형과 서비스를 선택하면 관련 견적 요청이 연결됩니다.
        </p>

        <form action={completeVendorOnboarding} className="space-y-7">
          {/* 행사 유형 */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
              행사 유형
            </p>
            <div className="grid grid-cols-2 gap-3">
              {mvpQuoteEventTypes.map((et) => {
                const checked = selectedTypes.includes(et);
                return (
                  <label
                    key={et}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
                      checked
                        ? et === "WEDDING"
                          ? "border-rose-300 bg-rose-50/70 ring-1 ring-rose-200"
                          : "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200"
                        : "border-border/60 bg-white/80 hover:border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="supportedEventTypes"
                      value={et}
                      checked={checked}
                      onChange={() => toggleType(et)}
                      className="sr-only"
                    />
                    <span className="text-lg">{et === "WEDDING" ? "💍" : "🕯️"}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {getEventTypeLabel(et)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 서비스 모듈 — 행사 유형 선택 후 표시 */}
          {visibleModules.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
                제공 서비스
              </p>
              <div className="grid gap-2">
                {visibleModules.map(({ value, label, eventType }) => (
                  <label
                    key={`${eventType}-${value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-white/80 px-4 py-3 text-sm text-foreground hover:border-border hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      name="supportedServiceModules"
                      value={value}
                      defaultChecked
                    />
                    <span className="text-xs font-medium text-muted-foreground/60">
                      {getEventTypeLabel(eventType)}
                    </span>
                    <span className="font-semibold">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={selectedTypes.length === 0}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            설정 완료 →
          </button>
        </form>
      </div>
    </main>
  );
}
