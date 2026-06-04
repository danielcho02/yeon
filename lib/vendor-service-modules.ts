import type { ModuleCategory } from "@/generated/prisma/client";
import { serviceCatalog, type CatalogItem, type MvpQuoteEventType } from "@/lib/step3.shared";

type CatalogModuleMatch = {
  eventType: MvpQuoteEventType;
  module: string;
  catalogKey: string;
  category: ModuleCategory;
  item: CatalogItem;
};

const CATALOG_KEY_CATEGORY_MAP: Record<string, ModuleCategory> = {
  venue_hall: "VENUE",
  venue_sound: "DECORATION",
  venue_photo: "VENUE",
  venue_bridal: "VENUE",
  mobile_invitation_basic: "INVITATION",
  catering_meal: "CATERING",
  catering_drink: "CATERING",
  catering_cake: "CATERING",
  studio_snap: "PHOTO",
  studio_outdoor: "PHOTO",
  studio_album: "PHOTO",
  studio_video: "PHOTO",
  dress_wedding: "DRESS",
  dress_fitting: "DRESS",
  dress_accessory: "DRESS",
  dress_hanbok: "DRESS",
  makeup_bride: "MAKEUP",
  makeup_hair: "MAKEUP",
  makeup_retouch: "MAKEUP",
  makeup_groom: "MAKEUP",
  floral_bouquet: "DECORATION",
  floral_boutonniere: "DECORATION",
  floral_ceremony: "DECORATION",
  floral_table: "DECORATION",
  honeymoon_pkg: "CEREMONY",
  honeymoon_hotel: "CEREMONY",
  wedding_mc: "CEREMONY",
  wedding_live: "CEREMONY",
  funeral_hall_1d: "FUNERAL_HALL",
  funeral_hall_2d: "FUNERAL_HALL",
  funeral_hall_3d: "FUNERAL_HALL",
  funeral_food: "MEAL",
  funeral_staff: "OBITUARY",
  altar_basic: "WREATH",
  altar_premium: "WREATH",
  altar_wreath: "WREATH",
  hearse_local: "TRANSPORT",
  hearse_long: "TRANSPORT",
  cremation_basic: "CEREMONY",
  cremation_urn: "CEREMONY",
  cremation_urn_premium: "CEREMONY",
  ossuary_1y: "OBITUARY",
  ossuary_5y: "OBITUARY",
  shroud_basic: "OBITUARY",
  shroud_premium: "OBITUARY",
  funeral_obituary: "OBITUARY",
  funeral_limo: "CEREMONY",
};

const MODULE_DEFAULT_CATEGORY_MAP: Record<string, ModuleCategory> = {
  venue: "VENUE",
  studio: "PHOTO",
  dress: "DRESS",
  makeup: "MAKEUP",
  floral: "DECORATION",
  honeymoon: "CEREMONY",
  weddingOther: "CEREMONY",
  funeralHall: "FUNERAL_HALL",
  altarFloral: "WREATH",
  hearse: "TRANSPORT",
  cremation: "CEREMONY",
  ossuary: "OBITUARY",
  shroud: "OBITUARY",
  funeralOther: "OBITUARY",
};

const CATEGORY_DEFAULT_SECTION_MAP: Record<ModuleCategory, { eventType: MvpQuoteEventType; module: string }> = {
  VENUE: { eventType: "WEDDING", module: "venue" },
  PHOTO: { eventType: "WEDDING", module: "studio" },
  DRESS: { eventType: "WEDDING", module: "dress" },
  MAKEUP: { eventType: "WEDDING", module: "makeup" },
  DECORATION: { eventType: "WEDDING", module: "floral" },
  CATERING: { eventType: "WEDDING", module: "venue" },
  INVITATION: { eventType: "WEDDING", module: "venue" },
  FUNERAL_HALL: { eventType: "FUNERAL", module: "funeralHall" },
  WREATH: { eventType: "FUNERAL", module: "altarFloral" },
  TRANSPORT: { eventType: "FUNERAL", module: "hearse" },
  CEREMONY: { eventType: "FUNERAL", module: "funeralOther" },
  MEAL: { eventType: "FUNERAL", module: "funeralHall" },
  OBITUARY: { eventType: "FUNERAL", module: "funeralOther" },
};

