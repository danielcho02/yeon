"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { uploadMobileCardImage } from "@/app/actions/invitation";
import type { WeddingCardContent } from "@/types/invitation";

interface InvitationFormProps {
  planId: string;
  cardId?: string;
  initialContent?: Partial<WeddingCardContent>;
  onSave: (cardId: string | undefined, content: WeddingCardContent) => Promise<{ success: boolean; error?: string }>;
}

export function InvitationForm({ planId, cardId, initialContent = {}, onSave }: InvitationFormProps) {
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
    const content: WeddingCardContent = {
      groomName: fd.get("groomName") as string,
      brideName: fd.get("brideName") as string,
      groomFamilyDesc: (fd.get("groomFamilyDesc") as string) || undefined,
      brideFamilyDesc: (fd.get("brideFamilyDesc") as string) || undefined,
      date: fd.get("date") as string,
      time: (fd.get("time") as string) || undefined,
      venue: fd.get("venue") as string,
      venueAddress: (fd.get("venueAddress") as string) || undefined,
      greeting: (fd.get("greeting") as string) || undefined,
      contactInfo: (fd.get("contactInfo") as string) || undefined,
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
      <div className="rounded-xl border border-rose-200/60 bg-white p-4">
        <label className="mb-2 block text-xs font-semibold text-stone-600">대표 이미지</label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
          {isUploading ? "업로드 중..." : "이미지 선택"}
        </label>
        <p className="mt-1 text-[10px] text-stone-400">JPG · PNG · WebP · 최대 5MB</p>
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="대표 이미지 미리보기"
            className="mt-3 max-h-40 w-full overflow-hidden rounded-xl object-cover"
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="신랑 이름 *" name="groomName" defaultValue={initialContent.groomName} placeholder="홍길동" required />
        <Field label="신부 이름 *" name="brideName" defaultValue={initialContent.brideName} placeholder="김영희" required />
        <Field label="신랑 가족 소개" name="groomFamilyDesc" defaultValue={initialContent.groomFamilyDesc} placeholder="홍판서·이씨의 장남" />
        <Field label="신부 가족 소개" name="brideFamilyDesc" defaultValue={initialContent.brideFamilyDesc} placeholder="김부장·박씨의 장녀" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="날짜 *" name="date" type="date" defaultValue={initialContent.date} required />
        <Field label="시간" name="time" defaultValue={initialContent.time} placeholder="오후 2시 30분" />
      </div>

      <Field label="장소 *" name="venue" defaultValue={initialContent.venue} placeholder="그랜드 웨딩홀" required />
      <Field label="장소 주소" name="venueAddress" defaultValue={initialContent.venueAddress} placeholder="서울시 강남구 테헤란로 123" />

      <TextareaField label="인사말" name="greeting" defaultValue={initialContent.greeting} placeholder="저희 두 사람의 작은 결실을 함께해 주세요..." rows={4} />
      <TextareaField label="연락처 안내" name="contactInfo" defaultValue={initialContent.contactInfo} placeholder={"신랑: 010-0000-0000\n신부: 010-0000-0000"} rows={3} />
      <TextareaField label="계좌 안내" name="accountInfo" defaultValue={initialContent.accountInfo} placeholder="신한은행 110-000-000000 홍길동" rows={3} />

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
          className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
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
      <label className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-rose-200/60 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200"
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
      <label className="mb-1.5 block text-xs font-semibold text-stone-600">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-rose-200/60 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-300 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-200"
      />
    </div>
  );
}
