export type Step3EventType =
  | "WEDDING"
  | "FUNERAL"
  | "BIRTHDAY"
  | "BABY_SHOWER"
  | "HOUSEWARMING"
  | "FIRST_BIRTHDAY"
  | "MEMORIAL"
  | "ETC";

export type Step3ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELED"
  | "COMPLETED";

export type MvpQuoteEventType = "WEDDING" | "FUNERAL";

export type QuoteServiceModule = {
  value: string;
  label: string;
};

export const mvpQuoteEventTypes = ["WEDDING", "FUNERAL"] as const;

export const quoteServiceModules = {
  WEDDING: [
    { value: "venue", label: "예식장·식대" },
    { value: "studio", label: "스튜디오" },
    { value: "dress", label: "드레스" },
    { value: "makeup", label: "메이크업" },
    { value: "floral", label: "꽃장식" },
    { value: "honeymoon", label: "신혼여행" },
    { value: "weddingOther", label: "기타" }
  ],
  FUNERAL: [
    { value: "funeralHall", label: "장례식장·빈소" },
    { value: "altarFloral", label: "제단꽃" },
    { value: "hearse", label: "운구" },
    { value: "cremation", label: "화장" },
    { value: "ossuary", label: "납골당" },
    { value: "shroud", label: "수의" },
    { value: "funeralOther", label: "기타" }
  ]
} satisfies Record<MvpQuoteEventType, QuoteServiceModule[]>;

export const quoteServiceModuleValues = new Set(
  Object.values(quoteServiceModules)
    .flat()
    .map((module) => module.value)
);

export type CatalogItem = {
  key: string;
  name: string;
  pricingType: "FLAT" | "PER_GUEST";
};

export const serviceCatalog: Record<MvpQuoteEventType, Record<string, CatalogItem[]>> = {
  WEDDING: {
    venue: [
      { key: "venue_hall",     name: "예식홀 기본 대관",  pricingType: "FLAT"      },
      { key: "venue_sound",    name: "음향/조명 시스템",   pricingType: "FLAT"      },
      { key: "venue_photo",    name: "포토존 설치",        pricingType: "FLAT"      },
      { key: "venue_bridal",   name: "신부 대기실 이용",   pricingType: "FLAT"      },
      { key: "catering_meal",  name: "기본 식대",          pricingType: "PER_GUEST" },
      { key: "catering_drink", name: "음료 패키지",        pricingType: "PER_GUEST" },
      { key: "catering_cake",  name: "웨딩 케이크",        pricingType: "FLAT"      }
    ],
    studio: [
      { key: "studio_snap", name: "본식 스냅 (기본)", pricingType: "FLAT" },
      { key: "studio_outdoor", name: "야외 촬영 추가", pricingType: "FLAT" },
      { key: "studio_album", name: "앨범 제작", pricingType: "FLAT" },
      { key: "studio_video", name: "영상 촬영", pricingType: "FLAT" }
    ],
    dress: [
      { key: "dress_wedding", name: "웨딩 드레스 대여", pricingType: "FLAT" },
      { key: "dress_fitting", name: "드레스 피팅 2회", pricingType: "FLAT" },
      { key: "dress_accessory", name: "웨딩 주얼리 세트", pricingType: "FLAT" },
      { key: "dress_hanbok", name: "한복 추가 대여", pricingType: "FLAT" }
    ],
    makeup: [
      { key: "makeup_bride", name: "신부 메이크업", pricingType: "FLAT" },
      { key: "makeup_hair", name: "헤어 스타일링", pricingType: "FLAT" },
      { key: "makeup_retouch", name: "피로연 리터치", pricingType: "FLAT" },
      { key: "makeup_groom", name: "신랑 그루밍", pricingType: "FLAT" }
    ],
    floral: [
      { key: "floral_bouquet", name: "신부 부케", pricingType: "FLAT" },
      { key: "floral_boutonniere", name: "신랑 부토니에", pricingType: "FLAT" },
      { key: "floral_ceremony", name: "예식장 꽃장식", pricingType: "FLAT" },
      { key: "floral_table", name: "피로연 테이블 장식", pricingType: "FLAT" }
    ],
    honeymoon: [
      { key: "honeymoon_pkg", name: "허니문 패키지 (항공+숙박)", pricingType: "FLAT" },
      { key: "honeymoon_hotel", name: "호텔 숙박 단독", pricingType: "FLAT" }
    ],
    weddingOther: [
      { key: "wedding_mc", name: "사회자", pricingType: "FLAT" },
      { key: "wedding_live", name: "라이브 버스킹", pricingType: "FLAT" }
    ]
  },
  FUNERAL: {
    funeralHall: [
      { key: "funeral_hall_1d", name: "빈소 기본 1일", pricingType: "FLAT" },
      { key: "funeral_hall_2d", name: "빈소 기본 2일", pricingType: "FLAT" },
      { key: "funeral_hall_3d", name: "빈소 기본 3일", pricingType: "FLAT" },
      { key: "funeral_food", name: "문상객 식사", pricingType: "PER_GUEST" },
      { key: "funeral_staff", name: "장례 지도사", pricingType: "FLAT" }
    ],
    altarFloral: [
      { key: "altar_basic", name: "기본 제단꽃 세트", pricingType: "FLAT" },
      { key: "altar_premium", name: "프리미엄 제단꽃 세트", pricingType: "FLAT" },
      { key: "altar_wreath", name: "근조 화환 (기본 3개)", pricingType: "FLAT" }
    ],
    hearse: [
      { key: "hearse_local", name: "시내 운구 (50km 이내)", pricingType: "FLAT" },
      { key: "hearse_long", name: "장거리 운구 (100km 이상)", pricingType: "FLAT" }
    ],
    cremation: [
      { key: "cremation_basic", name: "화장 서비스", pricingType: "FLAT" },
      { key: "cremation_urn", name: "유골함 기본", pricingType: "FLAT" },
      { key: "cremation_urn_premium", name: "유골함 프리미엄", pricingType: "FLAT" }
    ],
    ossuary: [
      { key: "ossuary_1y", name: "납골당 1년", pricingType: "FLAT" },
      { key: "ossuary_5y", name: "납골당 5년", pricingType: "FLAT" }
    ],
    shroud: [
      { key: "shroud_basic", name: "수의 기본 세트", pricingType: "FLAT" },
      { key: "shroud_premium", name: "수의 프리미엄 (한지)", pricingType: "FLAT" }
    ],
    funeralOther: [
      { key: "funeral_obituary", name: "부고 대행 서비스", pricingType: "FLAT" },
      { key: "funeral_limo", name: "가족 리무진", pricingType: "FLAT" }
    ]
  }
};

