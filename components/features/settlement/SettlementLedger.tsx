"use client";

import { useState } from "react";
import type { SettlementEntryData } from "@/types/settlement";
import { Search, Edit2, Calendar } from "lucide-react";

interface SettlementLedgerProps {
  entries: SettlementEntryData[];
  onEditClick: (entry: SettlementEntryData) => void;
  eventType: "WEDDING" | "FUNERAL";
}

export function SettlementLedger({ entries, onEditClick, eventType }: SettlementLedgerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRelation, setSelectedRelation] = useState("전체");
  const [selectedType, setSelectedType] = useState("전체");

  const isWedding = eventType === "WEDDING";

  // Unique relations present in the entries for filtering
  const allRelations = ["전체", ...Array.from(new Set(entries.map((e) => e.relation || "미분류")))];

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.message || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRelation = selectedRelation === "전체" || (entry.relation || "미분류") === selectedRelation;
    const matchesType = selectedType === "전체" || entry.type === selectedType;
    return matchesSearch && matchesRelation && matchesType;
  });

  // Theme-specific styles
  const badgeColor = (type: string) => {
    if (type === "ONLINE") {
      return isWedding ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-zinc-100 text-zinc-800 border-zinc-200";
    }
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const focusBorder = isWedding ? "focus:border-rose-400 focus:ring-rose-200" : "focus:border-zinc-500 focus:ring-zinc-200";

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="이름 또는 메모 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full h-11 rounded-2xl border border-border/80 pl-10 pr-4 text-sm outline-none focus:ring-4 transition-all bg-white ${focusBorder}`}
          />
        </div>

        {/* Filter select inputs */}
        <div className="flex gap-2">
          {/* Relation filter */}
          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedRelation}
              onChange={(e) => setSelectedRelation(e.target.value)}
              className={`w-full md:w-36 h-11 rounded-2xl border border-border/80 px-3.5 text-sm outline-none bg-white focus:ring-4 transition-all ${focusBorder}`}
            >
              <option value="전체">관계: 전체</option>
              {allRelations.filter(r => r !== "전체").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="relative flex-1 md:flex-none">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={`w-full md:w-36 h-11 rounded-2xl border border-border/80 px-3.5 text-sm outline-none bg-white focus:ring-4 transition-all ${focusBorder}`}
            >
              <option value="전체">구분: 전체</option>
              <option value="ONLINE">계좌 이체 (ONLINE)</option>
              <option value="OFFLINE">현금 (OFFLINE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table/List */}
      <div className="rounded-[1.5rem] border border-border/60 bg-white shadow-sm overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-muted-foreground">검색 조건에 맞는 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">이름</th>
                  <th className="px-6 py-4">관계</th>
                  <th className="px-6 py-4">구분</th>
                  <th className="px-6 py-4">메모</th>
                  <th className="px-6 py-4">등록일</th>
                  <th className="px-6 py-4 text-right">금액</th>
                  <th className="px-6 py-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {entry.senderName}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {entry.relation || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeColor(entry.type)}`}>
                        {entry.type === "ONLINE" ? "이체" : "현금"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">
                      {entry.message || "-"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {entry.paidAt ? entry.paidAt.split("T")[0] : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      {entry.amount.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => onEditClick(entry)}
                        className={`inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors ${
                          isWedding ? "hover:border-rose-300 hover:text-rose-700" : "hover:border-zinc-400 hover:text-zinc-900"
                        }`}
                      >
                        <Edit2 className="h-3 w-3" />
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
