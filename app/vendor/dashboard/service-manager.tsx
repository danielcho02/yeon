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
              표준 항목
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
            {existing ? "가격 저장" : "표준 항목 추가"}
          </button>
        </div>
      </div>
    </form>
  );
}

function formatServicePrice(item: ServiceRow) {
  return `${item.basePrice.toLocaleString()}원${item.pricingType === "PER_GUEST" ? "/인" : ""}`;
}

function getServiceModuleLabel(item: ServiceRow) {
  return getQuoteServiceModuleLabel({
    eventType: item.eventType as MvpQuoteEventType,
    serviceCategory: item.module
  });
}

// ── Add custom item form ──────────────────────────────────────────────────

function AddCustomItemForm({
  eventType,
  modules,
}: {
  eventType: string;
  modules: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-muted-foreground/30 bg-transparent px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
      >
        + 새 항목 입력
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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/55">
        새 업체 전용 항목
      </p>
      <div className="space-y-3">
        <select
          name="module"
          required
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {modules.map((module) => (
            <option key={module} value={module}>
              {getQuoteServiceModuleLabel({ eventType: eventType as MvpQuoteEventType, serviceCategory: module })}
            </option>
          ))}
        </select>
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

// ── Service model sections ────────────────────────────────────────────────

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
  emptyText,
  secondary = false
}: {
  title: string;
  description: string;
  services: ServiceRow[];
  emptyText: string;
  secondary?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${secondary ? "border-border/40 bg-muted/20" : "border-border/50 bg-white/70"}`}>
      <SectionHeading title={title} description={description} />
      {services.length > 0 ? (
        <div className="grid gap-2">
          {services.map((service) => (
            <ServiceSummaryRow key={service.id} item={service} secondary={secondary} />
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

function ServiceSummaryRow({
  item,
  secondary = false
}: {
  item: ServiceRow;
  secondary?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        secondary ? "border-border/40 bg-white/70 opacity-80" : "border-border/60 bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <span className="rounded-full border border-border/60 bg-white px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
            {item.catalogKey === null ? "업체 전용" : "표준 항목"}
          </span>
          <span className="rounded-full border border-border/60 bg-white px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
            {getServiceModuleLabel(item)}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
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
          <p className="mt-1 text-xs leading-5 text-muted-foreground/70">{item.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-primary">{formatServicePrice(item)}</span>
        <form action={toggleVendorService.bind(null, item.id, !item.isActive)}>
          <button
            type="submit"
            className="rounded-xl border border-border/60 bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/30"
          >
            {item.isActive ? "비활성화" : "활성화"}
          </button>
        </form>
        {item.catalogKey === null && (
          <form action={deleteCustomItem.bind(null, item.id)}>
            <button
              type="submit"
              className="rounded-xl border border-rose-200 bg-white p-1.5 text-rose-500 transition-all hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function StandardCatalogSection({
  eventType,
  modules,
  existingServices
}: {
  eventType: MvpQuoteEventType;
  modules: string[];
  existingServices: ServiceRow[];
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/10 p-5">
      <SectionHeading
        title="표준 항목 불러오기"
        description="yeON 표준 카탈로그 항목입니다. 가격을 등록하면 활성 표준 옵션으로 추가되고, 이미 등록된 항목은 가격을 수정할 수 있습니다."
      />
      <div className="space-y-5">
        {modules.map((module) => {
          const catalogItems = getCatalogItems(eventType, module);
          if (catalogItems.length === 0) return null;
          return (
            <div key={module} className="space-y-2">
              <p className="text-xs font-bold text-foreground">
                {getQuoteServiceModuleLabel({ eventType, serviceCategory: module })}
              </p>
              {catalogItems.map((item) => {
                const existing = existingServices.find(
                  (service) => service.catalogKey === item.key && service.eventType === eventType
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
          );
        })}
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
  const tabServices = existingServices.filter((service) => service.eventType === activeTab);
  const baseIncludedServices = tabServices.filter((service) => service.isActive && service.isBaseIncluded);
  const optionalStandardServices = tabServices.filter(
    (service) => service.isActive && !service.isBaseIncluded && service.catalogKey !== null
  );
  const vendorSpecificServices = tabServices.filter(
    (service) => service.isActive && !service.isBaseIncluded && service.catalogKey === null
  );
  const inactiveServices = tabServices.filter((service) => !service.isActive);

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
          <section className="grid gap-4 xl:grid-cols-2">
            <ModuleSummaryList
              title="기본 패키지 포함 항목"
              description="활성 상태의 기본 포함 항목입니다. 플래너에게 업체 기본 패키지로 보이는 단일 묶음에 포함됩니다."
              services={baseIncludedServices}
              emptyText="현재 기본 패키지에 포함되는 활성 항목이 없습니다."
            />
            <ModuleSummaryList
              title="추가 선택 옵션"
              description="활성 상태의 표준 항목 중 기본 패키지 외에 플래너가 추가로 선택할 수 있는 옵션입니다."
              services={optionalStandardServices}
              emptyText="현재 추가 선택 옵션으로 표시되는 활성 표준 항목이 없습니다."
            />
            <ModuleSummaryList
              title="업체 전용 항목"
              description="표준 카탈로그에 없는 이 업체만의 특화 옵션입니다. 기본 포함으로 등록한 업체 전용 항목은 위 기본 패키지 포함 항목에 표시됩니다."
              services={vendorSpecificServices}
              emptyText="현재 활성 업체 전용 옵션이 없습니다."
            />
            <ModuleSummaryList
              title="비활성 항목"
              description="플래너 화면에 노출되지 않는 항목입니다. 다시 활성화하면 현재 모델의 기본 포함 또는 선택 옵션 규칙에 따라 표시됩니다."
              services={inactiveServices}
              emptyText="비활성화된 항목이 없습니다."
              secondary
            />
          </section>

          <section className="rounded-2xl border border-border/60 bg-white/80 p-5">
            <div className="mb-3">
              <p className="text-sm font-bold text-foreground">업체 전용 항목 추가</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                표준 카탈로그에 없는 특화 옵션을 한 곳에서 추가합니다. 기본 패키지 포함을 선택하면 현재 단일 업체 기본 패키지에 들어갑니다.
              </p>
            </div>
            <AddCustomItemForm eventType={activeTab} modules={tabModules} />
          </section>

          <StandardCatalogSection
            eventType={activeTab}
            modules={tabModules}
            existingServices={existingServices}
          />
        </div>
      )}
    </div>
  );
}
