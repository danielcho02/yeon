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
  createVendorPackage,
  deleteCustomItem,
  setStandardItemPrice,
  toggleVendorPackage,
  toggleVendorService,
  updateVendorPackage
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

type ManagerView = "current" | "packages" | "catalog" | "custom";

const managerViews: Array<{
  key: ManagerView;
  label: string;
  description: string;
}> = [
  { key: "current", label: "현재 구성", description: "플래너에게 보이는 활성 서비스" },
  { key: "packages", label: "패키지 관리", description: "플래너가 선택할 실제 패키지" },
  { key: "catalog", label: "표준 항목 불러오기", description: "표준 카탈로그 항목 등록" },
  { key: "custom", label: "업체 전용 항목", description: "특화 옵션 추가 및 관리" }
];

const actionButtonClass =
  "inline-flex h-8 w-20 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold transition-colors";

const priceInputClass =
  "h-9 w-28 rounded-xl border border-input bg-white px-2.5 text-right text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function formatServicePrice(item: ServiceRow) {
  return `${item.basePrice.toLocaleString()}원${item.pricingType === "PER_GUEST" ? "/인" : ""}`;
}

function getPricingTypeLabel(pricingType: CatalogItem["pricingType"] | ServiceRow["pricingType"]) {
  return pricingType === "PER_GUEST" ? "인당" : "고정가";
}

function getServiceModuleLabel(item: ServiceRow) {
  return getQuoteServiceModuleLabel({
    eventType: item.eventType as MvpQuoteEventType,
    serviceCategory: item.module
  });
}

function getModuleLabel(eventType: MvpQuoteEventType, module: string) {
  return getQuoteServiceModuleLabel({ eventType, serviceCategory: module });
}

