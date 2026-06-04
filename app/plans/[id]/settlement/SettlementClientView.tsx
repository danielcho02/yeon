"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowLeft, Download } from "lucide-react";
import type { SettlementEntryData, SettlementSummary } from "@/types/settlement";
import { SettlementDashboard } from "@/components/features/settlement/SettlementDashboard";
import { SettlementLedger } from "@/components/features/settlement/SettlementLedger";
import { SettlementFormModal } from "@/components/features/settlement/SettlementFormModal";
import {
  createSettlementEntry,
  updateSettlementEntry,
  deleteSettlementEntry,
  getSettlementSummary,
  getSettlementEntries
} from "@/app/actions/settlement";

interface SettlementClientViewProps {
  plan: { id: string; title: string; type: string };
  initialEntries: SettlementEntryData[];
  initialSummary: SettlementSummary;
}

export function SettlementClientView({
  plan,
  initialEntries,
  initialSummary
}: SettlementClientViewProps) {
  const [entries, setEntries] = useState<SettlementEntryData[]>(initialEntries);
  const [summary, setSummary] = useState<SettlementSummary>(initialSummary);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SettlementEntryData | null>(null);

  const isWedding = plan.type === "WEDDING";
  const eventType = isWedding ? ("WEDDING" as const) : ("FUNERAL" as const);

  // Refresh helper
  const refreshData = async () => {
    const entriesRes = await getSettlementEntries(plan.id);
    const summaryRes = await getSettlementSummary(plan.id);
    if (entriesRes.success) setEntries(entriesRes.data);
    if (summaryRes.success) setSummary(summaryRes.data);
  };

  const handleOpenRegister = () => {
    setSelectedEntry(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entry: SettlementEntryData) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: {
    senderName: string;
    amount: number;
    relation: string;
    message?: string;
    type: "ONLINE" | "OFFLINE";
    paidAt: string;
  }) => {
    if (selectedEntry) {
      // Update
      const res = await updateSettlementEntry(selectedEntry.id, data);
      if (!res.success) {
        throw new Error(res.error || "수정에 실패했습니다.");
      }
    } else {
      // Create
      const res = await createSettlementEntry({
        planId: plan.id,
        ...data
      });
      if (!res.success) {
        throw new Error(res.error || "등록에 실패했습니다.");
      }
    }
    await refreshData();
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    const res = await deleteSettlementEntry(selectedEntry.id);
    if (!res.success) {
      throw new Error(res.error || "삭제에 실패했습니다.");
    }
    await refreshData();
  };

  // CSV Export
  const handleExportCSV = () => {
    if (entries.length === 0) {
      alert("다운로드할 내역이 없습니다.");
      return;
    }
    const headers = ["이름", "관계", "금액", "구분", "메모", "등록일"];
    const rows = entries.map((e) => [
      e.senderName,
      e.relation || "",
      e.amount,
      e.type === "ONLINE" ? "이체" : "현금",
      e.message || "",
      e.paidAt ? e.paidAt.split("T")[0] : ""
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `${plan.title.replace(/\s+/g, "_")}_정산장부.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Styling theme classes
  const registerBtnColor = isWedding
    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100"
    : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-100";
  const titleText = isWedding ? "축의금 정산 장부" : "조의금 정산 장부";
  const planSubtitle = isWedding ? "웨딩 정산 대시보드" : "장례 조의금 정산 대시보드";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/plans" className="hover:text-foreground transition-colors">내 플랜</Link>
          <span>/</span>
          <Link href={`/plans/${plan.id}`} className="hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-none">
            {plan.title}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{titleText}</span>
        </nav>

        <Link
          href={`/plans/${plan.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          플랜 상세로 돌아가기
        </Link>
      </div>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground sm:text-3xl tracking-tight">
            {titleText}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {planSubtitle} &middot; {plan.title}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200"
          >
            <Download className="h-4 w-4" />
            CSV 내보내기
          </button>

          {/* Add Entry Button */}
          <button
            onClick={handleOpenRegister}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl px-5 text-sm font-semibold shadow-md transition-all duration-200 ${registerBtnColor}`}
          >
            <Plus className="h-4 w-4" />
            내역 등록
          </button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <SettlementDashboard summary={summary} eventType={eventType} />

      {/* Ledger Table */}
      <div className="pt-4 border-t border-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[var(--font-display)] text-base font-semibold text-foreground">장부 내역</h3>
          <span className="text-xs text-muted-foreground font-medium">총 {entries.length}건</span>
        </div>

        <SettlementLedger
          entries={entries}
          onEditClick={handleOpenEdit}
          eventType={eventType}
        />
      </div>

      {/* Form Modal for Registering and Editing */}
      <SettlementFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={selectedEntry ? handleDelete : undefined}
        entry={selectedEntry}
        eventType={eventType}
      />
    </div>
  );
}
