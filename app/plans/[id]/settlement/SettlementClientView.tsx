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
    ? "bg-[#c4977a] hover:bg-[#b08569] text-white"
    : "bg-[#2c3455] hover:bg-[#1e2645] text-white";
  const accent = isWedding ? "text-[#c4977a]" : "text-[#5b6b86]";
  const titleText = isWedding ? "축의금 장부" : "조의금 장부";

  const onlineStat = summary.byType.find((t) => t.type === "ONLINE") || { amount: 0, count: 0 };
  const offlineStat = summary.byType.find((t) => t.type === "OFFLINE") || { amount: 0, count: 0 };

  return (
    <div className="animate-in fade-in space-y-10 duration-300">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex items-center gap-2 text-xs text-[#8c8275]">
          <Link href="/plans" className="transition-colors hover:text-[#2c3455]">내 행사 현황</Link>
          <span>/</span>
          <Link href={`/plans/${plan.id}`} className="max-w-[120px] truncate transition-colors hover:text-[#2c3455] sm:max-w-none">
            {plan.title}
          </Link>
          <span>/</span>
          <span className="font-medium text-[#2c3455]">{titleText}</span>
        </nav>

        <Link
          href={`/plans/${plan.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8c8275] transition-colors hover:text-[#2c3455]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          돌아가기
        </Link>
      </div>

      {/* Editorial header */}
      <header className="border-b border-[#e5e2da] pb-8">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${accent}`}>Account Book</p>
        <h1 className="mt-3 font-[var(--font-serif)] text-3xl font-normal tracking-tight text-[#2c3455] sm:text-4xl">
          {titleText}
        </h1>
        <p className="mt-3 text-sm text-[#8c8275]">{plan.title}</p>
      </header>

      {/* Quiet stats row */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-6 border-b border-[#e5e2da] pb-8 sm:grid-cols-4">
        <StatField label="총 건수" value={`${summary.totalCount}건`} />
        <StatField label="합계 금액" value={`${summary.totalAmount.toLocaleString()}원`} emphasis />
        <StatField label="이체" value={`${onlineStat.amount.toLocaleString()}원`} sub={`${onlineStat.count}건`} />
        <StatField label="현금" value={`${offlineStat.amount.toLocaleString()}원`} sub={`${offlineStat.count}건`} />
      </section>

      {/* Statistics Dashboard */}
      <SettlementDashboard summary={summary} eventType={eventType} />

      {/* Ledger Table */}
      <div className="border-t border-[#e5e2da] pt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h3 className="font-[var(--font-serif)] text-lg font-normal text-[#2c3455]">장부 내역</h3>
            <span className="text-xs tabular-nums text-[#8c8275]">총 {entries.length}건</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8c8275] transition-colors hover:text-[#2c3455]"
            >
              <Download className="h-3.5 w-3.5" />
              CSV 내보내기
            </button>
            <button
              onClick={handleOpenRegister}
              className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-semibold transition-[background-color] duration-200 ${registerBtnColor}`}
            >
              <Plus className="h-4 w-4" />
              내역 등록
            </button>
          </div>
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

function StatField({
  label,
  value,
  sub,
  emphasis = false
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8c8275]">{label}</p>
      <p
        className={`font-[var(--font-serif)] font-normal tabular-nums text-[#2c3455] ${
          emphasis ? "text-2xl" : "text-xl"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] tabular-nums text-[#8c8275]">{sub}</p>}
    </div>
  );
}
