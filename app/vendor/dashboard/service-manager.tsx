"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  getCatalogItems,
  getEventTypeLabel,
  getQuoteServiceModuleEventType,
  getQuoteServiceModuleLabel,
  type CatalogItem,
  type MvpQuoteEventType
} from "@/lib/step3.shared";
import {
  addCustomItem,
  deleteCustomItem,
  setStandardItemPrice,
  toggleVendorService
} from "../actions";

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

// ── Standard catalog item row ─────────────────────────────────────────────

function StandardItemRow({
  item,
  eventType,
  module,
  existing,
}: {
  item: CatalogItem;
  eventType: string;
  module: string;
  existing?: ServiceRow;
}) {
  return (
    <form action={setStandardItemPrice} className="flex items-center gap-3">
      <input type="hidden" name="catalogKey" value={item.key} />
      <input type="hidden" name="eventType" value={eventType} />
      <input type="hidden" name="module" value={module} />

      <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-border/50 bg-white/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              표준 모듈
            </span>
            {existing && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                existing.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {existing.isActive ? "활성" : "비활성"}
              </span>
            )}
            {existing?.isBaseIncluded && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                기본 포함
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
            {item.pricingType === "PER_GUEST" ? "인당 단가" : "고정가"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              name="basePrice"
              type="number"
              required
              min={1}
              defaultValue={existing?.basePrice ?? ""}
              placeholder="가격 입력"
              className="w-28 rounded-xl border border-input bg-white px-2.5 py-1.5 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">원{item.pricingType === "PER_GUEST" ? "/인" : ""}</span>
          </div>
          <button
            type="submit"
            className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10"
          >
            {existing ? "수정" : "등록"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Custom item row ───────────────────────────────────────────────────────

function CustomItemRow({ item }: { item: ServiceRow }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          item.isActive
            ? "border-dashed border-primary/30 bg-primary/3"
            : "border-border/40 bg-muted/30 opacity-60"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <span className="rounded-full border border-border/60 bg-white px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
              업체 전용
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              item.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted text-muted-foreground"
            }`}>
              {item.isActive ? "활성" : "비활성"}
            </span>
            {item.isBaseIncluded && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                기본 포함
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-0.5 text-xs text-muted-foreground/70">{item.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-primary">
            {item.basePrice.toLocaleString()}원{item.pricingType === "PER_GUEST" ? "/인" : ""}
          </span>
          <form action={toggleVendorService.bind(null, item.id, !item.isActive)}>
            <button
              type="submit"
              className="rounded-xl border border-border/60 bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30"
            >
              {item.isActive ? "비활성화" : "활성화"}
            </button>
          </form>
          <form action={deleteCustomItem.bind(null, item.id)}>
            <button
              type="submit"
              className="rounded-xl border border-rose-200 bg-white p-1.5 text-rose-500 transition-all hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Add custom item form ──────────────────────────────────────────────────

function AddCustomItemForm({
  eventType,
  module,
}: {
  eventType: string;
  module: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/30 bg-transparent px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
      >
        + 업체 전용 항목 추가
      </button>
    );
  }

  return (
    <form
      action={addCustomItem}
      onSubmit={() => setOpen(false)}
      className="mt-2 rounded-xl border border-primary/20 bg-primary/3 p-4"
    >
      <input type="hidden" name="eventType" value={eventType} />
      <input type="hidden" name="module" value={module} />
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/55">
        업체 전용 항목 추가
      </p>
      <div className="space-y-3">
        <input
          name="name"
          type="text"
          required
          placeholder="항목명 (예: 야외 버진로드 런너 추가)"
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="설명 (선택)"
          className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2">
          <select
            name="pricingType"
            className="rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="FLAT">고정가</option>
            <option value="PER_GUEST">인당 단가</option>
          </select>
          <div className="flex flex-1 items-center gap-1">
            <input
              name="basePrice"
              type="number"
              required
              min={1}
              placeholder="가격"
              className="flex-1 rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">원</span>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border/50 bg-white px-3 py-2 text-xs font-medium text-foreground">
          <input
            name="isBaseIncluded"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
          />
          기본 패키지 포함 항목으로 등록
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground"
        >
          추가
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border/60 bg-white px-3 py-2 text-xs font-medium text-muted-foreground"
        >
          취소
        </button>
      </div>
    </form>
  );
}

// ── Module section ────────────────────────────────────────────────────────

function SectionHeading({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function ModuleSummaryList({
  title,
  description,
  services,
  emptyText
}: {
  title: string;
  description: string;
  services: ServiceRow[];
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-white/70 p-4">
      <SectionHeading title={title} description={description} />
      {services.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <span
              key={service.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-3 py-1 text-[11px] font-semibold text-foreground"
            >
              {service.name}
              <span className="text-muted-foreground">
                {service.basePrice.toLocaleString()}원{service.pricingType === "PER_GUEST" ? "/인" : ""}
              </span>
              {service.catalogKey === null && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  업체 전용
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function ModuleSection({
  eventType,
  module,
  existingServices,
}: {
  eventType: MvpQuoteEventType;
  module: string;
  existingServices: ServiceRow[];
}) {
  const catalogItems = getCatalogItems(eventType, module);
  const customItems = existingServices.filter(
    (s) => s.module === module && s.catalogKey === null && s.eventType === eventType
  );
  const moduleServices = existingServices.filter(
    (s) => s.module === module && s.eventType === eventType
  );
  const baseIncludedItems = moduleServices.filter((s) => s.isActive && s.isBaseIncluded);
  const optionalItems = moduleServices.filter((s) => s.isActive && !s.isBaseIncluded);
  const moduleLabel = getQuoteServiceModuleLabel({
    eventType,
    serviceCategory: module
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-muted/10 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">{moduleLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            표준 모듈은 카탈로그 기반 항목이고, 업체 전용 항목은 이 업체만 제공하는 커스텀 옵션입니다.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
          기본 포함 {baseIncludedItems.length}개 · 선택 추가 {optionalItems.length}개
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ModuleSummaryList
          title="기본 패키지 포함"
          description="활성 상태의 기본 포함 항목은 플래너 화면의 단일 업체 기본 패키지에 묶여 표시됩니다."
          services={baseIncludedItems}
          emptyText="현재 이 모듈에서 기본 패키지에 포함되는 항목이 없습니다."
        />
        <ModuleSummaryList
          title="선택 추가 옵션"
          description="활성 상태이지만 기본 포함이 아닌 항목은 플래너가 필요할 때 추가 선택하는 옵션입니다."
          services={optionalItems}
          emptyText="현재 이 모듈에서 선택 추가 옵션으로 표시되는 항목이 없습니다."
        />
      </div>

      <div className="mt-5">
        <SectionHeading
          title="표준 모듈"
          description="yeON 표준 카탈로그 항목입니다. 가격을 등록하거나 수정하면 활성 표준 서비스로 노출됩니다."
        />
        <div className="space-y-2">
          {catalogItems.map((item) => {
            const existing = existingServices.find(
              (s) => s.catalogKey === item.key && s.eventType === eventType
            );
            return (
              <StandardItemRow
                key={item.key}
                item={item}
                eventType={eventType}
                module={module}
                existing={existing}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <SectionHeading
          title="업체 전용 항목"
          description="표준 카탈로그에 없는 커스텀 항목입니다. 기본 패키지 포함 여부는 생성 시 선택한 값으로 표시됩니다."
        />
        <div className="space-y-2">
          {customItems.length > 0 ? (
            customItems.map((item) => <CustomItemRow key={item.id} item={item} />)
          ) : (
            <p className="rounded-lg border border-dashed border-border/50 bg-white/60 px-3 py-2 text-xs text-muted-foreground">
              등록된 업체 전용 항목이 없습니다.
            </p>
          )}
        </div>
        <AddCustomItemForm eventType={eventType} module={module} />
      </div>
    </section>
  );
}

// ── Main ServiceManager ───────────────────────────────────────────────────

export function ServiceManager({
  supportedEventTypes,
  supportedModules,
  existingServices,
}: {
  supportedEventTypes: MvpQuoteEventType[];
  supportedModules: string[];
  existingServices: ServiceRow[];
}) {
  const firstTab = supportedEventTypes[0] ?? "WEDDING";
  const [activeTab, setActiveTab] = useState<MvpQuoteEventType>(firstTab);

  const tabModules = supportedModules.filter(
    (m) => getQuoteServiceModuleEventType(m) === activeTab
  );

  // If only one event type, skip tab render
  return (
    <div>
      <div className="mb-6 rounded-2xl border border-border/60 bg-white/80 p-5">
        <p className="text-sm font-bold text-foreground">서비스 구성 방식</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          현재 모델은 여러 패키지를 만들지 않고, 활성화된 기본 포함 항목을 하나의 업체 기본 패키지로 묶어 플래너에게 보여줍니다.
          기본 포함이 아닌 활성 항목은 선택 추가 옵션으로 표시되고, catalogKey가 없는 항목은 업체 전용 항목으로 구분됩니다.
        </p>
      </div>

      {supportedEventTypes.length > 1 && (
        <div className="mb-6 flex gap-2">
          {supportedEventTypes.map((et) => (
            <button
              key={et}
              type="button"
              onClick={() => setActiveTab(et)}
              className={`rounded-2xl border px-5 py-2 text-sm font-semibold transition-all ${
                activeTab === et
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-white text-foreground hover:bg-muted/20"
              }`}
            >
              {getEventTypeLabel(et)}
            </button>
          ))}
        </div>
      )}

      {supportedEventTypes.length === 1 && (
        <div className="mb-4">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {getEventTypeLabel(activeTab)}
          </span>
        </div>
      )}

      {tabModules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          지원 서비스 모듈이 설정되지 않았습니다. 프로필 편집에서 설정해 주세요.
        </p>
      ) : (
        <div className="space-y-8">
          {tabModules.map((moduleValue) => (
            <ModuleSection
              key={moduleValue}
              eventType={activeTab}
              module={moduleValue}
              existingServices={existingServices}
            />
          ))}
        </div>
      )}
    </div>
  );
}
