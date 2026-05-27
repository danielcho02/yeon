import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { UserRole } from "@/generated/prisma/client";
import { getServerAuthSession } from "@/lib/auth/session";
import {
  mvpEventTypeOptions,
  parseMvpQuoteEventType
} from "@/lib/step3.shared";
import { createPlan } from "../actions";
import { PlanWizardClient } from "./plan-wizard-client";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/plans/new");
  if (session.user.role === UserRole.VENDOR) redirect("/vendor/dashboard");
  const params = await searchParams;
  const contextType = parseMvpQuoteEventType(params?.type);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8">
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-foreground">새 플랜 만들기</h1>
          <p className="mt-1 text-sm text-muted-foreground">경조사 정보를 입력해주세요</p>
        </div>

        {/* Step-by-step wizard when event type is known */}
        {contextType && (
          <PlanWizardClient eventType={contextType} />
        )}

        {/* Fallback flat form when no type provided */}
        {!contextType && (
        <form action={createPlan} className="rounded-3xl border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
          <div className="space-y-5">
            {/* 행사 유형 */}
            {contextType ? (
              <input name="type" type="hidden" value={contextType} />
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  행사 유형 <span className="text-rose-500">*</span>
                </label>
                <select
                  name="type"
                  required
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {mvpEventTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 제목 */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">
                플랜 제목 <span className="text-rose-500">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder={contextType === "FUNERAL" ? "예: 가족 장례 준비" : "예: 2026년 봄 웨딩 준비"}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* 예정일 */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">예정일</label>
              <input
                name="scheduledAt"
                type="date"
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* 예산 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">예산 (원)</label>
                <input
                  name="budget"
                  type="number"
                  min={0}
                  placeholder="30000000"
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* 목표 하객 수 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">목표 하객 수</label>
                <input
                  name="guestTarget"
                  type="number"
                  min={0}
                  placeholder="200"
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* 주최자 이름 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">주최자 이름</label>
                <input
                  name="hostName"
                  type="text"
                  placeholder="예: 홍길동"
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* 지역 */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">지역</label>
                <input
                  name="region"
                  type="text"
                  placeholder="예: 서울 강남구"
                  className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* 장소명 */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">장소명</label>
              <input
                name="venueName"
                type="text"
                placeholder="예: 그랜드 워커힐 서울"
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">메모</label>
              <textarea
                name="description"
                rows={4}
                placeholder="준비 사항이나 특이 사항을 자유롭게 적어주세요"
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="mt-7 flex items-center justify-end gap-3">
            <a href="/plans" className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted">
              취소
            </a>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              플랜 만들기
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}
