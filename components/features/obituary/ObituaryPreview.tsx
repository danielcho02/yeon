import type { FuneralCardContent } from "@/types/invitation";

export function ObituaryPreview({ content }: { content: FuneralCardContent }) {
  const displayDeparture = content.departureDatetime
    ? new Date(content.departureDatetime).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="min-h-[600px] w-full bg-[#f8fafc] px-6 py-10 font-[var(--font-serif)]">
      {content.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.imageUrl}
            alt="대표 이미지"
            className="w-full object-cover"
            style={{ maxHeight: "180px" }}
          />
        </div>
      )}

      <div className="mb-8 border-b border-slate-200 pb-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          부 고
        </p>
        <p className="mt-3 text-xl font-light text-slate-700">
          {content.deceasedName ? (
            <>
              <span className="font-semibold">{content.deceasedName}</span>
              <span className="ml-1 text-base">님의 별세를 삼가 알립니다</span>
            </>
          ) : (
            <span className="text-slate-400">고인 성함 미입력</span>
          )}
        </p>
      </div>

      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">빈소</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{content.funeralHall || "장례식장 미입력"}</p>
        {content.funeralHallAddress && (
          <p className="mt-0.5 text-xs text-slate-500">{content.funeralHallAddress}</p>
        )}
      </div>

      {displayDeparture && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">발인</p>
          <p className="mt-1 text-sm text-slate-700">{displayDeparture}</p>
        </div>
      )}

      {content.burialPlace && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">장지</p>
          <p className="mt-1 text-sm text-slate-700">{content.burialPlace}</p>
        </div>
      )}

      {(content.visitingHours || content.visitingInfo) && (
        <div className="mb-5 rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">조문 안내</p>
          {content.visitingHours && (
            <p className="mt-1 text-xs text-slate-600">조문 시간: {content.visitingHours}</p>
          )}
          {content.visitingInfo && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{content.visitingInfo}</p>
          )}
        </div>
      )}

      {content.chiefMourners && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">상주</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{content.chiefMourners}</p>
        </div>
      )}

      {content.accountInfo && (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">부의금 안내</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{content.accountInfo}</p>
        </div>
      )}

      <div className="mt-10 border-t border-slate-100 pt-6 text-center">
        <p className="text-[10px] tracking-widest text-slate-300">삼가 고인의 명복을 빕니다</p>
      </div>
    </div>
  );
}
