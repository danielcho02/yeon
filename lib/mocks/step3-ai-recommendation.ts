import { EventType } from "@/generated/prisma/client";

type Step3RecommendationInput = {
  budget?: number | null;
  guestCount?: number | null;
  region?: string | null;
  eventType?: EventType | string | null;
  description?: string | null;
};

type Step3RecommendationOutput = {
  conceptTitle: string;
  budgetTier: "starter" | "balanced" | "premium";
  venueStyle: string;
  serviceFocus: string[];
  hostGuide: string;
  timeline: string[];
  notes: string[];
};

const eventTypeLabelMap: Record<string, string> = {
  WEDDING: "웨딩",
  FUNERAL: "장례",
  ETC: "경조사"
};

export function generateStep3MockAIRecommendation({
  budget,
  guestCount,
  region,
  eventType,
  description
}: Step3RecommendationInput): Step3RecommendationOutput {
  const normalizedBudget = budget ?? 0;
  const normalizedGuests = guestCount ?? 0;
  const normalizedRegion = region?.trim() || "수도권";
  const eventLabel =
    (eventType ? eventTypeLabelMap[eventType] : null) ?? "행사";

  const budgetTier =
    normalizedBudget >= 5_000_000 ? "premium" : normalizedBudget >= 2_000_000 ? "balanced" : "starter";

  const venueStyle =
    normalizedGuests >= 150
      ? `${normalizedRegion} 중심 대형 홀 + 동선 분리형 라운지`
      : normalizedGuests >= 70
        ? `${normalizedRegion} 중형 프라이빗 홀 + 포토존 집중형`
        : `${normalizedRegion} 소규모 프라이빗 공간 + 대화형 좌석 배치`;

  const serviceFocus =
    eventType === EventType.FUNERAL
      ? budgetTier === "premium"
        ? ["빈소 운영 동선", "의전 인력 배치", "조문 안내 패키지"]
        : budgetTier === "balanced"
          ? ["장례식장 운영 조율", "식음 및 접객 구성", "유가족 안내 체크"]
          : ["기본 빈소 대관", "핵심 의전 지원", "현장 체크리스트"]
      : budgetTier === "premium"
        ? ["프리미엄 공간 연출", "현장 운영 인력", "사진·영상 패키지"]
        : budgetTier === "balanced"
          ? ["공간 스타일링", "식음 구성", "하객 동선 안내"]
          : ["핵심 공간 대관", "간소 식음", "운영 체크리스트"];

  const timeline =
    eventType === EventType.FUNERAL
      ? [
          "상담 직후: 빈소, 의전, 접객 운영 가능 여부 우선 확인",
          "진행 전날: 조문 동선, 안내 인력, 식음 준비를 다시 점검",
          "당일: 유가족 부담을 줄이도록 현장 응대 역할을 명확히 분리"
        ]
      : [
          "행사 4주 전: 장소와 핵심 협력업체 우선 확정",
          "행사 2주 전: 게스트 규모와 좌석, 동선 다시 점검",
          "행사 3일 전: 공급사 최종 확인과 안내 메시지 발송"
        ];

  const notes = [
    `${normalizedRegion} 기준으로 이동 동선과 주차 접근성을 우선 확인하세요.`,
    normalizedGuests >= 100
      ? "게스트 수가 많아 RSVP 집계와 시간대별 입장 흐름 관리가 중요합니다."
      : "게스트 수가 비교적 적어 메시지 톤과 현장 응대 경험을 더 세밀하게 맞출 수 있습니다.",
    description?.trim()
      ? `기획 메모 반영 포인트: ${description.trim().slice(0, 60)}`
      : `${eventLabel} 목적에 맞는 핵심 순간을 먼저 정하고 예산을 배분하는 편이 안정적입니다.`
  ];

  return {
    conceptTitle: `${eventLabel} 맞춤 제안`,
    budgetTier,
    venueStyle,
    serviceFocus,
    hostGuide:
      budgetTier === "premium"
        ? "브랜드감과 현장 완성도를 함께 챙기는 조합으로 추천합니다."
        : budgetTier === "balanced"
          ? "예산과 만족도의 균형을 맞춘 현실적인 조합으로 추천합니다."
          : "핵심 비용을 우선 확보하고 나머지는 유연하게 조정하는 구성을 추천합니다.",
    timeline,
    notes
  };
}
