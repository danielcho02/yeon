"use client";

import { useState } from "react";

import {
  getEventTypeLabel,
  mvpQuoteEventTypes,
  quoteServiceModules,
  type MvpQuoteEventType
} from "@/lib/step3.shared";

import { updateVendorProfile } from "../actions";

type Props = {
  defaultCompanyName: string;
  defaultBio: string;
  defaultLocation: string;
  initialEventTypes: MvpQuoteEventType[];
  initialServiceModules: string[];
};

export function ProfileEditForm({
  defaultCompanyName,
  defaultBio,
  defaultLocation,
  initialEventTypes,
  initialServiceModules
}: Props) {
  const [selectedTypes, setSelectedTypes] = useState<MvpQuoteEventType[]>(initialEventTypes);

  function toggleType(type: MvpQuoteEventType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  const visibleModules = mvpQuoteEventTypes.flatMap((et) =>
    selectedTypes.includes(et) ? quoteServiceModules[et].map((m) => ({ ...m, eventType: et })) : []
  );

  return (
    <form
      action={updateVendorProfile}
      className="rounded-[1.5rem] border border-border/60 bg-white/90 p-5 shadow-sm lg:max-w-sm"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">업체명</label>
          <input
            name="companyName"
            type="text"
            defaultValue={defaultCompanyName}
            className="w-full rounded-2xl border border-input bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">소개</label>
          <textarea
            name="bio"
            rows={4}
            defaultValue={defaultBio}
            className="w-full resize-none rounded-2xl border border-input bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">활동 지역</label>
          <input
            name="location"
            type="text"
            defaultValue={defaultLocation}
            placeholder="예: 서울 강남구"
            className="w-full rounded-2xl border border-input bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 행사 유형 */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">지원 행사 유형</label>
          <div className="grid grid-cols-2 gap-2">
            {mvpQuoteEventTypes.map((et) => {
              const checked = selectedTypes.includes(et);
              return (
                <label
                  key={et}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 transition-all duration-200 ${
                    checked
                      ? et === "WEDDING"
                        ? "border-rose-300 bg-rose-50/70 ring-1 ring-rose-200"
                        : "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200"
                      : "border-border/60 bg-white hover:border-border"
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
                  <span className="text-base">{et === "WEDDING" ? "💍" : "🕯️"}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {getEventTypeLabel(et)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 서비스 모듈 — 선택된 행사 유형에 해당하는 것만 표시 */}
        {visibleModules.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-foreground">지원 서비스 모듈</label>
            <div className="grid gap-2">
              {visibleModules.map(({ value, label, eventType }) => (
                <label
                  key={`${eventType}-${value}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-border/60 bg-white px-3.5 py-2.5 text-sm text-foreground hover:border-border hover:bg-white/90"
                >
                  <input
                    type="checkbox"
                    name="supportedServiceModules"
                    value={value}
                    defaultChecked={initialServiceModules.includes(value)}
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
      </div>

      <button
        type="submit"
        className="mt-5 w-full rounded-2xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        저장
      </button>
    </form>
  );
}
