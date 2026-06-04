"use client";

import type { SettlementSummary } from "@/types/settlement";
import { Users, Wallet, CreditCard, Banknote } from "lucide-react";

interface SettlementDashboardProps {
  summary: SettlementSummary;
  eventType: "WEDDING" | "FUNERAL";
}

export function SettlementDashboard({ summary }: SettlementDashboardProps) {
  const averageAmountFormatted = `${summary.averageAmount.toLocaleString()}원`;

  return (
    <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {/* Breakdown by Relation */}
      <div>
        <h4 className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">
          <Users className="h-3.5 w-3.5" />
          관계별 분류
        </h4>
        {summary.byRelation.length === 0 ? (
          <p className="py-6 text-sm text-[#8c8275]">아직 등록된 내역이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {summary.byRelation.map((item) => {
              const percentage = summary.totalAmount > 0 ? (item.amount / summary.totalAmount) * 100 : 0;
              return (
                <div key={item.relation} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-[#2c3455]">
                      {item.relation}
                      <span className="ml-1 tabular-nums text-[#8c8275]">({item.count})</span>
                    </span>
                    <span className="tabular-nums text-[#6b6357]">
                      {item.amount.toLocaleString()}원
                      <span className="ml-1.5 text-[#8c8275]">{Math.round(percentage)}%</span>
                    </span>
                  </div>
                  <div className="h-px w-full bg-[#ece7df]">
                    <div
                      className="h-px bg-[#2c3455] transition-[width] duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Method Breakdown */}
      <div>
        <h4 className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c8275]">
          <Wallet className="h-3.5 w-3.5" />
          수단별 분류
        </h4>
        <dl className="divide-y divide-[#ece7df]">
          <MethodRow icon={CreditCard} label="계좌 이체" count={summary.byType.find((t) => t.type === "ONLINE")?.count ?? 0} amount={summary.byType.find((t) => t.type === "ONLINE")?.amount ?? 0} />
          <MethodRow icon={Banknote} label="현금" count={summary.byType.find((t) => t.type === "OFFLINE")?.count ?? 0} amount={summary.byType.find((t) => t.type === "OFFLINE")?.amount ?? 0} />
          <div className="flex items-baseline justify-between py-3.5">
            <dt className="text-xs text-[#8c8275]">평균 금액</dt>
            <dd className="text-sm font-medium tabular-nums text-[#2c3455]">{averageAmountFormatted}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] text-[#8c8275]">
          계좌이체 및 현금 정산은 수동 기입 장부 기준입니다.
        </p>
      </div>
    </div>
  );
}

function MethodRow({
  icon: Icon,
  label,
  count,
  amount
}: {
  icon: typeof CreditCard;
  label: string;
  count: number;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <dt className="flex items-center gap-2.5 text-sm text-[#2c3455]">
        <Icon className="h-4 w-4 text-[#8c8275]" />
        {label}
        <span className="text-xs tabular-nums text-[#8c8275]">{count}건</span>
      </dt>
      <dd className="text-sm font-medium tabular-nums text-[#2c3455]">{amount.toLocaleString()}원</dd>
    </div>
  );
}
