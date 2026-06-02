"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  Clock,
  Flower2,
  Heart,
  HeartHandshake,
  MapPin,
  PenSquare,
  Shield,
  Sparkles,
  Utensils,
  UsersRound,
  Wallet,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Confetti, SwipeTransition } from "@/components/ui/motion";
import { createQuoteRequest as createQuoteRequestLegacy } from "@/app/vendors/actions";
import {
  acceptQuoteResponse,
  createQuoteRequest as createQuoteRequestAction,
  getVendorPackages,
  getQuotesByPlan,
  getVendorServiceModules,
  requestQuoteAdjustment,
  getStep4DashboardData,
} from "@/app/actions/quote";
import { ModularQuoteBuilder } from "./modular-quote-builder";
import { Step4BookingDashboard } from "./step4-booking-dashboard";
import type { VendorServiceModuleData } from "@/types/vendor-module";
import type { VendorPackageData } from "@/types/vendor-package";
import type { QuoteRequestWithResponses, Step4CategoryStatusDTO } from "@/types/quote";
import type { BasePackage, QuoteModule } from "@/hooks/use-quote-builder";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getQuoteServiceModuleLabel,
  getQuoteStatusMeta
} from "@/lib/step3.shared";

import type { PlanOption, ReservationItem, VendorOption, VendorServiceOption } from "./workspace-types";

export type EventType = "WEDDING" | "FUNERAL";
type StepKey = "setup" | "ai" | "vendors" | "booking";

// ─── Theme (Refined Luxury System) ─────────────────────────────────────────────

const THEMES = {
  WEDDING: {
    // Warm Ivory / Soft Champagne Gold
    heroBg: "border-[#ebdccf] bg-[#faf9f5]",
    heroOrb: "bg-transparent",
    heroPattern: "none",
    heroPatternSize: "0",
    heroPatternOpacity: "opacity-0",
    badge: "bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/50 hover:bg-[#fcf8f2]",
    stepActive: "bg-[#c4977a] text-white shadow-[0_4px_12px_rgba(196,151,122,0.3)]",
    stepDone: "bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/40",
    stepIdle: "bg-[#f7f5f0]/80 text-muted-foreground/60 border border-transparent",
    connectorDone: "bg-[#c4977a]",
    connectorIdle: "bg-[#e5e2da]",
    cardHighlight: "border-[#ebdccf]/60 bg-[#fdfcf9]",
    accentText: "text-[#c4977a]",
    accentBg: "bg-[#faf8f4]",
    accentBorder: "border-[#ebdccf]/40",
    tag: "bg-[#fcf8f2] text-[#c4977a]",
    vendorSelected: "border-[#c4977a] bg-[#faf8f4]/60 ring-1 ring-[#c4977a]/30",
    btnAccent: "bg-[#c4977a] hover:bg-[#b08569] text-white tracking-wide transition-all duration-200 rounded-xl",
    iconBg: "bg-[#fcf8f2] text-[#c4977a]",
    iconSolid: "bg-[#c4977a] text-white shadow-[0_4px_10px_rgba(196,151,122,0.25)]",
    label: "결혼 플래닝",
    Icon: Heart,
    planTitle: (name: string) => `${name}의 결혼 플랜`,
    guestLabel: "하객",
    servicePlaceholder: "예식장 대관 등",
    createTitle: "결혼 플랜 작성",
    createSub: "기본 정보를 기입하시면 AI가 최적의 공간 컨셉과 타임라인을 구성해 드립니다.",
    aiEmptyTitle: "AI 스페이스 컨셉 추천",
    aiEmptySub: "하객 규모와 예산을 토대로 럭셔리 웨딩 스타일, 추천 서비스 구성 및 타임라인을 생성합니다.",
    vendorTitle: "품격을 함께할 추천 파트너사 선택",
    progressBg: "bg-[#c4977a]",
  },
  FUNERAL: {
    // Elegant Muted Slate / Warm Stone Charcoal
    heroBg: "border-[#cbd3e0] bg-[#f4f5f8]",
    heroOrb: "bg-transparent",
    heroPattern: "none",
    heroPatternSize: "0",
    heroPatternOpacity: "opacity-0",
    badge: "bg-[#eef2f6] text-[#475569] border border-[#cbd3e0] hover:bg-[#eef2f6]",
    stepActive: "bg-[#2c3455] text-white shadow-[0_4px_12px_rgba(44,52,85,0.3)]",
    stepDone: "bg-[#eef2f6] text-[#2c3455] border border-[#cbd3e0]/60",
    stepIdle: "bg-[#eceef2] text-muted-foreground/60 border border-transparent",
    connectorDone: "bg-[#2c3455]",
    connectorIdle: "bg-[#d9dee6]",
    cardHighlight: "border-[#cbd3e0]/60 bg-[#fafafc]",
    accentText: "text-[#2c3455]",
    accentBg: "bg-[#f7f8fa]",
    accentBorder: "border-[#cbd3e0]/40",
    tag: "bg-[#eef2f6] text-[#2c3455]",
    vendorSelected: "border-[#2c3455] bg-[#f4f5f8] ring-1 ring-[#2c3455]/20",
    btnAccent: "bg-[#2c3455] hover:bg-[#1e2645] text-white tracking-wide transition-all duration-200 rounded-xl",
    iconBg: "bg-[#eef2f6] text-[#2c3455]",
    iconSolid: "bg-[#2c3455] text-white shadow-[0_4px_10px_rgba(44,52,85,0.25)]",
    label: "장례 의전 플래닝",
    Icon: Shield,
    planTitle: (name: string) => `${name}의 추모 플랜`,
    guestLabel: "조문객",
    createTitle: "추모 플랜 작성",
    createSub: "기본 정보를 기입하시면 AI가 정중한 의전 양식과 가이드를 마련해 드립니다.",
    aiEmptyTitle: "AI 추모 가이드 추천",
    aiEmptySub: "행사 규모와 일정을 바탕으로 준비 순서와 서비스 구성 가이드를 제안합니다.",
    vendorTitle: "기본 준비 및 상담을 요청할 파트너사를 확인해 주세요",
    progressBg: "bg-indigo-700",
  }
} as const;

const STEPS: Array<{ key: StepKey; label: string; short: string; Icon: typeof ClipboardList }> = [
  { key: "setup",   label: "행사 준비", short: "준비",  Icon: ClipboardList  },
  { key: "ai",      label: "AI 추천",   short: "추천",  Icon: Sparkles       },
  { key: "vendors", label: "견적 요청", short: "견적",  Icon: HeartHandshake },
  { key: "booking", label: "예약 확정", short: "확정",  Icon: BadgeCheck     },
];

function vendorIcon(companyName: string | null | undefined, name: string) {
  const s = (companyName ?? name).toLowerCase();
  if (/홀|웨딩|결혼|가든|연회|예식/.test(s)) return Building2;
  if (/케이터링|catering|푸드|음식|뷔페/.test(s)) return Utensils;
  if (/스튜디오|사진|촬영|포토/.test(s)) return Camera;
  if (/플라워|꽃|화원|flower/.test(s)) return Flower2;
  if (/장례|추모|봉안|영결/.test(s)) return Shield;
  return HeartHandshake;
}