function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "muted" | "warning";
}) {
  const toneClass = {
    neutral: "border-border/60 bg-white text-muted-foreground",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
    muted: "border-border/50 bg-muted text-muted-foreground",
    warning: "border-amber-100 bg-amber-50 text-amber-700"
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function SectionHeading({
  title,
  description,
  count
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55">
          {title}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {typeof count === "number" && (
        <span className="rounded-full border border-border/60 bg-white px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}개
        </span>
      )}
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
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
      className={`grid gap-3 rounded-xl border px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${
        secondary ? "border-border/40 bg-muted/20" : "border-border/60 bg-white"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="min-w-0 text-sm font-semibold leading-5 text-foreground">{item.name}</p>
          <Badge>{item.catalogKey === null ? "업체 전용" : "표준 항목"}</Badge>
          <Badge>{getServiceModuleLabel(item)}</Badge>
          <Badge tone={item.isActive ? "success" : "muted"}>{item.isActive ? "활성" : "비활성"}</Badge>
          {item.isBaseIncluded && <Badge tone="warning">기본 포함</Badge>}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground/75">{item.description}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <span className="min-w-24 text-sm font-bold tabular-nums text-primary md:text-right">
          {formatServicePrice(item)}
        </span>
        <form action={toggleVendorService.bind(null, item.id, !item.isActive)}>
          <button
            type="submit"
            className={`${actionButtonClass} border-border/60 bg-white text-muted-foreground hover:bg-muted/30`}
          >
            {item.isActive ? "끄기" : "활성화"}
          </button>
        </form>
        {item.catalogKey === null && (
          <form action={deleteCustomItem.bind(null, item.id)}>
            <button
              type="submit"
              aria-label={`${item.name} 삭제`}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ServiceGroup({
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
    <section className={`rounded-2xl border p-4 ${secondary ? "border-border/40 bg-muted/10" : "border-border/60 bg-white/80"}`}>
      <SectionHeading title={title} description={description} count={services.length} />
      {services.length > 0 ? (
        <div className="grid gap-2">
          {services.map((service) => (
            <ServiceSummaryRow key={service.id} item={service} secondary={secondary} />
          ))}
        </div>
      ) : (
        <EmptyPanel>{emptyText}</EmptyPanel>
      )}
    </section>
  );
}

function CountChip({
  label,
  count
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white px-3.5 py-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums text-foreground">{count}</p>
    </div>
  );
}

function CurrentConfigurationPanel({
  baseIncludedServices,
  optionalStandardServices,
  vendorSpecificServices,
  inactiveServices
}: {
  baseIncludedServices: ServiceRow[];
  optionalStandardServices: ServiceRow[];
  vendorSpecificServices: ServiceRow[];
  inactiveServices: ServiceRow[];
}) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CountChip label="기본 포함" count={baseIncludedServices.length} />
        <CountChip label="선택 옵션" count={optionalStandardServices.length} />
        <CountChip label="업체 전용" count={vendorSpecificServices.length} />
        <CountChip label="비활성" count={inactiveServices.length} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ServiceGroup
          title="기본 패키지 포함 항목"
          description="플래너에게 업체 기본 패키지로 보이는 단일 묶음입니다."
          services={baseIncludedServices}
          emptyText="현재 기본 패키지에 포함되는 활성 항목이 없습니다."
        />
        <ServiceGroup
          title="선택 추가 옵션"
          description="기본 패키지 외에 플래너가 추가로 선택할 수 있는 표준 옵션입니다."
          services={optionalStandardServices}
          emptyText="현재 추가 선택 옵션으로 표시되는 활성 표준 항목이 없습니다."
        />
        <ServiceGroup
          title="업체 전용 항목"
          description="표준 카탈로그에 없는 이 업체만의 활성 특화 옵션입니다."
          services={vendorSpecificServices}
          emptyText="현재 활성 업체 전용 옵션이 없습니다."
        />
        <details className="rounded-2xl border border-border/40 bg-muted/10 p-4">
          <summary className="cursor-pointer list-none">
            <SectionHeading
              title="비활성 항목"
              description="플래너 화면에 노출되지 않으며, 필요할 때 다시 활성화할 수 있습니다."
              count={inactiveServices.length}
            />
          </summary>
          {inactiveServices.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {inactiveServices.map((service) => (
                <ServiceSummaryRow key={service.id} item={service} secondary />
              ))}
            </div>
          ) : (
            <EmptyPanel>비활성화된 항목이 없습니다.</EmptyPanel>
          )}
        </details>
      </div>
    </div>
  );
}

function StandardItemRow({
  item,
  eventType,
  module,
  existing
}: {
  item: CatalogItem;
  eventType: string;
  module: string;
  existing?: ServiceRow;
}) {
  return (
    <form action={setStandardItemPrice}>
      <input type="hidden" name="catalogKey" value={item.key} />
      <input type="hidden" name="eventType" value={eventType} />
      <input type="hidden" name="module" value={module} />

      <div className="grid gap-3 rounded-xl border border-border/50 bg-white px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <Badge>표준 항목</Badge>
            <Badge>{getPricingTypeLabel(item.pricingType)}</Badge>
            {existing ? (
              <Badge tone={existing.isActive ? "success" : "muted"}>{existing.isActive ? "등록됨" : "비활성"}</Badge>
            ) : (
              <Badge tone="muted">미등록</Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {existing ? "가격을 저장하면 활성 표준 옵션으로 갱신됩니다." : "가격을 입력하면 선택 추가 옵션으로 등록됩니다."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <input
            name="basePrice"
            type="number"
            required
            min={1}
            defaultValue={existing?.basePrice ?? ""}
            placeholder="가격"
            className={priceInputClass}
          />
          <span className="inline-flex h-9 w-12 shrink-0 items-center text-xs text-muted-foreground">
            원{item.pricingType === "PER_GUEST" ? "/인" : ""}
          </span>
          <button
            type="submit"
            className={`${actionButtonClass} border-primary/30 bg-primary/5 text-primary hover:bg-primary/10`}
          >
            {existing ? "저장" : "추가"}
          </button>
        </div>
      </div>
    </form>
  );
}

function StandardImportPanel({
  eventType,
  modules,
  existingServices
}: {
  eventType: MvpQuoteEventType;
  modules: string[];
  existingServices: ServiceRow[];
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-white/80 p-5">
      <SectionHeading
        title="표준 항목 불러오기"
        description="필요한 표준 카탈로그 항목만 가격을 입력해 활성 옵션으로 추가합니다."
      />
      <div className="space-y-3">
        {modules.map((module, index) => {
          const catalogItems = getCatalogItems(eventType, module);
          if (catalogItems.length === 0) return null;
          const registeredCount = catalogItems.filter((item) =>
            existingServices.some((service) => service.catalogKey === item.key && service.eventType === eventType)
          ).length;

          return (
            <details
              key={module}
              open={index === 0}
              className="rounded-2xl border border-border/50 bg-muted/10 p-4"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{getModuleLabel(eventType, module)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    등록 {registeredCount}개 · 전체 {catalogItems.length}개
                  </p>
                </div>
                <span className="rounded-full border border-border/60 bg-white px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                  펼쳐서 관리
                </span>
              </summary>
              <div className="mt-4 grid gap-2">
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
            </details>
          );
        })}
      </div>
    </section>
  );
}

function AddCustomItemForm({
  eventType,
  modules
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
        className="inline-flex h-10 items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
      >
        업체 전용 항목 추가
      </button>
    );
  }

  return (
    <form
      action={addCustomItem}
      onSubmit={() => setOpen(false)}
      className="rounded-2xl border border-primary/20 bg-primary/3 p-4"
    >
      <input type="hidden" name="eventType" value={eventType} />
      <SectionHeading
        title="업체 전용 항목 추가"
        description="표준 카탈로그에 없는 특화 옵션을 하나만의 입력 폼에서 추가합니다."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <select
          name="module"
          required
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {modules.map((module) => (
            <option key={module} value={module}>
              {getModuleLabel(eventType as MvpQuoteEventType, module)}
            </option>
          ))}
        </select>
        <input
          name="name"
          type="text"
          required
          placeholder="항목명"
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="설명 (선택)"
          className="resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:col-span-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="pricingType"
            className="h-9 w-28 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="FLAT">고정가</option>
            <option value="PER_GUEST">인당</option>
          </select>
          <input
            name="basePrice"
            type="number"
            required
            min={1}
            placeholder="가격"
            className={priceInputClass}
          />
          <span className="inline-flex h-9 w-12 items-center text-xs text-muted-foreground">원</span>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border/50 bg-white px-3 text-xs font-medium text-foreground">
          <input
            name="isBaseIncluded"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
          />
          기본 패키지 포함 항목으로 등록
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className={`${actionButtonClass} border-primary bg-primary text-primary-foreground hover:bg-primary/90`}
        >
          추가
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${actionButtonClass} border-border/60 bg-white text-muted-foreground hover:bg-muted/30`}
        >
          취소
        </button>
      </div>
    </form>
  );
}

function VendorSpecificPanel({
  customServices,
  eventType,
  modules
}: {
  customServices: ServiceRow[];
  eventType: MvpQuoteEventType;
  modules: string[];
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          title="업체 전용 항목"
          description="표준 카탈로그에 없는 특화 옵션입니다. 추가 진입점은 이 화면 하나만 사용합니다."
          count={customServices.length}
        />
        <AddCustomItemForm eventType={eventType} modules={modules} />
      </div>
      {customServices.length > 0 ? (
        <div className="grid gap-2">
          {customServices.map((service) => (
            <ServiceSummaryRow key={service.id} item={service} secondary={!service.isActive} />
          ))}
        </div>
      ) : (
        <EmptyPanel>등록된 업체 전용 항목이 없습니다.</EmptyPanel>
      )}
    </section>
  );
}

function PackageModuleChecklist({
  services,
  packageItems,
  mode
}: {
  services: ServiceRow[];
  packageItems: PackageRow["items"];
  mode: "included" | "optional";
}) {
  const selected = new Set(
    packageItems
      .filter((item) => item.selectionType === (mode === "included" ? "INCLUDED" : "OPTIONAL"))
      .map((item) => item.vendorServiceModuleId)
  );

  return (
    <div className="grid gap-1.5">
      {services.map((service) => (
        <label
          key={`${mode}-${service.id}`}
          className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-white px-3 py-2 text-xs"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{service.name}</span>
            <span className="text-[10px] text-muted-foreground">{formatServicePrice(service)}</span>
          </span>
          <input
            type="checkbox"
            name={mode === "included" ? "includedModuleIds" : "optionalModuleIds"}
            value={service.id}
            defaultChecked={selected.has(service.id)}
            className="h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
        </label>
      ))}
    </div>
  );
}

function PackageManagementPanel({
  packages,
  services,
  eventType
}: {
  packages: PackageRow[];
  services: ServiceRow[];
  eventType: MvpQuoteEventType;
}) {
  const activeServices = services.filter((service) => service.isActive);

  return (
    <div className="space-y-4">
      <form action={createVendorPackage} className="rounded-2xl border border-primary/20 bg-primary/3 p-4">
        <input type="hidden" name="eventType" value={eventType} />
        <SectionHeading
          title="새 패키지 만들기"
          description="패키지 셸을 만든 뒤 아래 목록에서 포함/선택 항목을 지정합니다."
        />
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_6rem_auto]">
          <input
            name="name"
            required
            placeholder="패키지명"
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            name="basePrice"
            required
            type="number"
            min={1}
            placeholder="기본가"
            className={priceInputClass}
          />
          <input
            name="sortOrder"
            type="number"
            min={0}
            placeholder="순서"
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className={`${actionButtonClass} h-10 border-primary bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            생성
          </button>
          <textarea
            name="description"
            rows={2}
            placeholder="패키지 설명"
            className="resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:col-span-4"
          />
        </div>
      </form>

      {packages.length === 0 ? (
        <EmptyPanel>아직 등록된 패키지가 없습니다. 첫 패키지를 만든 뒤 포함 항목을 저장해 주세요.</EmptyPanel>
      ) : (
        <div className="grid gap-4">
          {packages.map((pkg) => (
            <form key={pkg.id} action={updateVendorPackage} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <input type="hidden" name="packageId" value={pkg.id} />
              <input type="hidden" name="eventType" value={eventType} />
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={pkg.isActive ? "success" : "muted"}>{pkg.isActive ? "활성" : "비활성"}</Badge>
                    <Badge>{pkg.items.filter((item) => item.selectionType === "INCLUDED").length}개 포함</Badge>
                    <Badge>{pkg.items.filter((item) => item.selectionType === "OPTIONAL").length}개 선택</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    활성 패키지만 플래너 Step 3에 노출됩니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className={`${actionButtonClass} border-primary/30 bg-primary/5 text-primary hover:bg-primary/10`}
                  >
                    저장
                  </button>
                  <button
                    formAction={toggleVendorPackage.bind(null, pkg.id, !pkg.isActive)}
                    className={`${actionButtonClass} border-border/60 bg-white text-muted-foreground hover:bg-muted/30`}
                  >
                    {pkg.isActive ? "끄기" : "활성화"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_6rem]">
                <input
                  name="name"
                  required
                  defaultValue={pkg.name}
                  className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  name="basePrice"
                  required
                  type="number"
                  min={1}
                  defaultValue={pkg.basePrice}
                  className={priceInputClass}
                />
                <input
                  name="sortOrder"
                  type="number"
                  min={0}
                  defaultValue={pkg.sortOrder}
                  className="h-10 rounded-xl border border-input bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={pkg.description ?? ""}
                  className="resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:col-span-3"
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-border/40 bg-muted/10 p-3">
                  <SectionHeading
                    title="포함 항목"
                    description="패키지 기본가에 포함되어 플래너에게 체크된 상태로 보입니다."
                    count={pkg.items.filter((item) => item.selectionType === "INCLUDED").length}
                  />
                  <PackageModuleChecklist services={activeServices} packageItems={pkg.items} mode="included" />
                </section>
                <section className="rounded-2xl border border-border/40 bg-muted/10 p-3">
                  <SectionHeading
                    title="선택 추가 항목"
                    description="패키지 선택 후 플래너가 추가로 고를 수 있는 옵션입니다."
                    count={pkg.items.filter((item) => item.selectionType === "OPTIONAL").length}
                  />
                  <PackageModuleChecklist services={activeServices} packageItems={pkg.items} mode="optional" />
                </section>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

export function ServiceManager({
  supportedEventTypes,
  supportedModules,
  existingServices,
  existingPackages = []
}: {
  supportedEventTypes: MvpQuoteEventType[];
  supportedModules: string[];
  existingServices: ServiceRow[];
  existingPackages?: PackageRow[];
}) {
  const firstTab = supportedEventTypes[0] ?? "WEDDING";
  const [activeTab, setActiveTab] = useState<MvpQuoteEventType>(firstTab);
  const [activeView, setActiveView] = useState<ManagerView>("current");

  const tabModules = supportedModules.filter(
    (module) => getQuoteServiceModuleEventType(module) === activeTab
  );
  const tabServices = existingServices.filter((service) => service.eventType === activeTab);
  const tabPackages = existingPackages.filter((pkg) => pkg.eventType === activeTab);
  const baseIncludedServices = tabServices.filter((service) => service.isActive && service.isBaseIncluded);
  const optionalStandardServices = tabServices.filter(
    (service) => service.isActive && !service.isBaseIncluded && service.catalogKey !== null
  );
  const vendorSpecificServices = tabServices.filter(
    (service) => service.isActive && !service.isBaseIncluded && service.catalogKey === null
  );
  const inactiveServices = tabServices.filter((service) => !service.isActive);
  const customServices = tabServices.filter((service) => service.catalogKey === null);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-white/80 p-5">
        <p className="text-sm font-bold text-foreground">서비스 구성 방식</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          현재 모델은 여러 패키지를 만들지 않고, 활성화된 기본 포함 항목을 하나의 업체 기본 패키지로 묶어 플래너에게 보여줍니다.
          기본 포함이 아닌 활성 항목은 선택 추가 옵션으로 표시되고, catalogKey가 없는 항목은 업체 전용 항목으로 구분됩니다.
        </p>
      </div>

      {supportedEventTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {supportedEventTypes.map((eventType) => (
            <button
              key={eventType}
              type="button"
              onClick={() => setActiveTab(eventType)}
              className={`h-10 rounded-2xl border px-5 text-sm font-semibold transition-colors ${
                activeTab === eventType
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-white text-foreground hover:bg-muted/20"
              }`}
            >
              {getEventTypeLabel(eventType)}
            </button>
          ))}
        </div>
      )}

      {supportedEventTypes.length === 1 && (
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {getEventTypeLabel(activeTab)}
        </span>
      )}

      <div className="grid gap-2 rounded-2xl border border-border/60 bg-muted/10 p-1.5 md:grid-cols-4">
        {managerViews.map((view) => {
          const isActive = activeView === view.key;
          return (
            <button
              key={view.key}
              type="button"
              onClick={() => setActiveView(view.key)}
              className={`rounded-xl px-4 py-3 text-left transition-colors ${
                isActive ? "bg-white shadow-sm" : "hover:bg-white/60"
              }`}
            >
              <span className={`block text-xs font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {view.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                {view.description}
              </span>
            </button>
          );
        })}
      </div>

      {tabModules.length === 0 ? (
        <EmptyPanel>지원 서비스 모듈이 설정되지 않았습니다. 프로필 편집에서 설정해 주세요.</EmptyPanel>
      ) : activeView === "current" ? (
        <CurrentConfigurationPanel
          baseIncludedServices={baseIncludedServices}
          optionalStandardServices={optionalStandardServices}
          vendorSpecificServices={vendorSpecificServices}
          inactiveServices={inactiveServices}
        />
      ) : activeView === "packages" ? (
        <PackageManagementPanel
          packages={tabPackages}
          services={tabServices}
          eventType={activeTab}
        />
      ) : activeView === "catalog" ? (
        <StandardImportPanel
          eventType={activeTab}
          modules={tabModules}
          existingServices={existingServices}
        />
      ) : (
        <VendorSpecificPanel
          customServices={customServices}
          eventType={activeTab}
          modules={tabModules}
        />
      )}
    </div>
  );
}
