type RecommendationInput = {
  budget?: number | null;
  guestCount?: number | null;
  region?: string | null;
  eventType?: string | null;
};

type RecommendationOutput = {
  budgetTier: "starter" | "balanced" | "premium";
  venueStyle: string;
  serviceFocus: string[];
  hostGuide: string;
  notes: string[];
};

export function generateMockAIRecommendation({
  budget,
  guestCount,
  region,
  eventType
}: RecommendationInput): RecommendationOutput {
  const normalizedBudget = budget ?? 0;
  const normalizedGuests = guestCount ?? 0;
  const budgetTier =
    normalizedBudget >= 5_000_000 ? "premium" : normalizedBudget >= 2_000_000 ? "balanced" : "starter";

  const venueStyle =
    normalizedGuests >= 200
      ? "대형 홀 또는 컨벤션"
      : normalizedGuests >= 80
        ? "중형 연회장"
        : "프라이빗 룸 또는 소규모 하우스";

  const serviceFocus =
    budgetTier === "premium"
      ? ["프리미엄 식음", "현장 운영 인력", "사진·영상 패키지"]
      : budgetTier === "balanced"
        ? ["공간 연출", "식음 구성", "모바일 초대장"]
        : ["필수 식음", "간소 장식", "셀프 운영 가이드"];

  const notes = [
    `${region ?? "수도권"} 기준으로 접근성과 주차 옵션을 우선 검토하세요.`,
    `${eventType ?? "행사"} 준비 단계에서는 일정·예산·초대 상태를 하나의 플랜에서 관리하는 편이 효율적입니다.`,
    normalizedGuests >= 120
      ? "하객 수가 많아 RSVP 추적과 좌석 계획 자동화가 특히 중요합니다."
      : "하객 규모가 크지 않아 개별 메시지와 맞춤형 안내를 함께 운영하기 좋습니다."
  ];

  return {
    budgetTier,
    venueStyle,
    serviceFocus,
    hostGuide:
      budgetTier === "premium"
        ? "브랜드 경험과 동선 완성도를 중심으로 업체 조합을 추천합니다."
        : budgetTier === "balanced"
          ? "예산과 만족도의 균형을 맞추는 구성으로 추천합니다."
          : "핵심 비용을 우선 확보하고 나머지는 유연하게 조정하는 구성을 추천합니다.",
    notes
  };
}
