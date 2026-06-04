"use client";

import type { SettlementSummary } from "@/types/settlement";
import { Users, Wallet, CreditCard, Banknote } from "lucide-react";

interface SettlementDashboardProps {
  summary: SettlementSummary;
  eventType: "WEDDING" | "FUNERAL";
}

export function SettlementDashboard({ summary, eventType }: SettlementDashboardProps) {
  const isWedding = eventType === "WEDDING";
  const title = isWedding ? "축의금 정산 요약" : "조의금 정산 요약";
  
  // Theme colors
  const primaryText = isWedding ? "text-rose-700" : "text-zinc-800";
  const cardBorder = isWedding ? "border-rose-100 bg-rose-50/20" : "border-zinc-200 bg-zinc-50/20";
  const iconBg = isWedding ? "bg-rose-100/70 text-rose-700" : "bg-zinc-100 text-zinc-700";
  const progressBarColor = isWedding ? "bg-rose-500" : "bg-zinc-700";

  const totalAmountFormatted = `${summary.totalAmount.toLocaleString()}원`;
  const averageAmountFormatted = `${summary.averageAmount.toLocaleString()}원`;

  // Extract payment type stats
  const onlineStat = summary.byType.find((t) => t.type === "ONLINE") || { amount: 0, count: 0 };
  const offlineStat = summary.byType.find((t) => t.type === "OFFLINE") || { amount: 0, count: 0 };

  return (
    <div className="space-y-6">
      {/* Title & Total Widget */}
      <div className={`rounded-[1.5rem] border p-6 shadow-sm ${cardBorder}`}>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className={`text-4xl font-extrabold tracking-tight ${primaryText}`}>
              {totalAmountFormatted}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              총 수합된 금액입니다.
            </p>
          </div>
          
          <div className="flex gap-4 border-t sm:border-t-0 sm:border-l border-border/80 pt-4 sm:pt-0 sm:pl-6">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">총 건수</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{summary.totalCount}건</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">평균 금액</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{averageAmountFormatted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Breakdown by Relation */}
        <div className="rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            관계별 요약
          </h4>
          {summary.byRelation.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">아직 등록된 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3.5">
              {summary.byRelation.map((item) => {
                const percentage = summary.totalAmount > 0 ? (item.amount / summary.totalAmount) * 100 : 0;
                return (
                  <div key={item.relation} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {item.relation} <span className="text-muted-foreground font-normal">({item.count}건)</span>
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        {item.amount.toLocaleString()}원 ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
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
        <div className="rounded-[1.5rem] border border-border/60 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              수단별 요약
            </h4>
            <div className="space-y-4">
              {/* 계좌이체 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${iconBg}`}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">계좌 이체 (ONLINE)</p>
                    <p className="text-xs text-muted-foreground">{onlineStat.count}건 등록됨</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {onlineStat.amount.toLocaleString()}원
                </p>
              </div>

              {/* 현금 */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${iconBg}`}>
                    <Banknote className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">현금 (OFFLINE)</p>
                    <p className="text-xs text-muted-foreground">{offlineStat.count}건 등록됨</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {offlineStat.amount.toLocaleString()}원
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/40 text-center">
            <span className="text-[11px] text-muted-foreground">
              ※ 계좌이체 및 현금 정산은 수동 기입 장부 기준입니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