function asDateInput(v: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

function todayDateInput() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDaysToDateInput(value: string, days: number) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

type QuoteRequestStatusItem = {
  id: string;
  vendorName: string;
  serviceLabel: string;
  statusLabel: string;
  statusTone: string;
  helperText: string;
  amount: number | null;
  canReview: boolean;
  vendorConfirmationDueAt?: string | null;
};

type RequestFormState = {
  eventPlanId: string;
  vendorId: string;
  serviceDate: string;
  preferredDateStart: string;
  preferredDateEnd: string;
  guestCount: string;
  budget: string;
  notes: string;
};

const moduleSelectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function numberInputValue(value: number | null | undefined) {
  return value != null ? String(value) : "";
}

function getRequestFormPrefill(
  selectedPlan: PlanOption | null,
  activeRequest: QuoteRequestWithResponses | null,
  eventType: EventType
) {
  const budget = activeRequest?.budget ?? selectedPlan?.budget ?? null;
  const fallbackDate = eventType === "FUNERAL" ? todayDateInput() : "";
  const exactDate = asDateInput(activeRequest?.preferredDate ?? selectedPlan?.scheduledAt ?? null) || fallbackDate;
  const rangeStart = asDateInput(activeRequest?.preferredDateStart ?? null) || exactDate;
  const rangeEnd = asDateInput(activeRequest?.preferredDateEnd ?? null) || exactDate;

  return {
    serviceDate: exactDate,
    preferredDateStart: rangeStart,
    preferredDateEnd: rangeEnd,
    guestCount: numberInputValue(selectedPlan?.guestTarget),
    budget: numberInputValue(budget)
  };
}

function parseOptionalPositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

type Props = {
  eventType: EventType;
  initialPlanId?: string | null;
  initialStep?: number | null;
  initialCreateMode?: boolean;
  viewerName: string;
  viewerEmail: string;
  plans: PlanOption[];
  vendors: VendorOption[];
  reservations: ReservationItem[];
  initialVendorModulesByVendorId?: Record<string, VendorServiceModuleData[]>;
  initialVendorPackagesByVendorId?: Record<string, VendorPackageData[]>;
  initialQuoteRequestsByPlanId?: Record<string, QuoteRequestWithResponses[]>;
};

function stepKeyFromNumber(step: number | null | undefined): StepKey | null {
  if (step === 1) return "setup";
  if (step === 2) return "ai";
  if (step === 3) return "vendors";
  if (step === 4) return "booking";
  return null;
}

export function EventPlanningWorkspace({
  eventType,
  initialPlanId,
  initialStep,
  initialCreateMode = false,
  viewerName,
  plans,
  vendors,
  reservations,
  initialVendorModulesByVendorId,
  initialVendorPackagesByVendorId,
  initialQuoteRequestsByPlanId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const theme = THEMES[eventType];
  const ThemeIcon = theme.Icon;
  const isWedding = eventType === "WEDDING";
  const isFuneral = eventType === "FUNERAL";
  const setupDateLabel = isFuneral ? "별세/빈소 접수일" : "행사일";
  const [onlyPlan] = plans;
  const singlePlan = plans.length === 1 ? onlyPlan : null;
  const initialPlan = initialCreateMode
    ? null
    : (
    (initialPlanId ? plans.find((item) => item.id === initialPlanId) : null) ??
    singlePlan
  );
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlan?.id ?? "");
  const [pendingPlanDraft, setPendingPlanDraft] = useState<PlanOption | null>(null);
  const plan = useMemo(
    () =>
      plans.find((item) => item.id === selectedPlanId) ??
      (pendingPlanDraft?.id === selectedPlanId ? pendingPlanDraft : null),
    [pendingPlanDraft, plans, selectedPlanId]
  );
  const [isEditingPlan, setIsEditingPlan] = useState(initialCreateMode || (!Boolean(initialPlan) && plans.length === 0));
  const needsPlanSelection = !plan && plans.length > 0 && !isEditingPlan;

  const planReservations = useMemo(
    () => (plan ? reservations.filter((r) => r.eventPlan.id === plan.id) : []),
    [reservations, plan]
  );
  const pendingRequests = useMemo(
    () => planReservations.filter((r) => r.status === "PENDING" && r.quoteResponseId == null),
    [planReservations]
  );
  const proposals = useMemo(
    () => planReservations.filter((r) => r.status === "PENDING" && r.quoteResponseId != null),
    [planReservations]
  );
  const pendingFinalConfirmations = useMemo(
    () =>
      planReservations.filter(
        (r) => r.status === "PENDING" && r.quoteRequestStatus === "ACCEPTED"
      ),
    [planReservations]
  );
  const confirmedRes = useMemo(
    () => planReservations.filter((r) => r.status === "CONFIRMED" || r.status === "COMPLETED"),
    [planReservations]
  );
  const [quoteRequestsData, setQuoteRequestsData] = useState<QuoteRequestWithResponses[] | null>(
    () => (plan?.id ? initialQuoteRequestsByPlanId?.[plan.id] ?? null : null)
  );

  const completedSteps = useMemo<StepKey[]>(() => {
    const done: StepKey[] = [];
    if (plan) done.push("setup");
    if (plan?.aiRecommendation) done.push("ai");
    if (pendingRequests.length + proposals.length + confirmedRes.length > 0) done.push("vendors");
    if (confirmedRes.length > 0) done.push("booking");
    return done;
  }, [plan, pendingRequests, proposals, confirmedRes]);

  const planStateInitialStep: StepKey = useMemo(() => {
    if (!plan) return "setup";
    if (pendingRequests.length > 0) return "vendors";
    if (proposals.length > 0 || pendingFinalConfirmations.length > 0 || confirmedRes.length > 0) {
      return "booking";
    }
    if ((quoteRequestsData ?? []).some(r => r.status === "RESPONDED" || r.status === "ACCEPTED")) {
      return "booking";
    }
    if (!plan.aiRecommendation) return "ai";
    return "vendors";
  }, [plan, pendingRequests, proposals, pendingFinalConfirmations, confirmedRes, quoteRequestsData]);

  const resolvedInitialStep: StepKey = useMemo(() => {
    const requestedStep = stepKeyFromNumber(initialStep);

    if (!requestedStep) return planStateInitialStep;
    if (!plan) return "setup";

    return requestedStep;
  }, [initialStep, plan, planStateInitialStep]);

  const [activeStep, setActiveStep] = useState<StepKey>(resolvedInitialStep);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id ?? "");
  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? null;
  const [checkedServiceIds, setCheckedServiceIds] = useState<Set<string>>(new Set());
  const [vendorModuleCache, setVendorModuleCache] = useState<Record<string, VendorServiceModuleData[]>>(
    () => initialVendorModulesByVendorId ?? {}
  );
  const [vendorPackageCache, setVendorPackageCache] = useState<Record<string, VendorPackageData[]>>(
    () => initialVendorPackagesByVendorId ?? {}
  );
  const [quoteRequestsCache, setQuoteRequestsCache] = useState<Record<string, QuoteRequestWithResponses[]>>(
    () => initialQuoteRequestsByPlanId ?? {}
  );
  const [vendorModules, setVendorModules] = useState<VendorServiceModuleData[] | null>(
    () => (selectedVendorId ? initialVendorModulesByVendorId?.[selectedVendorId] ?? null : null)
  );
  const [vendorPackages, setVendorPackages] = useState<VendorPackageData[] | null>(
    () => (selectedVendorId ? initialVendorPackagesByVendorId?.[selectedVendorId] ?? null : null)
  );
  const [vendorModuleError, setVendorModuleError] = useState(false);
  const [vendorPackageError, setVendorPackageError] = useState(false);
  const [step4DashboardData, setStep4DashboardData] = useState<Step4CategoryStatusDTO[] | null>(null);
  const [isQuoteActionPending, setIsQuoteActionPending] = useState(false);
  const quoteActionLockedRef = useRef(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const requestStatusPanelRef = useRef<HTMLDivElement>(null);

  function focusRequestStatusPanel() {
    requestStatusPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestStatusPanelRef.current?.focus();
  }

  function getWorkspaceHref(planId: string, step?: StepKey) {
    const params = new URLSearchParams({ planId });
    if (step) {
      params.set("step", String(STEPS.findIndex((item) => item.key === step) + 1));
    }
    return `/planner/${eventType === "WEDDING" ? "wedding" : "funeral"}?${params.toString()}`;
  }

  function navigateStep(next: StepKey) {
    const currentIdx = STEPS.findIndex((s) => s.key === activeStep);
    const nextIdx = STEPS.findIndex((s) => s.key === next);
    setDirection(nextIdx >= currentIdx ? 'forward' : 'back');
    setActiveStep(next);
    if (selectedPlanId) {
      router.push(getWorkspaceHref(selectedPlanId, next));
    }
  }

  useEffect(() => {
    if (!pendingPlanDraft) return;
    if (plans.some((item) => item.id === pendingPlanDraft.id)) {
      setPendingPlanDraft(null);
    }
  }, [pendingPlanDraft, plans]);
  // Load real VendorServiceModule records for the selected vendor
  useEffect(() => {
    if (!selectedVendorId) {
      setVendorModules(null);
      setVendorPackages(null);
      setVendorModuleError(false);
      setVendorPackageError(false);
      return;
    }
    const cachedModules = vendorModuleCache[selectedVendorId];
    const cachedPackages = vendorPackageCache[selectedVendorId];
    if (cachedModules) {
      setVendorModules(cachedModules);
      setVendorModuleError(false);
    } else {
      setVendorModules(null);
      setVendorModuleError(false);
    }
    if (cachedPackages) {
      setVendorPackages(cachedPackages);
      setVendorPackageError(false);
    } else {
      setVendorPackages(null);
      setVendorPackageError(false);
    }

    if (cachedModules && cachedPackages) return;

    let cancelled = false;
    if (!cachedModules) {
      getVendorServiceModules(selectedVendorId, eventType).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setVendorModules(result.data);
          setVendorModuleCache((current) => ({ ...current, [selectedVendorId]: result.data }));
          setVendorModuleError(false);
        } else {
          setVendorModules([]);
          setVendorModuleError(true);
        }
      });
    }
    if (!cachedPackages) {
      getVendorPackages(selectedVendorId, eventType).then((result) => {
        if (cancelled) return;
        if (result.success) {
          setVendorPackages(result.data);
          setVendorPackageCache((current) => ({ ...current, [selectedVendorId]: result.data }));
          setVendorPackageError(false);
        } else {
          setVendorPackages([]);
          setVendorPackageError(true);
        }
      });
    }
    return () => { cancelled = true; };
  }, [selectedVendorId, eventType, vendorModuleCache, vendorPackageCache]);

  async function refreshQuoteRequests(planId: string) {
    const result = await getQuotesByPlan(planId);
    if (result.success) {
      setQuoteRequestsData(result.data);
      setQuoteRequestsCache((current) => ({ ...current, [planId]: result.data }));
    }
    const dashboardResult = await getStep4DashboardData(planId);
    if (dashboardResult.success) {
      setStep4DashboardData(dashboardResult.data);
    }
    return result;
  }

  // Load quote request/response data for the current plan (used in Step 4)
  useEffect(() => {
    if (!plan?.id) { setQuoteRequestsData(null); setStep4DashboardData(null); return; }
    const cachedRequests = quoteRequestsCache[plan.id];
    if (cachedRequests) {
      setQuoteRequestsData(cachedRequests);
    } else {
      getQuotesByPlan(plan.id).then((result) => {
        if (result.success) {
          setQuoteRequestsData(result.data);
          setQuoteRequestsCache((current) => ({ ...current, [plan.id]: result.data }));
        }
      });
    }

    let cancelled = false;
    getStep4DashboardData(plan.id).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setStep4DashboardData(result.data);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  const requestedVendorIds = useMemo(
    () =>
      new Set([
        ...planReservations.map((r) => r.vendor.id),
        ...(quoteRequestsData ?? [])
          .filter((request) => request.status !== "CANCELED")
          .map((request) => request.vendorId)
      ]),
    [planReservations, quoteRequestsData]
  );
  const selectedVendorActiveRequest = useMemo(() => {
    if (!selectedVendorId) return null;

    return (
      (quoteRequestsData ?? []).find(
        (request) => request.vendorId === selectedVendorId && request.status !== "CANCELED"
      ) ?? null
    );
  }, [quoteRequestsData, selectedVendorId]);

  const selectedVendorRequestState = useMemo(() => {
    const activeRequest = selectedVendorActiveRequest;
    if (!activeRequest) return null;

    const reservationStatus = activeRequest.reservation?.status ?? null;
    const isConfirmed = reservationStatus === "CONFIRMED" || reservationStatus === "COMPLETED";

    if (isConfirmed) {
      return {
        isAlreadyRequested: true,
        label: "예약 확정 완료",
        description: "이미 최종 확정된 요청입니다. 새 견적 요청 대신 현재 진행 상태를 확인해 주세요.",
      };
    }

    if (activeRequest.status === "ACCEPTED") {
      return {
        isAlreadyRequested: true,
        label: "업체 최종 확정 대기",
        description: "업체의 최종 확정을 기다리는 중입니다.",
      };
    }

    if (activeRequest.status === "RESPONDED") {
      return {
        isAlreadyRequested: true,
        label: "제안서 확인 필요",
        description: "업체 제안서가 도착했습니다. Step 4에서 금액과 포함 항목을 확인해 주세요.",
      };
    }

    return {
      isAlreadyRequested: true,
      label: "업체 응답 대기",
      description: "업체 응답을 기다리는 중입니다.",
    };
  }, [selectedVendorActiveRequest]);
  const requestStatusItems = useMemo<QuoteRequestStatusItem[]>(() => {
    if (quoteRequestsData !== null) {
      return quoteRequestsData
        .map((request) => {
          const latestResponse = request.responses[0] ?? null;
          const moduleNames = request.selectedModuleDetails?.map((module) => module.name) ?? [];
          const serviceLabel =
            moduleNames.length > 1
              ? `${moduleNames[0]} 외 ${moduleNames.length - 1}개`
              : moduleNames[0] ?? request.requirements;
          const reservationStatus = request.reservation?.status ?? null;
          const isConfirmed = reservationStatus === "CONFIRMED" || reservationStatus === "COMPLETED";

          if (request.status === "CANCELED") {
            return {
              id: request.id,
              vendorName: request.vendor?.companyName ?? "업체",
              serviceLabel,
              statusLabel: "일정 불가",
              statusTone: "bg-slate-100 text-slate-700",
              helperText: "업체가 일정 불가로 회신했습니다. 같은 업체에는 새 요청을 다시 보낼 수 있습니다.",
              amount: null,
              canReview: false
            };
          }

          if (isConfirmed) {
            return {
              id: request.id,
              vendorName: request.vendor?.companyName ?? "업체",
              serviceLabel,
              statusLabel: "예약 확정 완료",
              statusTone: "bg-emerald-100 text-emerald-700",
              helperText: "업체가 예약을 최종 확정했습니다.",
              amount: request.reservation?.totalAmount ?? latestResponse?.totalPrice ?? request.budget,
              canReview: true
            };
          }

          if (request.status === "ACCEPTED") {
            const dueAt = request.reservation?.vendorConfirmationDueAt ?? null;
            return {
              id: request.id,
              vendorName: request.vendor?.companyName ?? "업체",
              serviceLabel,
              statusLabel: "업체 최종 확정 대기",
              statusTone: "bg-[#faf8f4] text-[#8c8275]",
              helperText: dueAt
                ? `견적은 수락됐고, 업체가 ${formatDate(dueAt)}까지 예약을 확정해야 완료됩니다.`
                : "견적은 수락됐고, 업체가 예약을 확정해야 완료됩니다.",
              amount: latestResponse?.totalPrice ?? request.reservation?.totalAmount ?? request.budget,
              canReview: true,
              vendorConfirmationDueAt: dueAt
            };
          }

          if (request.status === "RESPONDED") {
            return {
              id: request.id,
              vendorName: request.vendor?.companyName ?? "업체",
              serviceLabel,
              statusLabel: "견적 도착",
              statusTone: "bg-sky-100 text-sky-700",
              helperText: "제안서 확인 화면에서 금액과 포함 항목을 확인하세요.",
              amount: latestResponse?.totalPrice ?? request.reservation?.totalAmount ?? request.budget,
              canReview: true
            };
          }

          return {
            id: request.id,
            vendorName: request.vendor?.companyName ?? "업체",
            serviceLabel,
            statusLabel: "업체 응답 대기",
            statusTone: "bg-amber-100 text-amber-700",
            helperText: "업체가 견적을 보내면 제안서 확인 화면에서 확인할 수 있습니다.",
            amount: request.budget ?? request.reservation?.totalAmount ?? null,
            canReview: false
          };
        });
    }

    return planReservations.map((reservation) => {
      const meta = getQuoteStatusMeta(reservation);
      const isAccepted = reservation.quoteRequestStatus === "ACCEPTED";
      const isConfirmed = reservation.status === "CONFIRMED" || reservation.status === "COMPLETED";
      const dueAt = reservation.vendorConfirmationDueAt;
      return {
        id: reservation.id,
        vendorName: reservation.vendor.companyName ?? reservation.vendor.name,
        serviceLabel: getQuoteServiceModuleLabel({
          eventType: reservation.eventPlan.type,
          serviceCategory: reservation.serviceCategory,
          serviceName: reservation.serviceName
        }),
        statusLabel: isConfirmed
          ? "예약 확정 완료"
          : isAccepted
            ? "업체 최종 확정 대기"
            : meta.label,
        statusTone: isConfirmed
          ? "bg-emerald-100 text-emerald-700"
          : isAccepted
            ? "bg-[#faf8f4] text-[#8c8275]"
            : meta.tone,
        helperText: isConfirmed
          ? "업체가 예약을 최종 확정했습니다."
          : isAccepted
            ? dueAt
              ? `견적은 수락됐고, 업체가 ${formatDate(dueAt)}까지 예약을 확정해야 완료됩니다.`
              : "견적은 수락됐고, 업체가 예약을 확정해야 완료됩니다."
            : reservation.quoteResponseId != null
              ? "제안서 확인 화면에서 금액과 포함 항목을 확인하세요."
              : "업체가 견적을 보내면 제안서 확인 화면에서 확인할 수 있습니다.",
        amount: reservation.confirmedAmount ?? reservation.quotedAmount,
        canReview: reservation.quoteResponseId != null || isAccepted || isConfirmed,
        vendorConfirmationDueAt: dueAt
      };
    });
  }, [planReservations, quoteRequestsData]);

  const vendorSvcsForForm = selectedVendor
    ? (selectedVendor.services ?? []).filter(
        (s: VendorServiceOption) => s.eventType === eventType && s.isActive
      )
    : [];

  const [planForm, setPlanForm] = useState({
    planId: plan?.id ?? "",
    title: plan?.title ?? "",
    type: eventType,
    region: plan?.region ?? "",
    scheduledAt: asDateInput(plan?.scheduledAt ?? null) || (eventType === "FUNERAL" ? todayDateInput() : ""),
    guestTarget: numberInputValue(plan?.guestTarget),
    budget: numberInputValue(plan?.budget),
    description: plan?.description ?? "",
  });

  const [requestForm, setRequestForm] = useState<RequestFormState>({
    eventPlanId: plan?.id ?? "",
    vendorId: vendors[0]?.id ?? "",
    serviceDate: asDateInput(plan?.scheduledAt ?? null) || (eventType === "FUNERAL" ? todayDateInput() : ""),
    preferredDateStart: asDateInput(plan?.scheduledAt ?? null),
    preferredDateEnd: asDateInput(plan?.scheduledAt ?? null),
    guestCount: numberInputValue(plan?.guestTarget),
    budget: numberInputValue(plan?.budget),
    notes: "",
  });

  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function showNotice(tone: "success" | "error", text: string) {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 4500);
  }

  useEffect(() => {
    const nextEventPlanId = plan?.id ?? "";
    const prefill = getRequestFormPrefill(plan, selectedVendorActiveRequest, eventType);

    setRequestForm((current) => {
      const targetChanged =
        current.eventPlanId !== nextEventPlanId || current.vendorId !== selectedVendorId;
      const nextState: RequestFormState = {
        ...current,
        eventPlanId: nextEventPlanId,
        vendorId: selectedVendorId,
        serviceDate:
          targetChanged || selectedVendorActiveRequest?.preferredDate
            ? prefill.serviceDate
            : current.serviceDate || prefill.serviceDate,
        preferredDateStart:
          targetChanged || selectedVendorActiveRequest?.preferredDateStart
            ? prefill.preferredDateStart
            : current.preferredDateStart || prefill.preferredDateStart,
        preferredDateEnd:
          targetChanged || selectedVendorActiveRequest?.preferredDateEnd
            ? prefill.preferredDateEnd
            : current.preferredDateEnd || prefill.preferredDateEnd,
        guestCount: targetChanged ? prefill.guestCount : current.guestCount || prefill.guestCount,
        budget:
          targetChanged || selectedVendorActiveRequest?.budget != null
            ? prefill.budget
            : current.budget || prefill.budget
      };

      return JSON.stringify(nextState) === JSON.stringify(current) ? current : nextState;
    });
  }, [eventType, plan, selectedVendorActiveRequest, selectedVendorId]);

  function handleSelectPlan(nextPlanId: string) {
    setSelectedPlanId(nextPlanId);
    setPendingPlanDraft(null);
    const nextPlan = plans.find((item) => item.id === nextPlanId) ?? null;

    if (!nextPlan) {
      setIsEditingPlan(false);
      return;
    }

    setPlanForm({
      planId: nextPlan.id,
      title: nextPlan.title,
      type: eventType,
      region: nextPlan.region ?? "",
      scheduledAt: asDateInput(nextPlan.scheduledAt) || (eventType === "FUNERAL" ? todayDateInput() : ""),
      guestTarget: numberInputValue(nextPlan.guestTarget),
      budget: numberInputValue(nextPlan.budget),
      description: nextPlan.description ?? "",
    });
    setRequestForm((current) => ({
      ...current,
      eventPlanId: nextPlan.id,
      serviceDate: asDateInput(nextPlan.scheduledAt) || (eventType === "FUNERAL" ? todayDateInput() : ""),
      preferredDateStart: asDateInput(nextPlan.scheduledAt),
      preferredDateEnd: asDateInput(nextPlan.scheduledAt),
      guestCount: numberInputValue(nextPlan.guestTarget),
      budget: numberInputValue(nextPlan.budget),
    }));
    setIsEditingPlan(false);
    router.push(getWorkspaceHref(nextPlan.id, activeStep));
  }

  async function handleSavePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await fetch("/api/planning/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...planForm, type: eventType }),
    });
    const data = (await res.json()) as {
      error?: string;
      planId?: string;
      recommendation?: PlanOption["aiRecommendation"];
    };
    if (!res.ok) { showNotice("error", data.error ?? "저장에 실패했습니다."); return; }
    if (data.planId) {
      const nextScheduledAt = planForm.scheduledAt
        ? new Date(`${planForm.scheduledAt}T12:00:00+09:00`).toISOString()
        : null;
      setPendingPlanDraft({
        id: data.planId,
        title: planForm.title,
        type: eventType,
        region: planForm.region.trim(),
        scheduledAt: nextScheduledAt,
        guestTarget: Number.parseInt(planForm.guestTarget, 10) || null,
        budget: Number.parseInt(planForm.budget, 10) || null,
        description: planForm.description || null,
        aiRecommendation: data.recommendation ?? null,
      });
      setSelectedPlanId(data.planId);
      setPlanForm((c) => ({ ...c, planId: data.planId! }));
      setRequestForm((c) => ({
        ...c,
        eventPlanId: data.planId!,
        serviceDate: planForm.scheduledAt || c.serviceDate,
        preferredDateStart: planForm.scheduledAt || c.preferredDateStart,
        preferredDateEnd: planForm.scheduledAt || c.preferredDateEnd,
        guestCount: planForm.guestTarget || c.guestCount,
        budget: planForm.budget || c.budget,
      }));
      setDirection("forward");
      setActiveStep("ai");
      router.push(getWorkspaceHref(data.planId, "ai"));
    }
    showNotice("success", "행사 정보와 AI 추천을 저장했습니다.");
    setIsEditingPlan(false);
    startTransition(() => router.refresh());
  }

  async function handleSendRequestWithChecklist(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (quoteActionLockedRef.current) return;
    if (checkedServiceIds.size === 0) {
      showNotice("error", "최소 1개 이상의 항목을 선택해 주세요.");
      return;
    }
    const formData = new FormData();
    formData.set("vendorId", selectedVendorId);
    formData.set("eventPlanId", plan?.id ?? requestForm.eventPlanId);
    if (requestForm.serviceDate) formData.set("serviceDate", requestForm.serviceDate);
    if (requestForm.notes) formData.set("message", requestForm.notes);
    const guestCount = Math.max(1, Number.parseInt(requestForm.guestCount, 10) || 1);
    formData.set("guestCount", String(guestCount));

    const filteredSvcs = (selectedVendor?.services ?? []).filter(
      (s: VendorServiceOption) => s.eventType === eventType && s.isActive
    );
    const total = filteredSvcs.reduce((sum, svc) => {
      if (!checkedServiceIds.has(svc.id)) return sum;
      return sum + (svc.pricingType === "PER_GUEST" ? svc.basePrice * guestCount : svc.basePrice);
    }, 0);
    formData.set("quotedAmount", String(total));
    for (const id of checkedServiceIds) {
      formData.append("selectedItemIds", id);
    }

    quoteActionLockedRef.current = true;
    setIsQuoteActionPending(true);
    try {
      const result = await createQuoteRequestLegacy(formData);
      if (result?.error) { showNotice("error", result.error); return; }
      showNotice("success", "견적 요청을 보냈습니다. 업체 응답이 오면 제안서 확인 화면에서 확인할 수 있습니다.");
      setCheckedServiceIds(new Set());
      setRequestForm((c) => ({ ...c, notes: "" }));
      if (plan?.id) {
        await refreshQuoteRequests(plan.id);
        focusRequestStatusPanel();
      }
      startTransition(() => router.refresh());
    } finally {
      setIsQuoteActionPending(false);
      quoteActionLockedRef.current = false;
    }
  }

  // Handler for ModularQuoteBuilder's onRequestQuote callback
  async function handleModuleQuoteRequest(
    modules: QuoteModule[],
    basePackage: BasePackage | null
  ) {
    if (!plan || !selectedVendorId) return;
    if (quoteActionLockedRef.current) return;
    const selectedModuleIds = Array.from(
      new Set([
        ...(basePackage?.includedModuleKeys ?? []),
        ...modules.map((m) => m.id).filter((id): id is string => Boolean(id))
      ])
    );
    if (selectedModuleIds.length === 0) {
      showNotice("error", "최소 1개 이상의 항목을 선택해주세요.");
      return;
    }
    const guestCount = Math.max(1, Number.parseInt(requestForm.guestCount, 10) || 1);
    const requestedBudget = parseOptionalPositiveInt(requestForm.budget);
    const weddingStartDate = requestForm.preferredDateStart;
    const weddingEndDate = requestForm.preferredDateEnd;
    const isWeddingRangeRequest = eventType === "WEDDING" && weddingStartDate !== weddingEndDate;

    if (eventType === "WEDDING") {
      if (!weddingStartDate) {
        showNotice("error", "희망 시작일을 입력해 주세요.");
        return;
      }
      if (!weddingEndDate) {
        showNotice("error", "희망 종료일을 입력해 주세요.");
        return;
      }
      if (weddingEndDate < weddingStartDate) {
        showNotice("error", "희망 종료일은 시작일과 같거나 이후여야 합니다.");
        return;
      }
    }

    if (eventType === "FUNERAL" && !requestForm.serviceDate) {
      showNotice("error", "빈소 접수일을 입력해 주세요.");
      return;
    }

    quoteActionLockedRef.current = true;
    setIsQuoteActionPending(true);
    try {
      const result = await createQuoteRequestAction({
        planId: plan.id,
        vendorId: selectedVendorId,
        requirements: requestForm.notes.trim() || "서비스 견적 요청",
        selectedModuleIds,
        selectedPackageId: basePackage?.id,
        guestCount,
        preferredDate:
          eventType === "WEDDING"
            ? isWeddingRangeRequest ? undefined : weddingStartDate
            : requestForm.serviceDate || undefined,
        preferredDateStart: eventType === "WEDDING" && isWeddingRangeRequest ? weddingStartDate : undefined,
        preferredDateEnd: eventType === "WEDDING" && isWeddingRangeRequest ? weddingEndDate : undefined,
        budget: requestedBudget,
      });
      if (!result.success) { showNotice("error", result.error); return; }
      showNotice("success", "견적 요청을 보냈습니다. 업체 응답이 오면 제안서 확인 화면에서 확인할 수 있습니다.");
      await refreshQuoteRequests(plan.id);
      focusRequestStatusPanel();
      startTransition(() => router.refresh());
    } finally {
      setIsQuoteActionPending(false);
      quoteActionLockedRef.current = false;
    }
  }

  async function handleAcceptQuote(quoteResponseId: string, quoteProposalRevisionId?: string) {
    if (quoteActionLockedRef.current) return;
    quoteActionLockedRef.current = true;
    setIsQuoteActionPending(true);
    try {
      const result = await acceptQuoteResponse({
        quoteResponseId,
        quoteProposalRevisionId,
        reservedDate: requestForm.serviceDate || undefined,
      });
      if (!result.success) { showNotice("error", result.error); return; }
      showNotice("success", "견적을 수락했습니다. 업체의 최종 확정을 기다리는 중입니다.");
      if (eventType === "WEDDING") {
        setConfettiActive(true);
        setTimeout(() => setConfettiActive(false), 1600);
      }
      if (plan?.id) await refreshQuoteRequests(plan.id);
      startTransition(() => router.refresh());
    } finally {
      setIsQuoteActionPending(false);
      quoteActionLockedRef.current = false;
    }
  }

  async function handleRequestQuoteAdjustment(
    quoteResponseId: string,
    plannerRequestedTotalPrice: number,
    memo: string
  ) {
    if (quoteActionLockedRef.current) return { success: false, error: "이미 처리 중입니다." };
    quoteActionLockedRef.current = true;
    setIsQuoteActionPending(true);
    try {
      const result = await requestQuoteAdjustment({
        quoteResponseId,
        plannerRequestedTotalPrice,
        memo
      });
      if (!result.success) {
        showNotice("error", result.error);
        return result;
      }
      showNotice("success", "조정 요청을 보냈습니다. 업체 수정 제안을 기다리는 중입니다.");
      if (plan?.id) await refreshQuoteRequests(plan.id);
      startTransition(() => router.refresh());
      return result;
    } finally {
      setIsQuoteActionPending(false);
      quoteActionLockedRef.current = false;
    }
  }

  const totalCost = confirmedRes.reduce(
    (sum, r) => sum + (r.confirmedAmount ?? r.quotedAmount ?? 0),
    0
  );

  const stepIndex = STEPS.findIndex((s) => s.key === activeStep);
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="grid gap-4">
      <Confetti active={confettiActive} />

      {/* ── Hero header ──────────────────────────────────────────── */}
      <header className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br shadow-sm ${theme.heroBg}`}>
        <div className={`pointer-events-none absolute inset-0 ${theme.heroOrb}`} />
        <div
          className={`pointer-events-none absolute inset-0 ${theme.heroPatternOpacity}`}
          style={{ backgroundImage: theme.heroPattern, backgroundSize: theme.heroPatternSize }}
        />
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`rounded-2xl p-3.5 ${theme.iconSolid}`}>
                <ThemeIcon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <Badge className={theme.badge}>{theme.label}</Badge>
                <h1 className="font-[var(--font-display)] text-xl font-bold text-foreground sm:text-2xl">
                  {plan?.title ? plan.title : theme.planTitle(viewerName)}
                </h1>
                {plan && (
                  <p className="text-xs text-muted-foreground">
                    {[plan.region, formatDate(plan.scheduledAt), plan.guestTarget ? `${plan.guestTarget}${theme.guestLabel}` : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plans.length > 1 && (
                <select
                  aria-label="현재 플랜 선택"
                  className="max-w-[12rem] rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:bg-white"
                  onChange={(event) => handleSelectPlan(event.target.value)}
                  value={selectedPlanId}
                >
                  <option value="">플랜 선택</option>
                  {plans.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
              <Link href="/plans" className={`rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm`}>← 목록</Link>
              <Link href="/account" className="rounded-xl border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">계정</Link>
            </div>
          </div>

          {/* Summary stats */}
          {plan && (
            <div className="mt-4 flex flex-wrap gap-2">
              {confirmedRes.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  확정 {confirmedRes.length}건 · {formatCurrency(totalCost)}
                </span>
              )}
              {proposals.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-amber-500" />
                  제안 도착 {proposals.length}건
                </span>
              )}
              {pendingRequests.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-foreground/60 shadow-sm">
                  <Clock className="h-3 w-3" />
                  대기 {pendingRequests.length}건
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Stepper ──────────────────────────────────────────────── */}
      <nav className="rounded-[1.75rem] border border-white/70 bg-white/92 px-5 py-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/25">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${theme.progressBg}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground/50">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>

        <ol className="flex items-center">
          {STEPS.map((step, i) => {
            const isDone = completedSteps.includes(step.key);
            const isActive = activeStep === step.key;
            return (
              <li key={step.key} className="flex min-w-0 flex-1 items-center">
                <button
                  className="group flex min-w-0 items-center gap-2.5"
                  onClick={() => navigateStep(step.key)}
                  type="button"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                    isActive ? theme.stepActive : isDone ? theme.stepDone : theme.stepIdle
                  }`}>
                    {isDone && !isActive ? <Check className="h-3.5 w-3.5" /> : <step.Icon className="h-3.5 w-3.5" />}
                  </div>
                  <p className={`hidden truncate text-xs font-semibold transition-colors sm:block ${
                    isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/45 group-hover:text-muted-foreground/75"
                  }`}>
                    {step.label}
                  </p>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2.5 h-px flex-1 transition-colors duration-500 sm:mx-4 ${
                    completedSteps.includes(STEPS[i + 1].key) ? theme.connectorDone : theme.connectorIdle
                  }`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ── Notice ───────────────────────────────────────────────── */}
      {notice && (
        <div className={`animate-slide-up flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
          notice.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} type="button" className="rounded-lg p-0.5 transition-colors hover:bg-black/5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Step content ─────────────────────────────────────────── */}
      <SwipeTransition stepKey={activeStep} direction={direction} theme={eventType === "WEDDING" ? "wedding" : "funeral"}>

        {/* ══ STEP 1: 행사 준비 ══════════════════════════════════════ */}
        {activeStep === "setup" && (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className={`rounded-[2rem] border p-6 shadow-sm ${plan && !isEditingPlan ? theme.cardHighlight : "border-white/70 bg-white/90"}`}>
              {needsPlanSelection ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-[var(--font-display)] text-xl font-bold text-foreground">플랜을 선택해 주세요</h2>
                    <p className="mt-1 text-sm text-muted-foreground">견적 요청과 예약 확정은 선택한 플랜 기준으로 관리됩니다.</p>
                  </div>
                  <select
                    className={moduleSelectClassName}
                    onChange={(event) => handleSelectPlan(event.target.value)}
                    value={selectedPlanId}
                  >
                    <option value="">플랜 선택</option>
                    {plans.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <Link
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                    href={`/planner/${eventType === "WEDDING" ? "wedding" : "funeral"}?create=1`}
                  >
                    새 {theme.label} 플랜 만들기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : plan && !isEditingPlan ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge className={theme.badge}>{theme.label}</Badge>
                      <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-foreground sm:text-2xl">{plan.title}</h2>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingPlan(true)} type="button">
                      <PenSquare className="mr-1.5 h-3.5 w-3.5" />편집
                    </Button>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      { icon: CalendarDays, label: "행사일", value: formatDate(plan.scheduledAt) },
                      { icon: MapPin, label: "지역", value: plan.region ?? "미정" },
                      { icon: UsersRound, label: theme.guestLabel, value: plan.guestTarget ? `${plan.guestTarget}명` : "미정" },
                      { icon: Wallet, label: "예산", value: formatCurrency(plan.budget) },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-white/80 px-4 py-3.5 transition-all duration-200 hover:border-border/60 hover:bg-white">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/55">{label}</p>
                          <p className="text-sm font-semibold text-foreground">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {plan.description && (
                    <p className="rounded-2xl border border-border/40 bg-white/80 px-4 py-3.5 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  )}

                  {!plan.aiRecommendation && (
                    <button
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                      disabled={isPending}
                      onClick={() => navigateStep("ai")}
                      type="button"
                    >
                      <Sparkles className="h-4 w-4" />
                      AI 추천 받기
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSavePlan}>
                  <div>
                    <h2 className="font-[var(--font-display)] text-xl font-bold text-foreground">{plan ? "행사 정보 편집" : theme.createTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{theme.createSub}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup label="행사 이름">
                      <Input
                        placeholder={eventType === "WEDDING" ? "예: 박민준 · 이서연 결혼식" : "예: 故 박민준 님 장례"}
                        value={planForm.title}
                        onChange={(e) => setPlanForm((c) => ({ ...c, title: e.target.value }))}
                        required
                      />
                    </FieldGroup>
                    <FieldGroup label="지역">
                      <Input
                        placeholder="예: 서울 / 인천 / 수도권"
                        value={planForm.region}
                        onChange={(e) => setPlanForm((c) => ({ ...c, region: e.target.value }))}
                        required
                      />
                    </FieldGroup>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldGroup label={setupDateLabel}>
                      <Input
                        type="date"
                        value={planForm.scheduledAt}
                        onChange={(e) => setPlanForm((c) => ({ ...c, scheduledAt: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label={`${theme.guestLabel} 수`}>
                      <Input
                        inputMode="numeric"
                        placeholder="예: 160"
                        value={planForm.guestTarget}
                        onChange={(e) => setPlanForm((c) => ({ ...c, guestTarget: e.target.value }))}
                      />
                    </FieldGroup>
                  </div>

                  <FieldGroup label="예산">
                    <Input
                      inputMode="numeric"
                      placeholder="예: 30000000"
                      value={planForm.budget}
                      onChange={(e) => setPlanForm((c) => ({ ...c, budget: e.target.value }))}
                    />
                  </FieldGroup>

                  <FieldGroup label="메모">
                    <Textarea
                      placeholder={eventType === "WEDDING" ? "분위기, 참고 스타일, 요청 사항" : "종교, 지역 관습, 특이 사항"}
                      value={planForm.description}
                      onChange={(e) => setPlanForm((c) => ({ ...c, description: e.target.value }))}
                    />
                  </FieldGroup>

                  {isFuneral && planForm.scheduledAt && (
                    <div className="rounded-2xl border border-[#cbd3e0]/60 bg-[#f7f8fa] p-4 text-xs text-[#2c3455]">
                      <p className="mb-3 font-bold">3일 장례 일정 기준</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <span className="block text-[10px] font-bold text-muted-foreground">Day 1</span>
                          <span>빈소/접수 · {formatDate(planForm.scheduledAt)}</span>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <span className="block text-[10px] font-bold text-muted-foreground">Day 2</span>
                          <span>조문/의전 진행 · {formatDate(addDaysToDateInput(planForm.scheduledAt, 1))}</span>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <span className="block text-[10px] font-bold text-muted-foreground">Day 3</span>
                          <span>발인/장지 이동 · {formatDate(addDaysToDateInput(planForm.scheduledAt, 2))}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                      disabled={isPending}
                      type="submit"
                    >
                      <Sparkles className="h-4 w-4" />
                      {plan ? "저장 + AI 추천 재생성" : "행사 만들기 + AI 추천"}
                    </button>
                    {plan && (
                      <Button type="button" variant="ghost" onClick={() => setIsEditingPlan(false)}>취소</Button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Progress summary */}
            <div className="space-y-3">
              <div className={`rounded-[2rem] border p-5 shadow-sm ${theme.accentBg} ${theme.accentBorder}`}>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">준비 현황</p>
                <div className="space-y-2">
                  {[
                    { label: "행사 정보", done: Boolean(plan), value: plan ? "완료" : "미완료" },
                    { label: "AI 추천", done: Boolean(plan?.aiRecommendation), value: plan?.aiRecommendation ? "완료" : "미완료" },
                    { label: "견적 요청", done: pendingRequests.length + proposals.length + confirmedRes.length > 0, value: `${pendingRequests.length + proposals.length + confirmedRes.length}건` },
                    { label: "확정 예약", done: confirmedRes.length > 0, value: `${confirmedRes.length}건` },
                  ].map(({ label, done, value }) => (
                    <div key={label} className="flex items-center justify-between rounded-xl border border-white/80 bg-white/90 px-4 py-3 transition-all duration-200 hover:bg-white">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${done ? theme.accentText : "text-muted-foreground/45"}`}>{value}</span>
                        {done && <Check className={`h-3.5 w-3.5 ${theme.accentText}`} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {confirmedRes.length > 0 && (
                <div className={`rounded-[1.75rem] border p-5 ${theme.cardHighlight}`}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">확정 비용</p>
                  <p className="font-[var(--font-display)] text-3xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{confirmedRes.length}건 합계</p>
                </div>
              )}

              {plan && !plan.aiRecommendation && (
                <button
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                  onClick={() => navigateStep("ai")}
                  type="button"
                >
                  <Sparkles className="h-4 w-4" />
                  AI 추천 받기
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 2: AI 추천 ══════════════════════════════════════ */}
        {activeStep === "ai" && (
          <div className="grid gap-4">
            {plan?.aiRecommendation ? (
              <>
                <div className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br p-7 shadow-sm sm:p-10 ${theme.heroBg}`}>
                  <div className={`pointer-events-none absolute inset-0 ${theme.heroOrb}`} />
                  <div
                    className={`pointer-events-none absolute inset-0 ${theme.heroPatternOpacity}`}
                    style={{ backgroundImage: theme.heroPattern, backgroundSize: theme.heroPatternSize }}
                  />
                  <div className="relative space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={theme.badge}>{eventType === "WEDDING" ? "AI 웨딩 컨셉" : "AI 장례 가이드"}</Badge>
                      {plan.aiRecommendation.budgetTier && (
                        <Badge variant="outline" className={`border ${theme.accentBorder} ${theme.accentText} bg-white/60`}>
                          {plan.aiRecommendation.budgetTier === "starter" ? "기본형" : plan.aiRecommendation.budgetTier === "balanced" ? "균형형" : "프리미엄"}
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-[var(--font-display)] text-3xl font-bold text-foreground sm:text-4xl">
                      {plan.aiRecommendation.conceptTitle}
                    </h2>
                    {plan.aiRecommendation.venueStyle && (
                      <p className="text-sm leading-7 text-muted-foreground">{plan.aiRecommendation.venueStyle}</p>
                    )}
                    {plan.aiRecommendation.hostGuide && (
                      <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{plan.aiRecommendation.hostGuide}</p>
                    )}
                  </div>
                </div>

                {eventType === "WEDDING" ? (
                  /* ── Wedding: 무드보드 스타일 ── */
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
                    {plan.aiRecommendation.serviceFocus.length > 0 && (
                      <div className="rounded-[1.75rem] border border-rose-100/80 bg-white/90 p-5 shadow-sm">
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">추천 서비스</p>
                        <div className="flex flex-wrap gap-2">
                          {plan.aiRecommendation.serviceFocus.map((s) => (
                            <span key={s} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm ${theme.tag}`}>{s}</span>
                          ))}
                        </div>
                        {plan.aiRecommendation.notes.length > 0 && (
                          <div className="mt-5 space-y-2.5 border-t border-rose-100/60 pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">준비 팁 ✨</p>
                            {plan.aiRecommendation.notes.map((n, i) => (
                              <p key={i} className="flex gap-2.5 text-sm leading-5 text-muted-foreground">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                                {n}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {plan.aiRecommendation.timeline.length > 0 && (
                      <div className="rounded-[1.75rem] border border-amber-100/80 bg-white/90 p-5 shadow-sm">
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">준비 타임라인 📅</p>
                        <div className="flex flex-col gap-2">
                          {plan.aiRecommendation.timeline.map((t, i) => (
                            <div key={i} className="flex gap-3 rounded-2xl border border-amber-100/60 bg-amber-50/40 px-3.5 py-3">
                              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${theme.tag}`}>{i + 1}</span>
                              <p className="text-sm leading-5 text-muted-foreground">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Funeral: 체크리스트 스타일 ── */
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
                    {plan.aiRecommendation.serviceFocus.length > 0 && (
                      <div className="rounded-[1.75rem] border border-indigo-100/70 bg-white/90 p-5 shadow-sm">
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">필요 서비스</p>
                        <div className="flex flex-wrap gap-2">
                          {plan.aiRecommendation.serviceFocus.map((s) => (
                            <span key={s} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${theme.tag}`}>{s}</span>
                          ))}
                        </div>
                        {plan.aiRecommendation.notes.length > 0 && (
                          <div className="mt-5 space-y-2.5 border-t border-indigo-100/60 pt-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">안내 사항</p>
                            {plan.aiRecommendation.notes.map((n, i) => (
                              <p key={i} className="flex gap-2.5 text-sm leading-5 text-muted-foreground">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
                                {n}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {plan.aiRecommendation.timeline.length > 0 && (
                      <div className="rounded-[1.75rem] border border-indigo-100/70 bg-white/90 p-5 shadow-sm">
                        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/55">준비 순서</p>
                        <ol className="space-y-2.5">
                          {plan.aiRecommendation.timeline.map((t, i) => (
                            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${theme.accentText}`} />
                              {t}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                    onClick={() => navigateStep("vendors")}
                    type="button"
                  >
                    업체 견적 요청하기
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className={`rounded-[2rem] border p-12 text-center ${theme.accentBg} ${theme.accentBorder}`}>
                <div className={`mx-auto mb-6 inline-flex rounded-2xl p-5 shadow-lg ${theme.iconSolid}`}>
                  <Sparkles className="h-8 w-8" />
                </div>
                <h2 className="font-[var(--font-display)] text-2xl font-bold text-foreground">{theme.aiEmptyTitle}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{theme.aiEmptySub}</p>
                <div className="mt-8">
                  {!plan ? (
                    <p className="text-sm text-muted-foreground">먼저 행사 정보를 입력해 주세요.</p>
                  ) : (
                    <button
                      className={`mx-auto flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold ${theme.btnAccent}`}
                      disabled={isPending}
                      onClick={() => navigateStep("setup")}
                      type="button"
                    >
                      <Sparkles className="h-4 w-4" />
                      행사 정보에서 AI 추천 생성하기
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3: 견적 요청 ══════════════════════════════════════ */}
        {activeStep === "vendors" && (
          <div className="grid gap-5">
            <div className="space-y-3">
              <div>
                <h2 className="font-[var(--font-serif)] text-base font-bold text-[#2c3455] tracking-tight">{theme.vendorTitle}</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed break-keep">
                  {eventType === "WEDDING"
                    ? "업체 기본 패키지와 추가 선택 항목을 확인한 뒤 바로 견적 요청을 보낼 수 있습니다."
                    : "업체 기본 구성과 추가 선택 항목을 확인한 뒤 바로 상담 요청을 보낼 수 있습니다."}
                </p>
              </div>

              {vendors.length > 0 ? (
                <div className="flex flex-col rounded-2xl border border-[#ebdccf]/40 bg-white p-3 divide-y divide-[#f2ece4]/40">
                  {vendors.map((vendor) => {
                    const isSelected = selectedVendorId === vendor.id;
                    const VIcon = vendorIcon(vendor.companyName, vendor.name);
                    return (
                      <button
                        key={vendor.id}
                        className="group flex w-full items-center justify-between gap-4 px-2 py-3.5 text-left transition-all duration-150 hover:bg-[#faf9f5]/50"
                        onClick={() => {
                          setSelectedVendorId(vendor.id);
                          setCheckedServiceIds(new Set());
                          setRequestForm((c) => ({
                            ...c,
                            vendorId: vendor.id,
                          }));
                        }}
                        type="button"
                      >
                        <div className="flex items-center gap-4 min-w-0 pr-2">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isSelected ? theme.iconSolid : "bg-[#faf8f4] text-[#8c8275] border border-[#e5e2da]/60"
                          }`}>
                            <VIcon className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span 
                                className="font-semibold text-xs text-[#2c3455] group-hover:text-foreground break-keep"
                                style={{ color: isSelected ? theme.accentText : "#2c3455" }}
                              >
                                {vendor.companyName ?? vendor.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 font-normal truncate">{vendor.location ?? "위치 정보 없음"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 shrink-0 ml-auto">
                          <div className="flex shrink-0 items-center gap-1.5">
                            {requestedVendorIds.has(vendor.id) && (
                              <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[9px] font-bold border border-amber-100 whitespace-nowrap">
                                요청됨
                              </span>
                            )}
                            {isSelected && (
                              <div className={`rounded-full p-1 ${theme.tag}`}>
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={Building2} title="등록된 업체가 없습니다." description="현재 연결 가능한 업체가 없습니다." />
              )}

              {selectedVendorId && plan && (
                <div className={`rounded-[2rem] border p-6 shadow-sm ${theme.cardHighlight}`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-[var(--font-display)] text-sm font-bold text-foreground">
                      견적 요청 →{" "}
                      <span className={theme.accentText}>
                        {vendors.find((v) => v.id === selectedVendorId)?.companyName ?? "선택된 업체"}
                      </span>
                    </p>
                    <span className="text-[10px] text-muted-foreground/60">요청 조건은 바로 업체에 전달됩니다.</span>
                  </div>

                  <div className={`mb-5 grid gap-3 rounded-2xl border border-[#ebdccf]/35 bg-white/75 p-4 ${isWedding ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                    {isWedding ? (
                      <>
                        <FieldGroup label="희망 시작일">
                          <Input
                            type="date"
                            value={requestForm.preferredDateStart}
                            onChange={(e) => setRequestForm((c) => ({ ...c, preferredDateStart: e.target.value }))}
                          />
                        </FieldGroup>
                        <FieldGroup label="희망 종료일">
                          <Input
                            type="date"
                            value={requestForm.preferredDateEnd}
                            onChange={(e) => setRequestForm((c) => ({ ...c, preferredDateEnd: e.target.value }))}
                          />
                        </FieldGroup>
                      </>
                    ) : (
                      <FieldGroup label="빈소 접수일">
                        <Input
                          type="date"
                          value={requestForm.serviceDate}
                          onChange={(e) => setRequestForm((c) => ({ ...c, serviceDate: e.target.value }))}
                        />
                      </FieldGroup>
                    )}
                    <FieldGroup label={`${theme.guestLabel} 수`}>
                      <Input
                        inputMode="numeric"
                        placeholder="플랜 기준 인원"
                        value={requestForm.guestCount}
                        onChange={(e) => setRequestForm((c) => ({ ...c, guestCount: e.target.value }))}
                      />
                    </FieldGroup>
                    {isFuneral && requestForm.serviceDate && (
                      <div className="rounded-2xl border border-[#cbd3e0]/60 bg-[#f7f8fa] p-4 text-xs text-[#2c3455] sm:col-span-2">
                        <p className="mb-3 font-bold">접수일 기준 3일 장례 일정으로 전달됩니다.</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold text-muted-foreground">Day 1</span>
                            <span>빈소/접수 · {formatDate(requestForm.serviceDate)}</span>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold text-muted-foreground">Day 2</span>
                            <span>조문/의전 진행 · {formatDate(addDaysToDateInput(requestForm.serviceDate, 1))}</span>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-2">
                            <span className="block text-[10px] font-bold text-muted-foreground">Day 3</span>
                            <span>발인/장지 이동 · {formatDate(addDaysToDateInput(requestForm.serviceDate, 2))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <FieldGroup label="희망 예산">
                      <Input
                        inputMode="numeric"
                        placeholder="플랜 기준 예산"
                        value={requestForm.budget}
                        onChange={(e) => setRequestForm((c) => ({ ...c, budget: e.target.value }))}
                      />
                    </FieldGroup>
                    <FieldGroup label="행사 지역">
                      <Input
                        value={plan.region ?? "미정"}
                        readOnly
                        aria-readonly="true"
                        className="bg-muted/30 text-muted-foreground"
                      />
                    </FieldGroup>
                    <div className="sm:col-span-2">
                      <FieldGroup label="요청 메모">
                        <Textarea
                          placeholder="현장 분위기, 필수 조건, 상담 요청 사항"
                          value={requestForm.notes}
                          onChange={(e) => setRequestForm((c) => ({ ...c, notes: e.target.value }))}
                          className="min-h-[92px]"
                        />
                      </FieldGroup>
                    </div>
                  </div>

                  <SentRequestStatusStrip
                    items={requestStatusItems}
                    themeAccentText={theme.accentText}
                    onReview={() => navigateStep("booking")}
                    statusRef={requestStatusPanelRef}
                  />

                  {/* Module picker: real data → ModularQuoteBuilder, loading → skeleton, error → retry, fallback → old checklist */}
                  {vendorModules === null || vendorPackages === null ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-gray-100 p-3">
                          <div className="mb-2 h-4 w-3/4 rounded bg-gray-100" />
                          <div className="h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                      ))}
                    </div>
                  ) : vendorModuleError || vendorPackageError ? (
                    <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 px-4 py-6 text-center">
                      <p className="mb-2 text-sm font-semibold text-rose-700">서비스 목록을 불러오지 못했습니다</p>
                      <p className="mb-3 text-xs text-rose-600/70">네트워크 상태를 확인하고 다시 시도해주세요.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setVendorModules(null);
                          setVendorPackages(null);
                          setVendorModuleError(false);
                          setVendorPackageError(false);
                          Promise.all([
                            getVendorServiceModules(selectedVendorId, eventType),
                            getVendorPackages(selectedVendorId, eventType)
                          ]).then(([modulesResult, packagesResult]) => {
                            if (modulesResult.success) {
                              setVendorModules(modulesResult.data);
                              setVendorModuleCache((current) => ({ ...current, [selectedVendorId]: modulesResult.data }));
                            } else {
                              setVendorModules([]);
                              setVendorModuleError(true);
                            }
                            if (packagesResult.success) {
                              setVendorPackages(packagesResult.data);
                              setVendorPackageCache((current) => ({ ...current, [selectedVendorId]: packagesResult.data }));
                            } else {
                              setVendorPackages([]);
                              setVendorPackageError(true);
                            }
                          });
                        }}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold ${theme.btnAccent}`}
                      >
                        다시 불러오기
                      </button>
                    </div>
                  ) : vendorModules.length > 0 ? (
                    <ModularQuoteBuilder
                      theme={eventType === "WEDDING" ? "wedding" : "funeral"}
                      guestCount={Math.max(1, Number.parseInt(requestForm.guestCount, 10) || 1)}
                      vendorModules={vendorModules}
                      vendorPackages={vendorPackages}
                      isSubmitting={isQuoteActionPending}
                      isAlreadyRequested={selectedVendorRequestState?.isAlreadyRequested}
                      requestStatusLabel={selectedVendorRequestState?.label}
                      requestStatusDescription={selectedVendorRequestState?.description}
                      onRequestQuote={handleModuleQuoteRequest}
                    />
                  ) : (
                    <form onSubmit={handleSendRequestWithChecklist}>
                      <div className="grid gap-4">
                        {(() => {
                          const vendorSvcs = vendorSvcsForForm;
                          const grouped: Record<string, VendorServiceOption[]> = {};
                          for (const svc of vendorSvcs) {
                            (grouped[svc.module] ??= []).push(svc);
                          }
                          const guestCount = Math.max(1, Number.parseInt(requestForm.guestCount, 10) || 1);
                          const hasPerGuest = vendorSvcs.some(
                            (s) => checkedServiceIds.has(s.id) && s.pricingType === "PER_GUEST"
                          );
                          const checklistTotal = vendorSvcs.reduce((sum, svc) => {
                            if (!checkedServiceIds.has(svc.id)) return sum;
                            return sum + (svc.pricingType === "PER_GUEST" ? svc.basePrice * guestCount : svc.basePrice);
                          }, 0);

                          if (vendorSvcs.length === 0) {
                            return (
                              <p className="rounded-2xl border border-dashed border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                                등록된 서비스 항목이 없습니다. 희망 날짜와 메모만으로 문의하실 수 있습니다.
                              </p>
                            );
                          }

                          return (
                            <div>
                              <p className="mb-2 text-sm font-semibold text-foreground">원하는 항목 선택 <span className="text-rose-500">*</span></p>
                              <div className="space-y-4">
                                {Object.entries(grouped).map(([moduleValue, svcs]) => (
                                  <div key={moduleValue}>
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">
                                      {getQuoteServiceModuleLabel({ eventType, serviceCategory: moduleValue })}
                                    </p>
                                    <div className="space-y-1.5">
                                      {svcs.map((svc) => {
                                        const checked = checkedServiceIds.has(svc.id);
                                        const isPerGuest = svc.pricingType === "PER_GUEST";
                                        const subtotal = isPerGuest ? svc.basePrice * guestCount : svc.basePrice;
                                        return (
                                          <label
                                            key={svc.id}
                                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                                              checked
                                                ? "border-primary/40 bg-primary/5"
                                                : "border-border/40 bg-white hover:border-primary/20"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                                              checked={checked}
                                              onChange={() => {
                                                setCheckedServiceIds((prev) => {
                                                  const next = new Set(prev);
                                                  if (checked) { next.delete(svc.id); } else { next.add(svc.id); }
                                                  return next;
                                                });
                                              }}
                                            />
                                            <span className="min-w-0 flex-1 text-sm text-foreground">{svc.name}</span>
                                            <span className="shrink-0 text-sm font-semibold text-primary">
                                              {isPerGuest ? (
                                                checked ? (
                                                  <span className="text-right">
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                      {svc.basePrice.toLocaleString()}원/인 × {guestCount}인 ={" "}
                                                    </span>
                                                    {subtotal.toLocaleString()}원
                                                  </span>
                                                ) : (
                                                  <span>{svc.basePrice.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">원/인</span></span>
                                                )
                                              ) : (
                                                `${svc.basePrice.toLocaleString()}원`
                                              )}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {hasPerGuest && (
                                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-2.5">
                                  <span className="text-xs font-semibold text-amber-700">{theme.guestLabel} 수</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={9999}
                                    value={requestForm.guestCount}
                                    onChange={(e) => setRequestForm((c) => ({ ...c, guestCount: e.target.value }))}
                                    className="w-20 rounded-xl border border-amber-200 bg-white px-2.5 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-300"
                                  />
                                  <span className="text-xs text-amber-700">명</span>
                                </div>
                              )}

                              {checkedServiceIds.size > 0 && (
                                <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-2.5">
                                  <span className="text-sm font-semibold text-muted-foreground">선택 합계 ({checkedServiceIds.size}개)</span>
                                  <span className={`text-base font-bold ${theme.accentText}`}>{checklistTotal.toLocaleString()}원</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <button
                          className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold whitespace-nowrap break-keep ${theme.btnAccent}`}
                          disabled={
                            isQuoteActionPending ||
                            isPending ||
                            Boolean(selectedVendorRequestState?.isAlreadyRequested) ||
                            (vendorSvcsForForm.length > 0 && checkedServiceIds.size === 0)
                          }
                          type="submit"
                        >
                          <HeartHandshake className="h-4 w-4" />
                          {isQuoteActionPending
                            ? "요청 보내는 중..."
                            : selectedVendorRequestState?.label ?? "견적 요청 보내기"}
                        </button>
                        {selectedVendorRequestState && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-800">
                            <p className="font-semibold">
                              {selectedVendorRequestState.label === "업체 응답 대기"
                                ? "견적 요청 완료"
                                : selectedVendorRequestState.label}
                            </p>
                            <p className="mt-1 leading-5 text-emerald-700/90">
                              {selectedVendorRequestState.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══ STEP 4: 제안서 확인 및 수락 ══════════════════════════════════ */}
        {activeStep === "booking" && (
          <Step4BookingDashboard
            eventType={eventType}
            quoteRequestsData={quoteRequestsData}
            planReservations={planReservations}
            confirmedRes={confirmedRes}
            totalCost={totalCost}
            isQuoteActionPending={isQuoteActionPending}
            handleAcceptQuote={handleAcceptQuote}
            handleRequestQuoteAdjustment={handleRequestQuoteAdjustment}
            requestForm={requestForm}
            theme={theme}
            step4DashboardData={step4DashboardData}
          />
        )}
      </SwipeTransition>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SentRequestStatusStrip({
  items,
  themeAccentText,
  onReview,
  statusRef
}: {
  items: QuoteRequestStatusItem[];
  themeAccentText: string;
  onReview: () => void;
  statusRef: RefObject<HTMLDivElement>;
}) {
  const visibleItems = items.slice(0, 3);

  return (
    <section
      ref={statusRef}
      tabIndex={-1}
      className="mb-5 rounded-2xl border border-[#ebdccf]/45 bg-white/80 p-4"
      aria-label="보낸 요청 현황"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-[var(--font-display)] text-sm font-bold text-foreground">보낸 요청 현황</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            요청한 업체의 응답 상태와 제안 도착 여부를 바로 확인합니다.
          </p>
        </div>
        {items.length > 0 && (
          <button
            className={`text-xs font-semibold underline-offset-2 hover:underline whitespace-nowrap ${themeAccentText}`}
            onClick={onReview}
            type="button"
          >
            전체 진행 상태 확인 →
          </button>
        )}
      </div>
      {items.length > 0 ? (
        <>
          <div className="grid gap-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-border/50 bg-[#fcfaf7] px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{item.vendorName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.serviceLabel}</p>
                  </div>
                  <Badge className={`${item.statusTone} shrink-0 text-[9px]`}>{item.statusLabel}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{item.helperText}</p>
                {item.amount != null && (
                  <p className={`mt-2 text-xs font-bold ${themeAccentText}`}>{formatCurrency(item.amount)}</p>
                )}
              </article>
            ))}
          </div>
          {items.length > visibleItems.length && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              그 외 {items.length - visibleItems.length}건은 진행 상태 화면에서 확인할 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/50 bg-[#fcfaf7] px-3.5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">아직 보낸 요청이 없습니다.</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                아래 조건과 구성 항목을 확인한 뒤 업체에 첫 견적 요청을 보낼 수 있습니다.
              </p>
            </div>
            <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ title, description, icon: Icon }: { title: string; description: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border/40 bg-white/50 p-8 text-center flex flex-col items-center justify-center">
      {Icon && (
        <div className="mb-3 rounded-xl bg-muted/40 p-2.5 text-muted-foreground/60">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}