export function getCatalogItems(
  eventType: string | null | undefined,
  module: string | null | undefined
): CatalogItem[] {
  if (!eventType || !module) return [];
  const et = eventType as MvpQuoteEventType;
  return serviceCatalog[et]?.[module] ?? [];
}

export function getCatalogItem(key: string | null | undefined): CatalogItem | null {
  if (!key) return null;
  for (const modules of Object.values(serviceCatalog)) {
    for (const items of Object.values(modules)) {
      const found = items.find((item) => item.key === key);
      if (found) return found;
    }
  }
  return null;
}

export type QuoteWorkflowStatus =
  | "PLANNING"
  | "REQUESTED"
  | "PROPOSED"
  | "ACCEPTED"
  | "CONFIRMED"
  | "CANCELED"
  | "COMPLETED";

export const eventTypeOptions: Array<{ value: Step3EventType; label: string }> = [
  { value: "WEDDING", label: "웨딩" },
  { value: "FUNERAL", label: "장례" },
  { value: "BIRTHDAY", label: "생일" },
  { value: "BABY_SHOWER", label: "베이비샤워" },
  { value: "HOUSEWARMING", label: "집들이" },
  { value: "FIRST_BIRTHDAY", label: "돌잔치" },
  { value: "MEMORIAL", label: "추모 모임" },
  { value: "ETC", label: "기타" }
];

export const mvpEventTypeOptions = eventTypeOptions.filter(
  (option) => option.value === "WEDDING" || option.value === "FUNERAL"
);

export const reservationStatusMeta: Record<
  Step3ReservationStatus,
  { label: string; tone: string }
> = {
  PENDING: {
    label: "대기",
    tone: "bg-amber-100 text-amber-700"
  },
  CONFIRMED: {
    label: "확정",
    tone: "bg-primary/10 text-primary"
  },
  CANCELED: {
    label: "취소",
    tone: "bg-rose-100 text-rose-700"
  },
  COMPLETED: {
    label: "완료",
    tone: "bg-emerald-100 text-emerald-700"
  }
};

