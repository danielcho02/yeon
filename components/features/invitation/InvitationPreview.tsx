import type { WeddingCardContent } from "@/types/invitation";

export function InvitationPreview({ content }: { content: WeddingCardContent }) {
  const displayDate = content.date
    ? new Date(content.date).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    : "";

  return (
    <div className="min-h-[600px] w-full bg-[#fff7ed] px-6 py-10 font-[var(--font-serif)]">
      {content.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.imageUrl}
            alt="대표 이미지"
            className="w-full object-cover"
            style={{ maxHeight: "200px" }}
          />
        </div>
      )}

      <div className="mb-8 text-center">
        <div className="mb-2 text-2xl text-rose-300">✿</div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300">
          Wedding Invitation
        </p>
      </div>

      <div className="mb-8 text-center">
        <p className="mb-1 text-xs text-stone-400">
          {content.groomFamilyDesc && <span>{content.groomFamilyDesc} · </span>}
          <span className="font-semibold text-stone-600">{content.groomName || "신랑"}</span>
        </p>
        <div className="my-3 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-rose-200" />
          <span className="text-rose-300">♡</span>
          <span className="h-px w-10 bg-rose-200" />
        </div>
        <p className="text-xs text-stone-400">
          {content.brideFamilyDesc && <span>{content.brideFamilyDesc} · </span>}
          <span className="font-semibold text-stone-600">{content.brideName || "신부"}</span>
        </p>
      </div>

      {content.greeting && (
        <div className="mb-8 rounded-2xl bg-white/60 px-5 py-4">
          <p className="whitespace-pre-wrap text-center text-xs leading-6 text-stone-600">
            {content.greeting}
          </p>
        </div>
      )}

      <div className="mb-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Date</p>
        <p className="mt-1 text-sm font-semibold text-stone-700">
          {displayDate || "날짜 미입력"}
          {content.time && <span className="ml-2 text-stone-500">{content.time}</span>}
        </p>
      </div>

      <div className="mb-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Venue</p>
        <p className="mt-1 text-sm font-semibold text-stone-700">{content.venue || "장소 미입력"}</p>
        {content.venueAddress && (
          <p className="mt-0.5 text-xs text-stone-400">{content.venueAddress}</p>
        )}
      </div>

      {(content.contactInfo || content.accountInfo) && (
        <div className="mt-6 space-y-3">
          {content.contactInfo && (
            <div className="rounded-xl bg-white/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Contact</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{content.contactInfo}</p>
            </div>
          )}
          {content.accountInfo && (
            <div className="rounded-xl bg-white/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300">마음 전하기</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">{content.accountInfo}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center text-lg text-rose-200">✿ ✿ ✿</div>
    </div>
  );
}
