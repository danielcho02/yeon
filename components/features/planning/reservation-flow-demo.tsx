"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type OptionId = "flowers" | "bbq" | "media";

type Option = {
  id: OptionId;
  title: string;
  description: string;
  amount: number;
  badge: string;
};

const OPTIONS: Option[] = [
  {
    id: "flowers",
    title: "프리미엄 꽃장식",
    description: "+1,500,000원",
    amount: 1_500_000,
    badge: "플로럴 무드",
  },
  {
    id: "bbq",
    title: "바베큐 뷔페 업그레이드",
    description: "+50,000원/인당 · 100명 고정",
    amount: 5_000_000,
    badge: "100명 기준",
  },
  {
    id: "media",
    title: "미디어 파사드 연출",
    description: "+80,000원",
    amount: 80_000,
    badge: "시네마틱",
  },
];

const initialTotalPrice = 10_000_000;

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

export function ReservationFlowDemo() {
  const [selectedOptions, setSelectedOptions] = useState<Record<OptionId, boolean>>({
    flowers: false,
    bbq: false,
    media: false,
  });
  const [totalPrice, setTotalPrice] = useState(initialTotalPrice);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(selectedOptions).filter(Boolean).length,
    [selectedOptions]
  );

  function toggleOption(option: Option) {
    setSelectedOptions((current) => {
      const nextChecked = !current[option.id];
      setTotalPrice((price) => price + (nextChecked ? option.amount : -option.amount));

      return {
        ...current,
        [option.id]: nextChecked,
      };
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,228,214,0.92),_transparent_30%),linear-gradient(180deg,#fffaf5_0%,#f6f1ea_45%,#ece6df_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/60 bg-white/85 p-6 shadow-[0_20px_60px_-30px_rgba(60,45,30,0.35)] backdrop-blur sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, #c47b45 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-700/70">Reservation Flow MVP</p>
              <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
                행사 예약 흐름 데모
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                백엔드 없이 옵션 선택과 총액 계산, 그리고 예약 신청 모달까지 한 번에 확인할 수 있는
                클라이언트 전용 MVP입니다.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-3 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/70">현재 선택</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                <span className="font-bold text-amber-700">{selectedCount}개</span> 옵션 선택 중
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_60px_-40px_rgba(60,45,30,0.35)] sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">Step 01</p>
                <h2 className="mt-1 font-[var(--font-display)] text-xl font-semibold text-foreground">옵션 선택</h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                모의 데이터만 사용
              </span>
            </div>

            <div className="space-y-4">
              {OPTIONS.map((option) => {
                const checked = selectedOptions[option.id];

                return (
                  <label
                    key={option.id}
                    className={`group flex cursor-pointer items-start gap-4 rounded-[1.5rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${checked ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border/70 bg-white/90"}`}
                  >
                    <input
                      checked={checked}
                      className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary"
                      onChange={() => toggleOption(option)}
                      type="checkbox"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-[var(--font-display)] text-base font-semibold text-foreground">
                          {option.title}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {option.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold transition-colors ${checked ? "text-primary" : "text-foreground"}`}>
                        {checked ? "추가됨" : `+${formatMoney(option.amount)}`}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,240,0.9))] p-6 shadow-[0_24px_60px_-40px_rgba(30,41,59,0.35)] sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">Step 02</p>
              <h2 className="mt-1 font-[var(--font-display)] text-xl font-semibold text-foreground">총 예약 금액</h2>

              <div className="mt-5 rounded-[1.75rem] border border-slate-200/70 bg-white px-5 py-6 shadow-sm">
                <p className="text-sm text-muted-foreground">실시간 예상 금액</p>
                <p className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-foreground transition-all duration-200 sm:text-5xl">
                  {formatMoney(totalPrice)}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-primary transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalPrice / 18_000_000) * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  기본가 10,000,000원에서 선택 옵션이 더해집니다. 금액은 실시간으로 반영됩니다.
                </p>
              </div>

              <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-amber-50/60 p-4 text-sm text-foreground ring-1 ring-amber-200/60">
                <div className="flex items-center justify-between gap-3">
                  <span>기본 예약가</span>
                  <strong>{formatMoney(initialTotalPrice)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>추가 옵션 금액</span>
                  <strong className="text-primary">{formatMoney(totalPrice - initialTotalPrice)}</strong>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                onClick={() => setIsModalOpen(true)}
                size="full"
              >
                예약 신청하기
              </Button>
            </div>

            <div className="rounded-[2rem] border border-dashed border-border/70 bg-white/70 p-5 text-sm leading-7 text-muted-foreground shadow-sm">
              <p className="mb-2 font-semibold text-foreground">시연 포인트</p>
              <ul className="space-y-2">
                <li>• 체크박스 상태와 금액이 즉시 반응합니다.</li>
                <li>• 숫자는 굵게 보여서 영상에서 변화가 잘 보입니다.</li>
                <li>• 예약 신청 시 중앙 모달이 떠서 흐름이 끊기지 않습니다.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.55)] sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-primary" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">Notification</p>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-foreground">
                  업체에게 알림이 전송되었습니다
                </h3>
              </div>
              <button
                className="rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              선택한 옵션과 금액 정보를 바탕으로 업체에게 예약 신청이 전송된 것처럼 표현한
              클라이언트 전용 모달입니다.
            </p>

            <div className="mt-6 rounded-[1.5rem] bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">예상 총액</span>
                <strong className="text-foreground">{formatMoney(totalPrice)}</strong>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">선택 옵션 수</span>
                <strong className="text-foreground">{selectedCount}개</strong>
              </div>
            </div>

            <Button className="mt-6 w-full" onClick={() => setIsModalOpen(false)} size="full" variant="outline">
              확인하고 닫기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}