export const quoteWorkflowStatusMeta: Record<
  QuoteWorkflowStatus,
  { label: string; tone: string }
> = {
  PLANNING: {
    label: "계획중",
    tone: "bg-amber-100 text-amber-700"
  },
  REQUESTED: {
    label: "요청 보냄",
    tone: "bg-amber-100 text-amber-700"
  },
  PROPOSED: {
    label: "제안 도착",
    tone: "bg-primary/10 text-primary"
  },
  ACCEPTED: {
    label: "확정 대기",
    tone: "bg-violet-100 text-violet-700"
  },
  CONFIRMED: {
    label: "확정됨",
    tone: "bg-emerald-100 text-emerald-700"
  },
  CANCELED: {
    label: "취소/거절",
    tone: "bg-rose-100 text-rose-700"
  },
  COMPLETED: {
    label: "완료",
    tone: "bg-emerald-100 text-emerald-700"
  }
};

export function getQuoteServiceModules(type: string | null | undefined) {
  if (type === "WEDDING" || type === "FUNERAL") {
    return quoteServiceModules[type];
  }

  return [];
}

const weddingVendorServiceModuleCategories = new Set([
  "VENUE",
  "PHOTO",
  "DRESS",
  "MAKEUP",
  "DECORATION",
  "CATERING",
  "INVITATION",
  "CEREMONY"
]);

const funeralVendorServiceModuleCategories = new Set([
  "FUNERAL_HALL",
  "WREATH",
  "TRANSPORT",
  "CEREMONY",
  "MEAL",
  "OBITUARY"
]);

export function vendorServiceModuleCategoryMatchesEventType(
  eventType: string | null | undefined,
  category: string | null | undefined
) {
  if (!eventType || !category) return false;

  if (eventType === "WEDDING") {
    return weddingVendorServiceModuleCategories.has(category);
  }

  if (eventType === "FUNERAL") {
    return funeralVendorServiceModuleCategories.has(category);
  }

  return false;
}

export function parseMvpQuoteEventType(value: string | null | undefined) {
  if (value === "WEDDING" || value === "웨딩" || value === "결혼") {
    return "WEDDING";
  }

  if (value === "FUNERAL" || value === "장례") {
    return "FUNERAL";
  }

  return null;
}

