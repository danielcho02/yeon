import { Heart, Shield, Sparkles, type LucideIcon } from "lucide-react";

export type Recommendation = {
  conceptTitle: string;
  budgetTier: "starter" | "balanced" | "premium";
  venueStyle: string;
  serviceFocus: string[];
  hostGuide: string;
  timeline: string[];
  notes: string[];
};

export type PlanOption = {
  id: string;
  title: string;
  type: string;
  region: string | null;
  scheduledAt: string | null;
  guestTarget: number | null;
  budget: number | null;
  description: string | null;
  aiRecommendation: Recommendation | null;
};

export type VendorServiceOption = {
  id: string;
  eventType: string;
  module: string;
  catalogKey: string | null;
  pricingType: string;
  name: string;
  description: string | null;
  basePrice: number;
  maxGuests: number | null;
  isActive: boolean;
};

export type VendorOption = {
  id: string;
  name: string;
  companyName: string | null;
  location: string | null;
  supportedEventTypes?: unknown;
  supportedServiceModules?: unknown;
  services?: VendorServiceOption[];
};

export type VendorPackageOption = {
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

export type ReservationItem = {
  id: string;
  serviceName: string;
  serviceCategory: string | null;
  serviceDate: string | null;
  guestCount: number | null;
  quotedAmount: number | null;
  confirmedAmount: number | null;
  vendorConfirmationDueAt: string | null;
  notes: string | null;
  requestMemo?: string | null;
  responseMessage?: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CHANGED" | "CANCELED" | "COMPLETED";
  quoteRequestId?: string | null;
  quoteResponseId?: string | null;
  quoteRequestStatus?: "PENDING" | "RESPONDED" | "ACCEPTED" | "CANCELED" | null;
  selectedServiceOptions?: Array<{
    catalogKey: string | null;
    name: string;
    price: number;
    pricingType: string;
    quantity?: number;
    subtotal?: number;
  }> | null;
  eventPlan: {
    id: string;
    title: string;
    type?: string;
    region?: string | null;
    scheduledAt?: string | null;
    hostName?: string | null;
    honoreeName?: string | null;
  };
  vendor: {
    id: string;
    name: string;
    companyName: string | null;
    location: string | null;
  };
};

export type WorkspaceTheme = {
  shell: string;
  orb: string;
  badge: string;
  subtleBadge: string;
  iconWrap: string;
  border: string;
  accentText: string;
  panel: string;
  title: string;
  heroTitle: string;
  heroDescription: string;
  emptyTitle: string;
  toneIcon: LucideIcon;
};

export const workspaceThemes = {
  wedding: {
    shell:
      "border-amber-200/60 bg-[linear-gradient(160deg,rgba(253,248,240,0.98),rgba(252,231,208,0.88))]",
    orb:
      "bg-[radial-gradient(circle_at_top_left,rgba(244,186,176,0.30),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(233,198,145,0.22),transparent_36%)]",
    badge: "bg-rose-100 text-rose-700",
    subtleBadge: "bg-amber-50 text-amber-700",
    iconWrap: "bg-rose-100 text-rose-700",
    border: "border-amber-200/60",
    accentText: "text-rose-700",
    panel:
      "border-amber-200/50 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(253,246,238,0.92))]",
    title: "Wedding mode",
    heroTitle: "따뜻하고 우아한 준비 흐름을 단계별로 정리합니다.",
    heroDescription:
      "샴페인과 로즈 톤으로 AI 추천, 업체 비교, 예약 확정까지 웨딩 중심의 액션 흐름을 보여줍니다.",
    emptyTitle: "웨딩 초안을 먼저 만들어보세요.",
    toneIcon: Heart
  },
  funeral: {
    shell:
      "border-indigo-200/50 bg-[linear-gradient(160deg,rgba(240,244,250,0.98),rgba(216,227,242,0.90))]",
    orb:
      "bg-[radial-gradient(circle_at_top_left,rgba(45,66,112,0.16),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(63,90,152,0.12),transparent_36%)]",
    badge: "bg-indigo-100 text-indigo-800",
    subtleBadge: "bg-indigo-50 text-indigo-700",
    iconWrap: "bg-indigo-100 text-indigo-800",
    border: "border-indigo-200/60",
    accentText: "text-indigo-800",
    panel:
      "border-indigo-200/50 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(238,242,252,0.92))]",
    title: "Funeral mode",
    heroTitle: "차분하고 명확한 안내 흐름으로 상담과 예약을 관리합니다.",
    heroDescription:
      "네이비와 인디고 톤을 기반으로 일정, 가능 여부, 진행 중 응답을 신뢰감 있게 보여줍니다.",
    emptyTitle: "안정적인 안내를 위한 계획을 추가해보세요.",
    toneIcon: Shield
  },
  default: {
    shell:
      "border-primary/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(245,241,236,0.92))]",
    orb:
      "bg-[radial-gradient(circle_at_top_left,rgba(205,163,138,0.25),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(86,98,125,0.16),transparent_34%)]",
    badge: "bg-primary/10 text-primary",
    subtleBadge: "bg-white text-foreground",
    iconWrap: "bg-primary/10 text-primary",
    border: "border-border/70",
    accentText: "text-primary",
    panel:
      "border-border/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(249,245,240,0.92))]",
    title: "Planner mode",
    heroTitle: "경조사 정보, 추천, 견적 요청을 하나의 흐름으로 연결합니다.",
    heroDescription:
      "행사 성격에 따라 톤은 달라져도 wedding / funeral MVP의 핵심 작업은 부담 없이 따라갈 수 있도록 정리했습니다.",
    emptyTitle: "행사 계획을 추가해 준비 흐름을 시작해보세요.",
    toneIcon: Sparkles
  }
} satisfies Record<string, WorkspaceTheme>;

export function getWorkspaceTheme(type: string | null | undefined) {
  if (type === "WEDDING") {
    return workspaceThemes.wedding;
  }

  if (type === "FUNERAL") {
    return workspaceThemes.funeral;
  }

  return workspaceThemes.default;
}

export function asDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}
