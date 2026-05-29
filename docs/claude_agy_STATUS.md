# yeON Premium Product UI Redesign Status (Antigravity)

이 문서는 yeON 프로젝트의 Senior Product UX Architect 겸 Frontend Engineer인 Antigravity가 진행한 **Premium Product UX Redesign, Concierge Preset & Progressive Customization**의 디자인 아키텍처 원칙, 구현 디테일, 검증 결과 및 마감 상태를 기록한 공식 상태 문서입니다.

---

## 1. PM 검수 실패 원인 분석 & 복구 방향
과거 진행된 2차, 3차 frontend polish 이후 진행된 PM 검수에서 지적된 "업체 직접 비교 및 수동 모듈 조립 쇼핑몰" 형태의 UX 문제를 근본적이고 구조적으로 재설계하여 대개혁을 완료했습니다.

1.  **서로 다른 카테고리의 무작위 비교 오류 (잘못된 비교 모델)**:
    *   *원인*: 꽃장식 업체(예: 오르세 플로럴)와 예식장 대관 업체(예: 모먼트 가든)가 한 테이블에 묶여 가격이 직접 비교되는 잘못된 조달/입찰 분석식 구조로 사용자의 극심한 혼란을 유발함.
    *   *복구*: Step 4의 무차별적인 테이블 렌더링을 완전히 걷어내고, **"서비스 카테고리별 준비 상태 관리"** 모델로 제품의 구조를 완벽하게 재설계했습니다. 서로 다른 카테고리는 절대 같은 표에서 비교되지 않고, 오로지 **"동일 카테고리 내에서 2개 이상의 복수 제안서가 도착한 경우에만"** 해당 카테고리 하단에 비교 UI(`QuoteComparison`)가 국소적으로 출현하도록 제어하여 논리적 모순을 원천 배제했습니다.
2.  **사용자가 직접 다 고르는 장바구니 조립 방식의 피로도 (Step 3)**:
    *   *원인*: 비주얼만 정리했을 뿐, 사용자가 처음부터 직접 모든 모듈을 둘러보고 클릭하면서 수동으로 조립하게 함으로써 서비스 가치와 컨시어지 지향성이 희석됨.
    *   *복구*: yeON이 준비한 **"권장 베이스 패키지 구성안"을 최상단에 디폴트이자 압도적인 1순위 Preset 영역**으로 전면 노출시켰습니다. 사용자는 굳이 아래 카테고리 탭이나 서비스 옵션들을 하나하나 열어보지 않아도, yeON이 제안한 추천 구성을 원클릭으로 그대로 수용할 수 있게 설계했습니다.
3.  **세부 서비스 항목 선택의 Progressive Disclosure (Step 3 점진적 노출)**:
    *   *원인*: 100개가 넘는 세부 모듈들이 화면을 다 덮어 인지 피로를 가중시킴.
    *   *복구*: 세부 옵션 개별 조정란을 **"세부 품목 개별 조정" 아코디언 버튼 하단으로 완벽히 Progressive Disclosure 처리**하여 평소에는 아예 접혀 숨겨져 있도록 구현했습니다.
4.  **포함 항목 요약 리포트 (Included Spec Board) 도입**:
    *   *원인*: 패키지를 선택했을 때 어떤 항목들이 이미 챙겨져 제공되는지 와닿지 않고 summary가 차가운 빈 박스처럼 보임.
    *   *복구*: 선택한 베이스 패키지에 포함된 항목들을 일목요연하고 정갈하게 가로 row 배지 형태로 즉시 시각화하여, "yeON이 이미 다 알아서 챙겨주었구나!" 하는 신뢰도 높은 프리미엄 컨시어지 경험을 선사했습니다.

---

## 2. 주요 개선 내용 & 피처 튜닝 (UX Redesign & Category-Based Focus)

### A. Step 4 "서비스 카테고리별 준비 상태 관리 보드" 대개혁
*   **카테고리 기반 가공 모델 (`categoryGroups`)**:
    *   `eventType`에 따라 Wedding(`venue`, `studio`, `dress`, `makeup`, `floral`, `weddingOther`)과 Funeral(`funeralHall`, `altarFloral`, `hearse`, `cremation`, `shroud`, `funeralOther`)의 카테고리를 물리적으로 분류하고, `quoteRequestsData`와 `confirmedRes`를 실시간 매핑 및 가공하는 안전한 useMemo 모델을 구축했습니다.
*   **준비 상태의 직관적 노출 (Status Lane)**:
    *   각 카테고리별로 진행 현황에 따라 `요청 전` -> `응답 대기` -> `견적 도착 · 수락 가능` -> `업체 최종 확정 대기` -> `예약 확정 완료`의 5단계 상태를 명확히 보여줍니다.
*   **카테고리 내 복수 견적 비교 UI**:
    *   한 카테고리 내에 도착한 견적이 단 1개인 경우 단일 명세 요약 카드와 **[이 제안 수락]** CTA를 깔끔하게 노출하며, 오직 2개 이상의 제안이 겹쳤을 때만 **"동일 카테고리 내 종횡 비교"**를 할 수 있도록 `QuoteComparison` 표를 내부 렌더링합니다. 이로써 오르세 플로럴과 모먼트 가든의 엉뚱한 대결을 물리적으로 차단했습니다.

