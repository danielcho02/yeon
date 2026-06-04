"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { uploadMobileCardImage } from "@/app/actions/invitation";
import type { FuneralCardContent } from "@/types/invitation";

interface ObituaryFormProps {
  planId: string;
  cardId?: string;
  initialContent?: Partial<FuneralCardContent>;
  onSave: (cardId: string | undefined, content: FuneralCardContent) => Promise<{ success: boolean; error?: string }>;
}

export function ObituaryForm({ planId, cardId, initialContent = {}, onSave }: ObituaryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(initialContent.imageUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadMobileCardImage(fd);
    if (result.success) {
      setImageUrl(result.data.imageUrl);
    } else {
      alert(result.error ?? "이미지 업로드에 실패했습니다.");
    }
    setIsUploading(false);
    e.target.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const content: FuneralCardContent = {
      deceasedName: fd.get("deceasedName") as string,
      funeralHall: fd.get("funeralHall") as string,
      funeralHallAddress: (fd.get("funeralHallAddress") as string) || undefined,
      departureDatetime: (fd.get("departureDatetime") as string) || undefined,
      burialPlace: (fd.get("burialPlace") as string) || undefined,
      chiefMourners: (fd.get("chiefMourners") as string) || undefined,
      visitingHours: (fd.get("visitingHours") as string) || undefined,
      visitingInfo: (fd.get("visitingInfo") as string) || undefined,
      accountInfo: (fd.get("accountInfo") as string) || undefined,
      imageUrl: imageUrl || undefined,
    };

    startTransition(async () => {
      const result = await onSave(cardId, content);
      if (result.success) {
        router.push(`/plans/${planId}/mobile-card`);
      } else {
        alert(result.error ?? "저장 중 오류가 발생했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 대표 이미지 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-xs font-semibold text-slate-600">대표 이미지</label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
          {isUploading ? "업로드 중..." : "이미지 선택"}
        </label>
        <p className="mt-1 text-[10px] text-slate-400">JPG · PNG · WebP · 최대 5MB</p>
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="대표 이미지 미리보기"
            className="mt-3 max-h-40 w-full overflow-hidden rounded-xl object-cover"
          />
        )}
      </div>

      <Field label="고인 성함 *" name="deceasedName" defaultValue={initialContent.deceasedName} placeholder="홍길동" required />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="장례식장 *" name="funeralHall" defaultValue={initialContent.funeralHall} placeholder="서울아산병원 장례식장" required />
        <Field label="장례식장 주소" name="funeralHallAddress" defaultValue={initialContent.funeralHallAddress} placeholder="서울시 송파구 올림픽로 43길" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="발인 일시" name="departureDatetime" type="datetime-local" defaultValue={initialContent.departureDatetime?.slice(0, 16)} />
        <Field label="장지" name="burialPlace" defaultValue={initialContent.burialPlace} placeholder="경기도 용인시 ○○추모공원" />
      </div>

      <TextareaField label="상주" name="chiefMourners" defaultValue={initialContent.chiefMourners} placeholder={"아들 홍길동\n딸 홍순희"} rows={2} />
      <Field label="조문 시간" name="visitingHours" defaultValue={initialContent.visitingHours} placeholder="오전 9시 ~ 오후 10시" />
      <TextareaField label="조문 안내" name="visitingInfo" defaultValue={initialContent.visitingInfo} placeholder="주차 가능합니다..." rows={3} />
      <TextareaField label="부의금 안내" name="accountInfo" defaultValue={initialContent.accountInfo} placeholder="국민은행 000-000-000000 홍길동" rows={3} />

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/40"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="flex-1 rounded-xl bg-slate-700 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, name, defaultValue, placeholder, required, type = "text",
}: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
      />
    </div>
  );
}

function TextareaField({
  label, name, defaultValue, placeholder, rows = 3,
}: {
  label: string; name: string; defaultValue?: string; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
      />
    </div>
  );
}
