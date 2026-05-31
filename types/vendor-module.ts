export type ModuleCategory =
  | "VENUE"
  | "PHOTO"
  | "DRESS"
  | "MAKEUP"
  | "DECORATION"
  | "CATERING"
  | "INVITATION"
  | "FUNERAL_HALL"
  | "WREATH"
  | "TRANSPORT"
  | "CEREMONY"
  | "MEAL"
  | "OBITUARY";

export interface VendorServiceModuleData {
  id: string;
  vendorId: string;
  catalogKey?: string | null;
  name: string;
  category: ModuleCategory;
  price: number;
  pricingType: "FLAT" | "PER_GUEST";
  description: string | null;
  isBaseIncluded: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface QuoteModule {
  id: string;
  name: string;
  category: ModuleCategory;
  price: number;
  description?: string;
  isSelected?: boolean;
}
