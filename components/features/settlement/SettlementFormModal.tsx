"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { SettlementEntryData, SettlementMethod } from "@/types/settlement";

interface SettlementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    senderName: string;
    amount: number;
    relation: string;
    message?: string;
    type: SettlementMethod;
    paidAt: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  entry?: SettlementEntryData | null;
  eventType: "WEDDING" | "FUNERAL";
}

export function SettlementFormModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  entry,
  eventType
}: SettlementFormModalProps) {
  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState("");
  const [relation, setRelation] = useState("");
  const [customRelation, setCustomRelation] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<SettlementMethod>("OFFLINE");
  const [paidAt, setPaidAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isWedding = eventType === "WEDDING";
  const defaultRelations = useMemo(() => {
    return isWedding
      ? ["가족", "친척", "신랑친구", "신부친구", "직장동료", "기타"]
      : ["가족", "친척", "친구", "직장동료", "지인", "기타"];
  }, [isWedding]);

  useEffect(() => {
    if (entry) {
      setSenderName(entry.senderName);
      setAmount(entry.amount.toString());
      if (defaultRelations.includes(entry.relation || "")) {
        setRelation(entry.relation || "");
        setCustomRelation("");
      } else {
        setRelation("기타");
        setCustomRelation(entry.relation || "");
      }
      setMessage(entry.message || "");
      setType(entry.type);
      setPaidAt(entry.paidAt ? entry.paidAt.split("T")[0] : new Date().toISOString().split("T")[0]);
    } else {
      setSenderName("");
      setAmount("");
      setRelation(defaultRelations[0]);
      setCustomRelation("");
      setMessage("");
      setType("OFFLINE");
      setPaidAt(new Date().toISOString().split("T")[0]);
    }
    setShowDeleteConfirm(false);
  }, [entry, isOpen, defaultRelations]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) return alert("이름을 입력해 주세요.");
    if (!amount || parseInt(amount) <= 0) return alert("금액을 올바르게 입력해 주세요.");

    const finalRelation = relation === "기타" ? customRelation.trim() || "기타" : relation;

    setIsSubmitting(true);
    try {
      await onSubmit({
        senderName: senderName.trim(),
        amount: parseInt(amount),
        relation: finalRelation,
        message: message.trim() || undefined,
        type,
        paidAt
      });
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      alert(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Theme-specific styles
  const modalHeaderBg = isWedding ? "bg-rose-50 text-rose-950" : "bg-zinc-100 text-zinc-900";
  const submitBtnBg = isWedding
    ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
    : "bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-900";
  const focusBorder = isWedding ? "focus:border-rose-400 focus:ring-rose-200" : "focus:border-zinc-500 focus:ring-zinc-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.5rem] bg-white shadow-xl transition-all duration-200">
        {showDeleteConfirm ? (
          <div className="p-6 text-center">
            <h3 className="text-lg font-bold text-foreground mb-2">정말 삭제하시겠습니까?</h3>
            <p className="text-sm text-muted-foreground mb-6">삭제된 정산 내역은 복구할 수 없습니다.</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-5 text-sm font-semibold hover:bg-muted transition-colors"
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-5 text-sm font-semibold transition-colors"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "삭제 중..." : "확인 및 삭제"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${modalHeaderBg}`}>
              <h2 className="text-base font-bold">
                {entry ? (isWedding ? "축의금 내역 수정" : "조의금 내역 수정") : (isWedding ? "축의금 등록" : "조의금 등록")}
              </h2>
              <button
                type="button"
                className="rounded-lg p-1 hover:bg-black/5 transition-colors"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {/* 이름 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">이름</label>
                <input
                  type="text"
                  required
                  placeholder="보낸 사람 이름"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className={`w-full h-11 rounded-2xl border border-border/80 px-4 text-sm outline-none focus:ring-4 transition-all ${focusBorder}`}
                />
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">금액 (원)</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="금액을 입력하세요"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full h-11 rounded-2xl border border-border/80 px-4 text-sm outline-none focus:ring-4 transition-all ${focusBorder}`}
                />
              </div>

              {/* 관계 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">관계</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    className={`h-11 rounded-2xl border border-border/80 px-3 text-sm outline-none bg-white focus:ring-4 transition-all ${focusBorder}`}
                  >
                    {defaultRelations.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {relation === "기타" && (
                    <input
                      type="text"
                      placeholder="관계 직접 입력"
                      value={customRelation}
                      onChange={(e) => setCustomRelation(e.target.value)}
                      className={`h-11 rounded-2xl border border-border/80 px-4 text-sm outline-none focus:ring-4 transition-all ${focusBorder}`}
                    />
                  )}
                </div>
              </div>

              {/* 입금수단 (ONLINE / OFFLINE) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">구분</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="settlementType"
                      checked={type === "OFFLINE"}
                      onChange={() => setType("OFFLINE")}
                      className={`h-4 w-4 border-gray-300 text-rose-600 focus:ring-rose-500`}
                    />
                    현금 (OFFLINE)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="settlementType"
                      checked={type === "ONLINE"}
                      onChange={() => setType("ONLINE")}
                      className={`h-4 w-4 border-gray-300 text-rose-600 focus:ring-rose-500`}
                    />
                    계좌 이체 (ONLINE)
                  </label>
                </div>
              </div>

              {/* 등록일 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">등록일</label>
                <input
                  type="date"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className={`w-full h-11 rounded-2xl border border-border/80 px-4 text-sm outline-none focus:ring-4 transition-all bg-white ${focusBorder}`}
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">메모 (선택)</label>
                <input
                  type="text"
                  placeholder="기타 메모 사항"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`w-full h-11 rounded-2xl border border-border/80 px-4 text-sm outline-none focus:ring-4 transition-all ${focusBorder}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 px-6 py-4 bg-muted/20">
              {entry && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition-all hover:bg-rose-50 hover:border-rose-300"
                >
                  삭제
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold hover:bg-muted transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex h-11 items-center justify-center rounded-2xl text-white px-5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${submitBtnBg}`}
                >
                  {isSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