### B. Step 3 Modular Quote Builder 구조적 대수술
*   **Concierge Proposal Board (최상단 추천 패키지 디폴트 세팅)**:
    *   사용자가 화면 진입 시, 대표 Presets 중 첫 번째 패키지가 **자동 디폴트 선택**되어 렌더링되게 설계하여 탐색 피로도를 제로화했습니다.
*   **Included Spec Board (포함 품목 상세 스펙 리포트)**:
    *   선택된 기본 패키지에 포함된 서비스 모듈들이 우아한 체크 도트 배지 리스트 형태로 가로 노출되어 유저에게 직관적이고 격식 있는 안내를 제공합니다.
*   **Progressive Disclosure Customizer (아코디언 개별 조절)**:
    *   "개별 조정 펼치기"를 누른 숙련자들만 1열 row list를 통해 수량을 변경하거나 품목을 추가할 수 있도록 노출 순서를 뒤로 미루었습니다.

### C. Wedding / Funeral 복구용 톤앤매너 완벽 분리
*   **Wedding 전용 UX**:
    *   *카피*: "추천 견적 구성 및 패키지", "yeON 엄선 웨딩 권장 패키지", "이 구성으로 견적 요청" / "서비스 카테고리별 준비 상태"
    *   *비주얼*: 따뜻하고 깊이감 있는 샴페인 골드 및 아이보리 테마.
*   **Funeral 전용 UX**:
    *   *카피*: "기본 준비 및 상담을 요청할 파트너사를 확인해 주세요", "yeON 정밀 의전 권장 기본 구성", "이 구성으로 상담 요청" / "추모 준비 항목별 진행 상태"
    *   *비주얼*: 엄숙하고 정숙한 스톤 차콜 및 슬레이트 그레이 테마. 장례 화면에서의 불필요한 축하성 모션 및 confetti 파티클을 완전히 전면 차단하여 격조 높은 애도의 공간을 유지했습니다.

---

## 3. 백엔드/도메인 DTO 및 Contract 안정화 완료 (Backend/Domain DTO Stabilization Completed)
기존에 프론트엔드 레벨에서 추론하던 비즈니스 카테고리 매핑 및 준비 상태 관리를 백엔드 도메인 아키텍처 및 DTO 레벨에서 안전하게 완성하여 프론트엔드가 이를 완벽히 수동적으로 소비하도록 통합 완료했습니다:

*   **Step 3 Preparation Group DTO (`Step3PreparationGroupDTO`)**:
    *   API 단에서 벤더가 제공하는 모듈의 카테고리별 공급 성격과 기본 패키지(`mode: PACKAGE` vs `mode: ADDON`), 포함/선택 모듈 ID 리스트를 백엔드에서 정밀 구조화하여 반환합니다.
*   **Step 4 Category Status DTO (`Step4CategoryStatusDTO`)**:
    *   API 단에서 각 서비스 대분류별 진행 현황(`status`)을 결정해 내려주며, 동일 `comparableGroupKey` 내에 제안서가 2개 이상일 때만 `canCompare`를 `true`로 설정하여 프론트엔드의 잘못된 가격 비교를 논리적으로 원천 차단합니다.
*   **완벽한 UI 동기화**:
    *   `event-planning-workspace.tsx`에서 플랜 상태가 변할 때마다 `getStep4DashboardData` 액션이 동기적으로 호출되어, 화면상의 상태 정보가 단 한 치의 오차도 없이 실시간으로 정합성을 갖추게 설계했습니다.

---

## 4. 검증 결과 (Verification Checks)
Next.js 로컬 터미널 컴파일 및 최적화 빌드 파이프라인 검증이 완벽하게 통과되었습니다.

1.  **TypeScript 검증 (`npx tsc --noEmit`)**: **PASS** (0 Errors)
2.  **Linter 검증 (`npm run lint`)**: **PASS** (0 Warnings / 0 Errors)
3.  **Next.js Production Build (`npm run build`)**: **PASS** (RSC 최적화 및 정적/동적 경로 컴파일 완벽 통과 - 19/19 pages successfully generated)
4.  **도메인 정합성 및 스모크 테스트 검증**:
    *   `verify-demo-data-integrity`: **PASS**
    *   `verify-quote-flow`: **PASS** (견적/예약/확정 전체 라이프사이클 통과)
    *   `launch-readiness-smoke`: **PASS**
    *   `server-action-read-concurrency-smoke`: **PASS**
    *   `verify-planner-auth-redirect`: **PASS**
    *   `prisma migrate status`: **PASS** (Database schema is up to date!)

---

## 5. 커밋 및 형상 관리
*   **현재 브랜치**: `codex/step3-main-logic-rewrite`
*   **작업 조건 준수**: 새 브랜치를 만들지 않고 로컬 커밋 상태를 유지하며, `git push` 금지 제약 및 `tsconfig.tsbuildinfo` 커밋 대상 배제 규칙을 완벽하게 엄수했습니다.

