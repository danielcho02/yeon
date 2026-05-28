"use client";

import { type ReactNode, useMemo, useRef, useState, useTransition } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  Heart,
  Inbox,
  MapPin,
  MessageSquareQuote,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  Wallet,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmReservation } from "@/app/actions/reservation";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getEventTypeLabel,
  getQuoteServiceModuleLabel,
  getQuoteStatusMeta
} from "@/lib/step3.shared";

import { asDateInput, getWorkspaceTheme, type ReservationItem } from "./workspace-types";

type Props = {
  viewerName: string;
  viewerEmail: string;
  companyName: string;
  reservations: ReservationItem[];
  pendingConfirmations?: ReservationItem[];
  supportedEventTypes?: string[];
};

type PanelKey = "inbox" | "proposals" | "confirmed";

const PANELS: Array<{ key: PanelKey; label: string; description: string; icon: typeof Inbox }> = [
  { key: "inbox",     label: "요청 Inbox",  description: "신규 견적 요청",        icon: Inbox },
  { key: "proposals", label: "견적 제안",   description: "응답 작성 · 진행 관리", icon: MessageSquareQuote },
  { key: "confirmed", label: "확정 예약",   description: "확정된 일정 관리",       icon: BadgeCheck },
];

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-white/90 px-4 text-sm text-foreground shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VendorWorkspace({
  viewerName,
  viewerEmail,
  companyName,
  reservations,
  pendingConfirmations,
  supportedEventTypes
}: Props) {
  const router = useRouter();
  const pendingConfirmationsRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();
  const [activePanel, setActivePanel] = useState<PanelKey>("inbox");

  const inboxReservations = useMemo(() => {
    const base = reservations.filter((r) => r.status === "PENDING" && r.quoteResponseId == null);
    if (!supportedEventTypes || supportedEventTypes.length === 0) return base;
    return base.filter((r) => !r.eventPlan.type || supportedEventTypes.includes(r.eventPlan.type));
  }, [reservations, supportedEventTypes]);
  const pendingConfirmationReservations = useMemo(
    () =>
      pendingConfirmations ??
      reservations.filter((r) => r.status === "PENDING" && r.quoteRequestStatus === "ACCEPTED"),
    [pendingConfirmations, reservations]
  );
  const pendingConfirmationIds = useMemo(
    () => new Set(pendingConfirmationReservations.map((reservation) => reservation.id)),
    [pendingConfirmationReservations]
  );
  const inProgressReservations = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.status === "PENDING" &&
          r.quoteResponseId != null &&
          r.quoteRequestStatus !== "ACCEPTED" &&
          !pendingConfirmationIds.has(r.id)
      ),
    [pendingConfirmationIds, reservations]
  );
  const editableProposalReservations = useMemo(
    () => [...inboxReservations, ...inProgressReservations],
    [inboxReservations, inProgressReservations]
  );
  const confirmedReservations = useMemo(
    () => reservations.filter((r) => r.status === "CONFIRMED" || r.status === "COMPLETED"),
    [reservations]
  );

  const fallbackReservation =
    pendingConfirmationReservations[0] ?? inboxReservations[0] ?? inProgressReservations[0] ?? confirmedReservations[0] ?? null;
  const [selectedReservationId, setSelectedReservationId] = useState(fallbackReservation?.id ?? "");
  const selectedReservation =
    reservations.find((r) => r.id === selectedReservationId) ?? fallbackReservation;
  const vendorPrimaryType =
    supportedEventTypes?.includes("WEDDING") && supportedEventTypes?.includes("FUNERAL")
      ? null
      : supportedEventTypes?.includes("WEDDING")
      ? "WEDDING"
      : supportedEventTypes?.includes("FUNERAL")
      ? "FUNERAL"
      : null;
  const theme = getWorkspaceTheme(
    selectedReservation?.eventPlan.type ?? vendorPrimaryType
  );
  const ThemeIcon = theme.toneIcon;
  const inboxEmptyText =
    vendorPrimaryType === "WEDDING"
      ? "새로운 웨딩 견적 요청이 없습니다 💍"
      : vendorPrimaryType === "FUNERAL"
      ? "새로운 장례 서비스 요청이 없습니다 🕯️"
      : "새 요청이 없습니다.";

  function getRequestMemo(reservation: ReservationItem | null | undefined) {
    if (!reservation) return null;
    return reservation.requestMemo ?? (reservation.quoteResponseId ? null : reservation.notes);
  }

  function getResponseMessage(reservation: ReservationItem | null | undefined) {
    if (!reservation?.quoteResponseId) return "";
    return reservation.responseMessage ?? "";
  }

  const [proposalForm, setProposalForm] = useState(() => ({
    reservationId: selectedReservation?.id ?? "",
    serviceDate: asDateInput(selectedReservation?.serviceDate ?? null),
    proposalAmount: selectedReservation?.confirmedAmount
      ? String(selectedReservation.confirmedAmount)
      : selectedReservation?.quotedAmount
      ? String(selectedReservation.quotedAmount)
      : "",
    notes: getResponseMessage(selectedReservation)
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const selectedProposalReservation =
    reservations.find((item) => item.id === proposalForm.reservationId) ?? null;
  const isSelectedAcceptedProposal =
    selectedProposalReservation?.quoteRequestStatus === "ACCEPTED";
  const editableProposalIds = useMemo(
    () => new Set(editableProposalReservations.map((reservation) => reservation.id)),
    [editableProposalReservations]
  );
  const proposalSelectValue = editableProposalIds.has(proposalForm.reservationId)
    ? proposalForm.reservationId
    : "";

  function loadReservation(reservation: ReservationItem, nextPanel?: PanelKey) {
    setSelectedReservationId(reservation.id);
    setProposalForm({
      reservationId: reservation.id,
      serviceDate: asDateInput(reservation.serviceDate),
      proposalAmount: reservation.confirmedAmount
        ? String(reservation.confirmedAmount)
        : reservation.quotedAmount
        ? String(reservation.quotedAmount)
        : "",
      notes: getResponseMessage(reservation)
    });
    setMessage(null);
    setError(null);
    if (nextPanel) setActivePanel(nextPanel);
  }

  async function updateReservation(action: "quote" | "decline") {
    if (!proposalForm.reservationId) { setError("응답할 요청을 먼저 선택해 주세요."); return; }
    if (busyReservationId === proposalForm.reservationId) return;
    if (isSelectedAcceptedProposal) {
      setError("사용자가 이미 수락한 견적입니다. 이제 예약 최종 확정만 진행할 수 있습니다.");
      return;
    }
    if (action === "quote" && (!proposalForm.serviceDate || !proposalForm.proposalAmount)) {
      setError("견적 금액과 가능 일정을 모두 입력해 주세요.");
      return;
    }
    setBusyReservationId(proposalForm.reservationId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/vendor/reservations/${proposalForm.reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          serviceDate: proposalForm.serviceDate,
          proposalAmount: proposalForm.proposalAmount,
          notes: proposalForm.notes
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "응답 저장에 실패했습니다."); return; }
      setMessage(action === "quote" ? "견적 제안을 보냈습니다." : "일정 불가로 응답했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  async function completeReservation(reservationId: string) {
    if (busyReservationId === reservationId) return;
    setBusyReservationId(reservationId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/vendor/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "완료 처리에 실패했습니다."); return; }
      setMessage("예약을 완료 처리했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  async function confirmAcceptedReservation(reservationId: string) {
    if (busyReservationId === reservationId) return;
    setBusyReservationId(reservationId);
    setMessage(null);
    setError(null);

    try {
      const result = await confirmReservation(reservationId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessage("예약을 최종 확정했습니다.");
      startTransition(() => router.refresh());
    } finally {
      setBusyReservationId(null);
    }
  }

  const confirmedTotal = confirmedReservations.reduce(
    (sum, r) => sum + (r.confirmedAmount ?? r.quotedAmount ?? 0),
    0
  );

  const panelCount = {
    inbox: inboxReservations.length,
    proposals: inProgressReservations.length,
    confirmed: confirmedReservations.length,
  };
  const selectedProposalRequestMemo = getRequestMemo(selectedProposalReservation);

  function scrollToPendingConfirmations() {
    pendingConfirmationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid gap-5">
      {/* ── Vendor header ──────────────────────────────────────────── */}
      <section className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-sm sm:p-8 ${theme.shell}`}>
        <div className={`pointer-events-none absolute inset-0 ${theme.orb}`} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: theme.toneIcon === Heart
              ? "radial-gradient(circle, #c47b45 1px, transparent 1px)"
              : "linear-gradient(rgba(45,62,112,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45,62,112,0.5) 1px, transparent 1px)",
            backgroundSize: theme.toneIcon === Heart ? "24px 24px" : "28px 28px"
          }}
        />

        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          {/* Left: Company info + metrics */}
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ${theme.iconWrap}`}>
                <ThemeIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge className={theme.badge}>업체 워크스페이스</Badge>
                  {inboxReservations.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-amber-500" />
                      새 요청 {inboxReservations.length}건
                    </span>
                  )}
                </div>
                <h2 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl">{companyName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">요청 확인, 견적 제안, 일정 응답을 한 곳에서 관리하세요.</p>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid gap-2.5 sm:grid-cols-4">
              <MetricCard icon={Inbox} label="새 요청" value={`${inboxReservations.length}건`} themeClass={theme.iconWrap} highlight={inboxReservations.length > 0} />
              <MetricCard icon={MessageSquareQuote} label="진행 제안" value={`${inProgressReservations.length}건`} themeClass={theme.iconWrap} />
              <MetricCard icon={BadgeCheck} label="확정 예약" value={`${confirmedReservations.length}건`} themeClass={theme.iconWrap} />
              <MetricCard icon={Wallet} label="확정 금액" value={formatCurrency(confirmedTotal)} themeClass={theme.iconWrap} />
            </div>
          </div>

          {/* Right: Status panel */}
          <div className={`rounded-[1.75rem] border p-5 shadow-sm ${theme.panel}`}>
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">활성 업체</p>
              <p className="mt-2 font-[var(--font-display)] text-base font-semibold text-foreground">{viewerName}</p>
              <p className="text-sm text-muted-foreground">{viewerEmail}</p>
            </div>
            <div className="space-y-2">
              <StatusRow done={inboxReservations.length > 0} label="새 요청 확인" />
              <StatusRow done={inProgressReservations.length > 0} label="견적 제안 발송" />
              <StatusRow done={pendingConfirmationReservations.length > 0} label="예약 최종 확정 필요" />
              <StatusRow done={confirmedReservations.length > 0} label="확정 예약 관리" />
            </div>

            {(inboxReservations.length > 0 || pendingConfirmationReservations.length > 0) && (
              <div className="mt-4 space-y-2">
                {pendingConfirmationReservations.length > 0 && (
                  <button
                    className="flex w-full items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left transition-colors hover:bg-violet-100/70"
                    onClick={scrollToPendingConfirmations}
                    type="button"
                  >
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-violet-700" />
                    <p className="text-xs text-violet-800">
                      <span className="font-bold">{pendingConfirmationReservations.length}건</span>은 사용자가 수락했습니다. 예약 최종 확정을 진행하세요.
                    </p>
                  </button>
                )}
                {inboxReservations.length > 0 && (
                  <button
                    className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition-colors hover:bg-amber-100/70"
                    onClick={() => setActivePanel("inbox")}
                    type="button"
                  >
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="text-xs text-amber-700">
                      <span className="font-bold">{inboxReservations.length}건</span>의 새 요청이 대기 중입니다.
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Panel tab bar ──────────────────────────────────────────── */}
      <section className="flex overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 p-2 shadow-sm">
        {PANELS.map((panel) => {
          const count = panelCount[panel.key];
          const isActive = activePanel === panel.key;

          return (
            <button
              key={panel.key}
              className={`flex flex-1 flex-col items-start gap-0.5 rounded-[1.25rem] border px-4 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? `${theme.border} ${theme.panel} shadow-sm`
                  : "border-transparent hover:border-border/40 hover:bg-muted/20"
              }`}
              onClick={() => setActivePanel(panel.key)}
              type="button"
            >
              <div className="flex w-full items-center gap-2">
                <panel.icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? theme.accentText : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {panel.label}
                </span>
                {count > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge}`}>{count}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70">{panel.description}</p>
            </button>
          );
        })}
      </section>

      {/* ── Notices ──────────────────────────────────────────────── */}
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {pendingConfirmationReservations.length > 0 && (
        <section
          ref={pendingConfirmationsRef}
          className={`scroll-mt-6 rounded-[2rem] border p-6 shadow-sm ${theme.panel}`}
        >
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge className="bg-violet-100 text-violet-700">예약 최종 확정 필요</Badge>
            <p className="text-sm text-muted-foreground">
              사용자가 견적을 수락했습니다. 업체 최종 확정을 완료해야 예약 확정 상태가 됩니다.
            </p>
            <Badge className={`ml-auto ${theme.badge}`}>{pendingConfirmationReservations.length}건 대기</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {pendingConfirmationReservations.map((r) => {
              const requestMemo = getRequestMemo(r);

              return (
                <article
                  key={r.id}
                  className="rounded-[1.5rem] border-y border-r border-l-4 border-l-violet-400 border-y-violet-100 border-r-violet-100 bg-white/82 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {getQuoteServiceModuleLabel({
                          eventType: r.eventPlan.type,
                          serviceCategory: r.serviceCategory,
                          serviceName: r.serviceName
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.eventPlan.title} · {getEventTypeLabel(r.eventPlan.type ?? "ETC")}
                      </p>
                    </div>
                    <Button
                      disabled={isPending || busyReservationId === r.id}
                      onClick={() => confirmAcceptedReservation(r.id)}
                      size="sm"
                    >
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                      {busyReservationId === r.id ? "확정 처리 중..." : "예약 최종 확정"}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/55" />{formatDate(r.serviceDate)}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground/55" />{r.eventPlan.region ?? "지역 미정"}</div>
                    <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/55" />{r.guestCount ?? 0}명</div>
                    <div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-muted-foreground/55" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                    {r.vendorConfirmationDueAt && (
                      <div className="flex items-center gap-2 font-semibold text-violet-700">
                        <Clock className="h-3.5 w-3.5" />
                        확정 요청 기한: {formatDate(r.vendorConfirmationDueAt)}
                      </div>
                    )}
                  </div>

                  {requestMemo && (
                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-800">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-700/60">사용자 요청사항</p>
                      <p>{requestMemo}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Inbox panel ──────────────────────────────────────────── */}
      {activePanel === "inbox" && (
        <section className="animate-fade-in grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          {/* Inbox list */}
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <p className="font-[var(--font-display)] text-base font-semibold text-foreground">새 견적 요청</p>
              <Badge className={`ml-auto ${theme.badge}`}>{inboxReservations.length}건 대기</Badge>
            </div>

            <div className="grid gap-2.5">
              {inboxReservations.length ? (
                inboxReservations.map((r) => (
                  <article
                    key={r.id}
                    className={`rounded-[1.5rem] border-y border-r border-l-4 border-l-amber-400 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedReservationId === r.id
                        ? `border-y-amber-200 border-r-amber-200 ${theme.panel}`
                        : "border-y-border/60 border-r-border/60 bg-white/80"
                    }`}
                  >
                    <button
                      className="w-full text-left focus-visible:outline-none"
                      onClick={() => loadReservation(r)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {getQuoteServiceModuleLabel({
                              eventType: r.eventPlan.type,
                              serviceCategory: r.serviceCategory,
                              serviceName: r.serviceName
                            })}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.eventPlan.title} · {getEventTypeLabel(r.eventPlan.type ?? "ETC")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {r.eventPlan.type === "WEDDING" ? (
                            <Heart className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <Shield className="h-3.5 w-3.5 text-indigo-600" />
                          )}
                          <Badge className={getQuoteStatusMeta(r).tone}>{getQuoteStatusMeta(r).label}</Badge>
                        </div>
                      </div>
                    </button>
                    <button
                      className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-left text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      onClick={() => loadReservation(r, "proposals")}
                      type="button"
                    >
                      <span>가능 일정과 금액을 입력하세요.</span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MessageSquareQuote className="h-3.5 w-3.5" />
                        견적 제안 작성
                      </span>
                    </button>
                  </article>
                ))
              ) : (
                <EmptyState emoji="📭" title={inboxEmptyText} description="새 견적 요청이 들어오면 이곳에 표시됩니다." />
              )}
            </div>
          </div>

          {/* Request detail */}
          <div className={`rounded-[2rem] border p-6 shadow-sm ${theme.panel}`}>
            <h3 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">요청 상세</h3>
            <div className="grid gap-2.5">
              {selectedReservation ? (
                <>
                  <DetailRow label="행사명" value={selectedReservation.eventPlan.title} />
                  <DetailRow label="행사 유형" value={getEventTypeLabel(selectedReservation.eventPlan.type ?? "ETC")} />
                  <DetailRow
                    label="요청 서비스"
                    value={getQuoteServiceModuleLabel({
                      eventType: selectedReservation.eventPlan.type,
                      serviceCategory: selectedReservation.serviceCategory,
                      serviceName: selectedReservation.serviceName
                    })}
                  />
                  <DetailRow label="희망 일정" value={formatDate(selectedReservation.serviceDate)} />
                  <DetailRow label="희망 예산" value={formatCurrency(selectedReservation.quotedAmount)} />
                  {selectedReservation.guestCount != null && (
                    <DetailRow label="참석 인원" value={`${selectedReservation.guestCount}명`} />
                  )}
                  {getRequestMemo(selectedReservation) && (
                    <DetailRow label="사용자 요청사항" value={getRequestMemo(selectedReservation) ?? ""} />
                  )}
                  {selectedReservation.selectedServiceOptions && selectedReservation.selectedServiceOptions.length > 0 && (
                    <div className="rounded-[1.25rem] border border-white/60 bg-white/70 px-4 py-3.5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/55">선택 항목</p>
                      <div className="space-y-1.5">
                        {selectedReservation.selectedServiceOptions.map((opt, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{opt.name}</span>
                            <span className="font-semibold text-foreground">
                              {opt.pricingType === "PER_GUEST" && opt.quantity != null
                                ? `${opt.price.toLocaleString()}원 × ${opt.quantity}인 = ${(opt.subtotal ?? opt.price * opt.quantity).toLocaleString()}원`
                                : `${opt.price.toLocaleString()}원`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between border-t border-border/30 pt-2">
                        <span className="text-xs font-semibold text-muted-foreground">견적 합계</span>
                        <span className="text-sm font-bold">{(selectedReservation.quotedAmount ?? 0).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState emoji="👆" title="요청을 선택해 주세요." description="왼쪽에서 요청을 클릭하면 상세 정보가 보입니다." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Proposals panel ──────────────────────────────────────── */}
      {activePanel === "proposals" && (
        <section className="animate-fade-in grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
          {/* Response form */}
          <div className={`rounded-[2rem] border p-6 shadow-sm ${theme.panel}`}>
            <div className="mb-5 flex items-center gap-2">
              <Badge className={theme.badge}>견적/제안서 작성</Badge>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reservationId">응답 대상 요청</Label>
                <select
                  className={selectClassName}
                  id="reservationId"
                  onChange={(e) => {
                    const r = reservations.find((item) => item.id === e.target.value) ?? null;
                    if (r) loadReservation(r);
                  }}
                  value={proposalSelectValue}
                >
                  <option value="">요청 선택</option>
                  {editableProposalReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getQuoteServiceModuleLabel({
                        eventType: r.eventPlan.type,
                        serviceCategory: r.serviceCategory,
                        serviceName: r.serviceName
                      })} / {r.eventPlan.title}
                    </option>
                  ))}
                </select>
              </div>

              {isSelectedAcceptedProposal && selectedProposalReservation && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-800">
                  <p className="font-semibold">사용자가 이 견적을 수락했습니다.</p>
                  <p className="mt-1 text-xs text-violet-700/80">
                    견적 수정 대신 예약 최종 확정을 진행하세요.
                  </p>
                  {selectedProposalReservation.vendorConfirmationDueAt && (
                    <p className="mt-1 text-xs font-semibold text-violet-800">
                      확정 요청 기한: {formatDate(selectedProposalReservation.vendorConfirmationDueAt)}
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    disabled={busyReservationId === selectedProposalReservation.id}
                    onClick={() => confirmAcceptedReservation(selectedProposalReservation.id)}
                    size="sm"
                  >
                    <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                    {busyReservationId === selectedProposalReservation.id ? "확정 처리 중..." : "예약 최종 확정"}
                  </Button>
                </div>
              )}

              {selectedProposalRequestMemo && (
                <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-foreground">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/55">사용자 요청사항</p>
                  <p>{selectedProposalRequestMemo}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="가능 일정" name="serviceDate">
                  <Input
                    id="serviceDate"
                    type="date"
                    disabled={isSelectedAcceptedProposal}
                    value={proposalForm.serviceDate}
                    onChange={(e) => setProposalForm((c) => ({ ...c, serviceDate: e.target.value }))}
                  />
                </Field>
                <Field label="견적 금액 (원)" name="proposalAmount">
                  <Input
                    id="proposalAmount"
                    inputMode="numeric"
                    disabled={isSelectedAcceptedProposal}
                    value={proposalForm.proposalAmount}
                    onChange={(e) => setProposalForm((c) => ({ ...c, proposalAmount: e.target.value }))}
                  />
                </Field>
              </div>

              <Field label="응답 메모" name="notes">
                <Textarea
                  id="notes"
                  placeholder="상담 포인트, 포함 범위, 일정 안내를 적어주세요."
                  disabled={isSelectedAcceptedProposal}
                  value={proposalForm.notes}
                  onChange={(e) => setProposalForm((c) => ({ ...c, notes: e.target.value }))}
                />
              </Field>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={isPending || isSelectedAcceptedProposal || busyReservationId === proposalForm.reservationId} onClick={() => updateReservation("quote")} className="flex-1">
                  <MessageSquareQuote className="mr-2 h-4 w-4" />
                  {busyReservationId === proposalForm.reservationId ? "저장 중..." : "견적 제안 보내기"}
                </Button>
                <Button disabled={isPending || isSelectedAcceptedProposal || busyReservationId === proposalForm.reservationId} onClick={() => updateReservation("decline")} variant="destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  일정 불가
                </Button>
              </div>
            </div>
          </div>

          {/* In-progress list */}
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
            <h3 className="mb-5 font-[var(--font-display)] text-base font-semibold text-foreground">진행 중 제안</h3>
            <div className="grid gap-2.5">
              {inProgressReservations.length ? (
                inProgressReservations.map((r) => (
                  <div key={r.id} className="rounded-[1.5rem] border border-border/60 bg-white/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {getQuoteServiceModuleLabel({
                            eventType: r.eventPlan.type,
                            serviceCategory: r.serviceCategory,
                            serviceName: r.serviceName
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.eventPlan.title}</p>
                      </div>
                      <Badge className={r.quoteRequestStatus === "ACCEPTED" ? "bg-violet-100 text-violet-700" : theme.badge}>
                        {r.quoteRequestStatus === "ACCEPTED" ? "사용자 수락 완료" : "제안 발송"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/55" />{formatDate(r.serviceDate)}</div>
                      <div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-muted-foreground/55" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                      {r.quoteRequestStatus === "ACCEPTED" && r.vendorConfirmationDueAt && (
                        <div className="flex items-center gap-2 font-semibold text-violet-700">
                          <Clock className="h-3.5 w-3.5" />
                          확정 요청 기한: {formatDate(r.vendorConfirmationDueAt)}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      {r.quoteRequestStatus === "ACCEPTED" ? (
                        <Button
                          disabled={isPending || busyReservationId === r.id}
                          onClick={() => confirmAcceptedReservation(r.id)}
                          size="sm"
                        >
                          <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                          {busyReservationId === r.id ? "확정 처리 중..." : "예약 최종 확정"}
                        </Button>
                      ) : (
                        <Badge variant="outline">사용자 견적 수락 대기</Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState emoji="💌" title="진행 중 제안이 없습니다." description="견적 제안을 보내면 이곳에 표시됩니다." />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Confirmed panel ──────────────────────────────────────── */}
      {activePanel === "confirmed" && (
        <section className="animate-fade-in rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <p className="font-[var(--font-display)] text-base font-semibold text-foreground">확정 예약 목록</p>
            <Badge className={`ml-auto ${theme.badge}`}>{confirmedReservations.length}건</Badge>
          </div>

          {confirmedReservations.length > 0 && (
            <div className={`mb-5 rounded-2xl border p-4 ${theme.panel}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/55">확정 총액</p>
              <p className="mt-1 font-[var(--font-display)] text-2xl font-bold text-foreground">{formatCurrency(confirmedTotal)}</p>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {confirmedReservations.length ? (
              confirmedReservations.map((r) => (
                <article
                  key={r.id}
                  className="rounded-[1.75rem] border-y border-r border-l-4 border-l-emerald-400 border-y-emerald-100/70 border-r-emerald-100/70 bg-white/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className={getQuoteStatusMeta(r).tone}>
                          {getQuoteStatusMeta(r).label}
                        </Badge>
                        <Badge variant="outline">{getEventTypeLabel(r.eventPlan.type ?? "ETC")}</Badge>
                      </div>
                      <p className="mt-2.5 font-semibold text-foreground">
                        {getQuoteServiceModuleLabel({
                          eventType: r.eventPlan.type,
                          serviceCategory: r.serviceCategory,
                          serviceName: r.serviceName
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.eventPlan.title}</p>
                    </div>
                    <Button
                      disabled={isPending || busyReservationId === r.id || r.status === "COMPLETED"}
                      onClick={() => completeReservation(r.id)}
                      size="sm"
                      variant="outline"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      {busyReservationId === r.id ? "처리 중..." : "완료 처리"}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground/45" />{formatDate(r.serviceDate)}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground/45" />{r.eventPlan.region ?? "지역 미정"}</div>
                    <div className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 text-muted-foreground/45" />{r.guestCount ?? 0}명</div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/45" />{formatCurrency(r.confirmedAmount ?? r.quotedAmount)}</div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState emoji="✨" title="확정 예약이 없습니다." description="예약이 확정되면 이곳에 표시됩니다." />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, themeClass, highlight = false }: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  themeClass: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative rounded-[1.5rem] border bg-white/90 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${highlight ? "border-amber-200 ring-1 ring-amber-100/80" : "border-white/70"}`}>
      {highlight && (
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
      )}
      <div className={`mb-2.5 inline-flex rounded-xl p-2 ${themeClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/60 bg-white/70 px-4 py-3 transition-all duration-200 hover:bg-white/92">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/50"
      }`}>
        {done ? <BadgeCheck className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
      </div>
      <p className={`text-sm font-medium transition-colors ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/60 bg-white/70 px-4 py-3.5 transition-all duration-200 hover:bg-white/92">
      <p className="text-[10px] text-muted-foreground/55">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ title, description, emoji }: { title: string; description: string; emoji?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/40 bg-white/50 p-7 text-center">
      {emoji && <p className="mb-3 text-3xl">{emoji}</p>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div className={`animate-slide-up rounded-2xl border px-4 py-3.5 text-sm ${
      tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
    }`}>
      {children}
    </div>
  );
}
