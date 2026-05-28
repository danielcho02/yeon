"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type Recommendation = {
  name: string;
  category: string;
  region: string;
  price: number;
  highlight: string;
  tagline: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  {
    name: "루미에르 웨딩홀",
    category: "예식장 / 플로럴 연출",
    region: "서울 강남구",
    price: 4_800_000,
    highlight: "샴페인 톤 플라워 무드",
    tagline: "밝고 고급스러운 웨딩 연출에 강한 업체",
  },
  {
    name: "벨라테이블 케이터링",
    category: "뷔페 / 연회",
    region: "서울 서초구",
    price: 3_200_000,
    highlight: "테이블 세팅이 세련된 연회형 구성",
    tagline: "하객 응대와 음식 디스플레이가 안정적인 업체",
  },
  {
    name: "노블라이트 스튜디오",
    category: "촬영 / 미디어",
    region: "서울 마포구",
    price: 2_100_000,
    highlight: "드라마틱한 순간 포착",
    tagline: "영상과 사진을 함께 담는 시네마틱 스타일",
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function Spinner() {
  return (
    <div className="relative h-16 w-16">
      <div className="absolute inset-0 rounded-full border-4 border-amber-100/60" />
      <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-primary/60 border-b-transparent border-l-transparent animate-spin" />
      <div className="absolute inset-3 rounded-full bg-white shadow-inner" />
    </div>
  );
}

function RecommendationCard({ item, index }: { item: Recommendation; index: number }) {
  return (
    <article className="animate-fade-in rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_50px_-32px_rgba(60,45,30,0.35)]" style={{ animationDelay: `${index * 120}ms` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">추천 업체</p>
          <h3 className="mt-1 font-[var(--font-display)] text-xl font-semibold text-foreground">{item.name}</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {formatMoney(item.price)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200/70">
          {item.category}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {item.region}
        </span>
      </div>

      <p className="mt-4 text-sm font-semibold text-foreground">{item.highlight}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.tagline}</p>
    </article>
  );
}

export function AiWeddingRecommendationDemo() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const estimatedTotal = useMemo(
    () => RECOMMENDATIONS.reduce((sum, item) => sum + item.price, 0),
    []
  );

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsLoading(false);
      setHasResult(true);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [isLoading]);

  function handleGenerate() {
    setHasResult(false);
    setIsLoading(true);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,245,233,0.92),_transparent_28%),linear-gradient(180deg,#fffdf9_0%,#f8f1ea_45%,#efe7de_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-amber-200/60 bg-white/85 p-6 shadow-[0_24px_70px_-36px_rgba(60,45,30,0.35)] backdrop-blur sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle, #c47b45 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-700/70">AI Wedding Recommendation</p>
              <h1 className="font-[var(--font-display)] text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
                AI 웨딩 추천 데모
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                실제 AI API를 호출하지 않고도, 분석 중 로딩 연출과 추천 결과 화면이 자연스럽게 이어지도록 만든
                시연용 페이지입니다.
              </p>
            </div>

            <Button onClick={handleGenerate} size="lg" className="shrink-0">
              AI에게 추천 생성하기
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(60,45,30,0.35)] sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">AI 분석 상태</p>
            <h2 className="mt-1 font-[var(--font-display)] text-xl font-semibold text-foreground">추천 생성 흐름</h2>

            <div className="mt-6 rounded-[1.75rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,244,239,0.92))] p-6">
              {isLoading ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center text-center animate-fade-in">
                  <Spinner />
                  <p className="mt-6 text-sm font-semibold text-foreground">
                    유저님의 조건을 바탕으로 맞춤형 업체를 AI가 분석 중입니다...
                  </p>
                  <p className="mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                    예식 분위기, 예산, 지역, 선호 서비스를 종합해 가장 어울리는 업체를 정리하고 있어요.
                  </p>
                </div>
              ) : hasResult ? (
                <div className="animate-fade-in">
                  <div className="rounded-[1.5rem] bg-emerald-50/70 p-4 ring-1 ring-emerald-200/70">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700/70">AI 분석 완료</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      추천 가능한 웨딩 업체 3곳을 추렸습니다. 아래 카드에서 분위기와 견적을 확인해 보세요.
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-[1.25rem] bg-muted/40 px-4 py-3">
                      <span className="text-sm text-muted-foreground">예상 총 견적</span>
                      <strong className="text-lg font-extrabold tracking-[-0.03em] text-foreground">
                        {formatMoney(estimatedTotal)}
                      </strong>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                      <div className="rounded-[1.25rem] bg-white px-3 py-3 ring-1 ring-border/60">
                        맞춤 분석
                      </div>
                      <div className="rounded-[1.25rem] bg-white px-3 py-3 ring-1 ring-border/60">
                        웨딩 무드
                      </div>
                      <div className="rounded-[1.25rem] bg-white px-3 py-3 ring-1 ring-border/60">
                        견적 정리
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
                    <span className="text-2xl">✨</span>
                  </div>
                  <p className="mt-5 text-sm font-semibold text-foreground">추천 생성 준비 완료</p>
                  <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
                    버튼을 누르면 3초 동안 분석 중 화면이 나온 뒤, 추천 업체와 총 견적이 부드럽게 등장합니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(60,45,30,0.35)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">추천 결과</p>
                <h2 className="mt-1 font-[var(--font-display)] text-xl font-semibold text-foreground">
                  추천 업체 카드 리스트
                </h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/70">
                총 {formatMoney(estimatedTotal)}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {hasResult ? (
                RECOMMENDATIONS.map((item, index) => (
                  <RecommendationCard key={item.name} item={item} index={index} />
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-white/60 p-8 text-center text-sm text-muted-foreground">
                  아직 추천 결과가 없습니다. 버튼을 눌러 AI 분석을 시작하세요.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}