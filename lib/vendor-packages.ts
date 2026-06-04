import type { Prisma } from "@/generated/prisma/client";
import type {
  VendorPackageData,
  VendorPackageLineItemSource,
  VendorPackagePriceSnapshot,
  VendorPackageSnapshot,
  VendorPackageSnapshotItem
} from "@/types/vendor-package";
import type { VendorServiceModuleData } from "@/types/vendor-module";

import { getCatalogKeyForVendorModule } from "./vendor-service-modules";

type PackageModuleLike = {
  id: string;
  packageId: string;
  vendorServiceModuleId: string;
  selectionType: string;
  quantity: number;
  priceOverride: number | null;
  sortOrder: number;
  vendorServiceModule: {
    id: string;
    vendorId: string;
    name: string;
    category: string;
    price: number;
    pricingType: string;
    description: string | null;
    isBaseIncluded: boolean;
    isActive: boolean;
    sortOrder: number;
  };
};

type PackageLike = {
  id: string;
  vendorId: string;
  eventType: string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
  items: PackageModuleLike[];
};

export const vendorPackageInclude = {
  items: {
    include: { vendorServiceModule: true },
    orderBy: [{ selectionType: "asc" as const }, { sortOrder: "asc" as const }]
  }
} satisfies Prisma.VendorPackageInclude;

function normalizePricingType(pricingType: string): "FLAT" | "PER_GUEST" {
  return pricingType === "PER_GUEST" ? "PER_GUEST" : "FLAT";
}

export function mapVendorPackageModuleData(item: PackageModuleLike) {
  const serviceModule: VendorServiceModuleData = {
    id: item.vendorServiceModule.id,
    vendorId: item.vendorServiceModule.vendorId,
    catalogKey: getCatalogKeyForVendorModule(item.vendorServiceModule),
    name: item.vendorServiceModule.name,
    category: item.vendorServiceModule.category as VendorServiceModuleData["category"],
    price: item.vendorServiceModule.price,
    pricingType: normalizePricingType(item.vendorServiceModule.pricingType),
    description: item.vendorServiceModule.description,
    isBaseIncluded: item.vendorServiceModule.isBaseIncluded,
    isActive: item.vendorServiceModule.isActive,
    sortOrder: item.vendorServiceModule.sortOrder
  };

  return {
    id: item.id,
    packageId: item.packageId,
    vendorServiceModuleId: item.vendorServiceModuleId,
    selectionType: item.selectionType === "OPTIONAL" ? "OPTIONAL" as const : "INCLUDED" as const,
    quantity: item.quantity,
    priceOverride: item.priceOverride,
    sortOrder: item.sortOrder,
    module: serviceModule
  };
}

export function mapVendorPackageData(pkg: PackageLike): VendorPackageData {
  return {
    id: pkg.id,
    vendorId: pkg.vendorId,
    eventType: pkg.eventType,
    name: pkg.name,
    description: pkg.description,
    basePrice: pkg.basePrice,
    isActive: pkg.isActive,
    sortOrder: pkg.sortOrder,
    items: pkg.items.map(mapVendorPackageModuleData)
  };
}

function buildSnapshotItem(input: {
  module: VendorServiceModuleData;
  packageItemId?: string;
  source: VendorPackageLineItemSource;
  quantity: number;
  unitPrice: number;
  guestCount: number;
}): VendorPackageSnapshotItem {
  const quantity =
    input.module.pricingType === "PER_GUEST"
      ? Math.max(1, input.guestCount)
      : Math.max(1, input.quantity);
  const subtotal = input.unitPrice * quantity;

  return {
    id: input.module.id,
    packageItemId: input.packageItemId,
    name: input.module.name,
    category: input.module.category,
    price: input.unitPrice,
    pricingType: input.module.pricingType,
    quantity,
    subtotal,
    description: input.module.description,
    source: input.source
  };
}

export function buildVendorPackageQuoteSnapshots(input: {
  package: VendorPackageData;
  selectedModuleIds: string[];
  allVendorModules: VendorServiceModuleData[];
  guestCount: number;
}): {
  selectedPackageSnapshot: VendorPackageSnapshot;
  priceSnapshot: VendorPackagePriceSnapshot;
} {
  const selectedModuleIds = new Set(input.selectedModuleIds);
  const packageItemByModuleId = new Map(
    input.package.items.map((item) => [item.vendorServiceModuleId, item])
  );
  const packageIncludedItems = input.package.items.filter((item) => item.selectionType === "INCLUDED");
  const packageOptionalItems = input.package.items.filter((item) => item.selectionType === "OPTIONAL");

  const includedItems = packageIncludedItems.map((item) =>
    buildSnapshotItem({
      module: item.module,
      packageItemId: item.id,
      source: "PACKAGE_INCLUDED",
      quantity: item.quantity,
      unitPrice: item.priceOverride ?? item.module.price,
      guestCount: input.guestCount
    })
  );
  const optionalItems = packageOptionalItems.map((item) =>
    buildSnapshotItem({
      module: item.module,
      packageItemId: item.id,
      source: "PACKAGE_OPTIONAL",
      quantity: item.quantity,
      unitPrice: item.priceOverride ?? item.module.price,
      guestCount: input.guestCount
    })
  );
  const selectedAddOnItems = input.allVendorModules
    .filter((module) => selectedModuleIds.has(module.id))
    .filter((module) => !packageIncludedItems.some((item) => item.vendorServiceModuleId === module.id))
    .map((module) => {
      const packageItem = packageItemByModuleId.get(module.id);
      return buildSnapshotItem({
        module,
        packageItemId: packageItem?.id,
        source: packageItem?.selectionType === "OPTIONAL" ? "PACKAGE_OPTIONAL" : "VENDOR_ADDON",
        quantity: packageItem?.quantity ?? 1,
        unitPrice: packageItem?.priceOverride ?? module.price,
        guestCount: input.guestCount
      });
    });
  const includedSubtotalForDisplay = includedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const selectedAddOnsSubtotal = selectedAddOnItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    selectedPackageSnapshot: {
      packageId: input.package.id,
      name: input.package.name,
      description: input.package.description,
      eventType: input.package.eventType,
      basePrice: input.package.basePrice,
      includedItems,
      optionalItems
    },
    priceSnapshot: {
      packageBasePrice: input.package.basePrice,
      includedSubtotalForDisplay,
      selectedAddOnsSubtotal,
      estimatedTotal: input.package.basePrice + selectedAddOnsSubtotal,
      guestCount: Math.max(1, input.guestCount),
      lineItems: [...includedItems, ...selectedAddOnItems]
    }
  };
}