export function getQuoteServiceModuleEventType(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (quoteServiceModules.WEDDING.some((module) => module.value === value)) {
    return "WEDDING";
  }

  if (quoteServiceModules.FUNERAL.some((module) => module.value === value)) {
    return "FUNERAL";
  }

  return null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function getVendorSupportedEventTypes(vendor: {
  supportedEventTypes?: unknown;
}) {
  const eventTypes = normalizeStringArray(vendor.supportedEventTypes);

  return eventTypes.filter((type): type is MvpQuoteEventType =>
    mvpQuoteEventTypes.includes(type as MvpQuoteEventType)
  );
}

export function getVendorSupportedServiceModules(vendor: {
  supportedServiceModules?: unknown;
}) {
  return normalizeStringArray(vendor.supportedServiceModules).filter((module) =>
    quoteServiceModuleValues.has(module)
  );
}

export function vendorSupportsEventType(
  vendor: {
    supportedEventTypes?: unknown;
  },
  eventType: string | null | undefined
) {
  const parsedType = parseMvpQuoteEventType(eventType);
  if (!parsedType) return false;

  return getVendorSupportedEventTypes(vendor).includes(parsedType);
}

export function vendorSupportsServiceModule(
  vendor: {
    supportedEventTypes?: unknown;
    supportedServiceModules?: unknown;
  },
  eventType: string | null | undefined,
  serviceModule?: string | null
) {
  const parsedType = parseMvpQuoteEventType(eventType);
  if (!parsedType || !vendorSupportsEventType(vendor, parsedType)) {
    return false;
  }

  if (!serviceModule) {
    return true;
  }

  const moduleEventType = getQuoteServiceModuleEventType(serviceModule);
  if (moduleEventType !== parsedType) {
    return false;
  }

  return getVendorSupportedServiceModules(vendor).includes(serviceModule);
}

export function vendorSupportsAnyServiceModule(
  vendor: {
    supportedEventTypes?: unknown;
    supportedServiceModules?: unknown;
  },
  eventType: string | null | undefined
) {
  const parsedType = parseMvpQuoteEventType(eventType);
  if (!parsedType || !vendorSupportsEventType(vendor, parsedType)) {
    return false;
  }

  return getVendorSupportedServiceModules(vendor).some(
    (module) => getQuoteServiceModuleEventType(module) === parsedType
  );
}

export function getQuoteServiceModule(
  type: string | null | undefined,
  value: string | null | undefined
) {
  return getQuoteServiceModules(type).find((module) => module.value === value?.toLowerCase()) ?? null;
}

export function getQuoteServiceModuleLabel(params: {
  eventType?: string | null;
  serviceCategory?: string | null;
  serviceName?: string | null;
}) {
  return (
    getQuoteServiceModule(params.eventType, params.serviceCategory)?.label ??
    params.serviceName ??
    params.serviceCategory ??
    "서비스"
  );
}

export function getQuoteStatusMeta(reservation: {
  status: string;
  confirmedAmount?: number | null;
  quoteResponseId?: string | null;
  quoteRequestStatus?: string | null;
  notes?: string | null;
}) {
  if (reservation.status === "PENDING") {
    if (reservation.quoteRequestStatus === "ACCEPTED") {
      return quoteWorkflowStatusMeta.ACCEPTED;
    }

    return reservation.quoteResponseId || reservation.confirmedAmount != null
      ? quoteWorkflowStatusMeta.PROPOSED
      : quoteWorkflowStatusMeta.REQUESTED;
  }

  if (reservation.status === "CONFIRMED") {
    return quoteWorkflowStatusMeta.CONFIRMED;
  }

  if (reservation.status === "COMPLETED") {
    return quoteWorkflowStatusMeta.COMPLETED;
  }

  if (reservation.status === "CANCELED") {
    const isVendorRejection =
      reservation.notes?.includes("업체") ||
      reservation.notes?.includes("불가") ||
      reservation.notes?.includes("거절");

    return {
      ...quoteWorkflowStatusMeta.CANCELED,
      label: isVendorRejection ? "업체 거절" : quoteWorkflowStatusMeta.CANCELED.label
    };
  }

  return quoteWorkflowStatusMeta.PLANNING;
}

export function getPlanQuoteSummaryMeta(
  reservations: Array<{
    status: string;
    confirmedAmount?: number | null;
    quoteResponseId?: string | null;
    quoteRequestStatus?: string | null;
    notes?: string | null;
  }>
) {
  if (reservations.length === 0) {
    return quoteWorkflowStatusMeta.PLANNING;
  }

  if (reservations.some((reservation) => reservation.status === "CONFIRMED")) {
    return quoteWorkflowStatusMeta.CONFIRMED;
  }

  if (reservations.some((reservation) => reservation.status === "COMPLETED")) {
    return quoteWorkflowStatusMeta.COMPLETED;
  }

  if (
    reservations.some(
      (reservation) =>
        reservation.status === "PENDING" && reservation.quoteRequestStatus === "ACCEPTED"
    )
  ) {
    return quoteWorkflowStatusMeta.ACCEPTED;
  }

  if (
    reservations.some(
      (reservation) =>
        reservation.status === "PENDING" &&
        (reservation.quoteResponseId || reservation.confirmedAmount != null)
    )
  ) {
    return quoteWorkflowStatusMeta.PROPOSED;
  }

  if (
    reservations.every(
      (reservation) => reservation.status === "CANCELED"
    )
  ) {
    return quoteWorkflowStatusMeta.CANCELED;
  }

  if (reservations.some((reservation) => reservation.status === "PENDING")) {
    return quoteWorkflowStatusMeta.REQUESTED;
  }

  return quoteWorkflowStatusMeta.PLANNING;
}

export function getEventTypeLabel(type: Step3EventType | string) {
  return eventTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function parseDateOnlyToKst(dateString: string) {
  return new Date(`${dateString}T12:00:00+09:00`);
}

export function getKstDayRange(dateString: string) {
  const start = new Date(`${dateString}T00:00:00+09:00`);
  const end = new Date(`${dateString}T23:59:59.999+09:00`);

  return { start, end };
}

export function normalizePositiveInt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