const STANDARD_CATALOG_MATCHES: CatalogModuleMatch[] = Object.entries(serviceCatalog).flatMap(
  ([eventType, modules]) =>
    Object.entries(modules).flatMap(([module, items]) =>
      items
        .map((item) => {
          const category = CATALOG_KEY_CATEGORY_MAP[item.key];
          if (!category) return null;

          return {
            eventType: eventType as MvpQuoteEventType,
            module,
            catalogKey: item.key,
            category,
            item,
          } satisfies CatalogModuleMatch;
        })
        .filter((entry): entry is CatalogModuleMatch => Boolean(entry))
    )
);

const STANDARD_MODULE_NAME_ALIASES: Array<{
  catalogKey: string;
  category: ModuleCategory;
  pricingType: CatalogItem["pricingType"];
  names: string[];
}> = [
  {
    catalogKey: "venue_hall",
    category: "VENUE",
    pricingType: "FLAT",
    names: ["가든 예식홀 대관", "예식홀/공간 대관", "예식홀 대관"]
  },
  {
    catalogKey: "venue_bridal",
    category: "VENUE",
    pricingType: "FLAT",
    names: ["신부 대기실"]
  },
  {
    catalogKey: "venue_sound",
    category: "DECORATION",
    pricingType: "FLAT",
    names: ["음향·조명 패키지", "기본 음향·마이크", "기본 조명"]
  },
  {
    catalogKey: "catering_meal",
    category: "CATERING",
    pricingType: "PER_GUEST",
    names: ["하객 식사 1인", "하객 식사"]
  },
  {
    catalogKey: "floral_ceremony",
    category: "DECORATION",
    pricingType: "FLAT",
    names: ["플라워 버진로드", "기본 꽃장식", "기본 무대 장식"]
  },
  {
    catalogKey: "mobile_invitation_basic",
    category: "INVITATION",
    pricingType: "FLAT",
    names: ["모바일 청첩장 기본형"]
  },
  {
    catalogKey: "hearse_local",
    category: "TRANSPORT",
    pricingType: "FLAT",
    names: ["시내 운구", "고인 운구"]
  }
];

export function getVendorModuleCategoryForCatalogItem(
  catalogKey: string,
  module?: string | null
): ModuleCategory | null {
  return CATALOG_KEY_CATEGORY_MAP[catalogKey] ?? (module ? MODULE_DEFAULT_CATEGORY_MAP[module] ?? null : null);
}

export function getVendorModuleCategoryForCustomSection(module: string): ModuleCategory | null {
  return MODULE_DEFAULT_CATEGORY_MAP[module] ?? null;
}

export function findCatalogMatchForVendorModule(module: {
  name: string;
  category: ModuleCategory | string;
  pricingType: string;
}): CatalogModuleMatch | null {
  const exactMatch = STANDARD_CATALOG_MATCHES.find(
    (candidate) =>
      candidate.item.name === module.name &&
      candidate.item.pricingType === module.pricingType &&
      candidate.category === module.category
  );

  if (exactMatch) return exactMatch;

  const alias = STANDARD_MODULE_NAME_ALIASES.find(
    (candidate) =>
      candidate.names.includes(module.name) &&
      candidate.pricingType === module.pricingType &&
      candidate.category === module.category
  );

  return alias
    ? STANDARD_CATALOG_MATCHES.find((candidate) => candidate.catalogKey === alias.catalogKey) ?? null
    : null;
}

export function isStandardVendorModule(module: {
  name: string;
  category: ModuleCategory | string;
  pricingType: string;
}) {
  return Boolean(findCatalogMatchForVendorModule(module));
}

export function getCatalogKeyForVendorModule(module: {
  name: string;
  category: ModuleCategory | string;
  pricingType: string;
}) {
  return findCatalogMatchForVendorModule(module)?.catalogKey ?? null;
}

export function deriveModuleManagerSection(module: {
  category: ModuleCategory;
  name: string;
  pricingType: string;
}) {
  const catalogMatch = findCatalogMatchForVendorModule(module);
  if (catalogMatch) {
    return {
      eventType: catalogMatch.eventType,
      module: catalogMatch.module,
      catalogKey: catalogMatch.catalogKey,
    };
  }

  const fallback = CATEGORY_DEFAULT_SECTION_MAP[module.category];
  return {
    eventType: fallback.eventType,
    module: fallback.module,
    catalogKey: null,
  };
}
