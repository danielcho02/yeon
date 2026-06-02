import type { VendorServiceModuleData } from "./vendor-module";

export type VendorPackageModuleSelectionType = "INCLUDED" | "OPTIONAL";
export type VendorPackageLineItemSource = "PACKAGE_INCLUDED" | "PACKAGE_OPTIONAL" | "VENDOR_ADDON";

export interface VendorPackageModuleData {
  id: string;
  packageId: string;
  vendorServiceModuleId: string;
  selectionType: VendorPackageModuleSelectionType;
  quantity: number;
  priceOverride: number | null;
  sortOrder: number;
  module: VendorServiceModuleData;
}

export interface VendorPackageData {
  id: string;
  vendorId: string;
  eventType: "WEDDING" | "FUNERAL" | string;
  name: string;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  sortOrder: number;
  items: VendorPackageModuleData[];
}

export interface VendorPackageSnapshotItem {
  id: string;
  packageItemId?: string;
  name: string;
  category: string;
  price: number;
  pricingType: "FLAT" | "PER_GUEST";
  quantity: number;
  subtotal: number;
  description?: string | null;
  source: VendorPackageLineItemSource;
}

export interface VendorPackageSnapshot {
  packageId: string;
  name: string;
  description: string | null;
  eventType: string;
  basePrice: number;
  includedItems: VendorPackageSnapshotItem[];
  optionalItems: VendorPackageSnapshotItem[];
}

export interface VendorPackagePriceSnapshot {
  packageBasePrice: number;
  includedSubtotalForDisplay: number;
  selectedAddOnsSubtotal: number;
  estimatedTotal: number;
  guestCount: number;
  lineItems: VendorPackageSnapshotItem[];
}
