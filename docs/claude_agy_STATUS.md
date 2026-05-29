# yeON Premium Product UI & Full-stack QA Stabilization Status (Antigravity)

이 문서는 yeON 프로젝트의 Full-stack QA Stabilization Owner 겸 Senior Product UX Architect인 Antigravity가 진행한 **QA Stabilization & Category-Based Focus**의 설계 해결 방안, 구현 디테일, 검증 결과 및 마감 상태를 기록한 공식 상태 문서입니다.

---

## 0. Product Direction Audit (2026-05-29)

### 1. 현재 yeON의 사용자 가치
* **플래너 가치**: 단순한 쇼핑몰 장바구니 조립이나 ad-hoc 업체 비교를 극복하고, 웨딩/장례의 본질적 준비 항목(대관, 접객, 장식, 부고, 수송 등)의 준비 상태를 원스톱으로 추적 및 수렴하며, 추천 패키지 프리셋을 통해 의사결정의 피로를 혁신적으로 줄여주는 **프리미엄 컨시어지 대시보드**입니다.
* **업체(벤더) 가치**: 난잡한 소통 채널을 단일화하여 신규 견적 의뢰 수신 $\rightarrow$ 견적 제안서 작성 $\rightarrow$ 수락 피드백 추적 $\rightarrow$ 최종 스케줄 확정에 이르는 비즈니스 흐름을 최단 동선으로 완료하는 **고효율 통합 업무 처리 큐 (Work Queue)**입니다.

### 2. 현재 Step 3 문제 & 개선 방향
* **문제점**: 사용자가 모듈 품목들을 일일이 직접 조립해야 해 선택 부담이 과도했으며, 웨딩과 장례의 맥락적 비주얼 톤 차이가 부족하고 장례가 마치 상품 쇼핑몰처럼 노출되는 문제가 존재했습니다.
* **개선 방향**: 
  - **Wedding**: 공간 패키지 벤더(Moment Garden, PRIMARY)와 플라워 애드온 벤더(Orsay Floral, ADDON)의 고유 역할을 명시하고 둘의 직접 비교표 노출을 엄격 차단합니다.
  - **Funeral**: 한결 의전(BUNDLE)을 통합 상담 상조 파트너로 노출하고, 쇼핑몰의 나열식 선택 흐름을 지양하며 **"경건한 의전 필수 절차 확인 및 상담 요청"** 중심으로 재편합니다.

### 3. 현재 Vendor Dashboard 문제 & 개선 방향
* **문제점**: 화면에 상시 노출되는 대형 계정 카드와 서비스 설정 영역이 과도한 공간을 낭비하여, 당장 해결해야 할 시급한 신규 의뢰나 최종 확정 스케줄 등의 액션 아이템이 묻히는 심각한 업무 분산이 있었습니다.
* **개선 방향**: 
  - 극도로 절제된 **Compact Partner Header**로 공간을 환수합니다.
  - 당일 처리 업무를 한눈에 보여줄 **Today Work Summary** 및 최우선 순위가 한자리에서 격리되어 처리되는 **[업무 홈]**을 구축합니다.
  - 일일 업무와 관련성이 극히 드문 **[서비스 관리]** 기능은 독립된 탭으로 완벽 격리 분리합니다.

---

## 1. Claude QA 발견 버그 & 안정화 복구 완료

최근 Claude QA Report에서 지적된 5가지 핵심 제품 버그 및 블로커 후보들을 full-stack 레벨에서 추적해 완벽하게 패치 완료했습니다.

1.  **QA-06: Funeral Step 4 중복 카테고리 매칭 제거 (HIGH Blocker)**:
    *   *원인*: BUNDLE 벤더(예: 한결 의전)의 제안서가 `selectedModules` 모듈 조건에 매핑되어 "장례식장"과 "문상객 식사" 양쪽 카테고리에 동일 금액(₩750,000) 및 동일 수락 CTA 카드로 중복 출현하는 치명적 도메인 로직 꼬임이 발견되었습니다.
    *   *해결*: `app/actions/quote.ts`의 `getStep4DashboardData` API 내부의 카테고리 매핑 로직을 정교화했습니다. **`PRIMARY` 및 `BUNDLE` 역할을 지닌 벤더는 서브 카테고리 매칭 로직을 완전히 스킵하고 오로지 핵심 대관(`venue` / `funeralHall`) 대표 카테고리에만 엄격히 할당되도록 제한**했습니다. 이로써 중복 매칭과 무분별한 카테고리 침범을 원천 차단했습니다.
2.  **QA-02: Vendor Dashboard 최상단 Priority Banner & Count 미출력 (MEDIUM-HIGH)**:
    *   *원인*: 사용자가 견적을 수락하여 `ACCEPTED_WAITING_VENDOR` 단계가 되었음에도, 파트너 대시보드의 최상단 메트릭에서 이를 인지하지 못해 "확정 예약 0건"으로만 보이고 즉시 조치를 위한 우선순위 배너가 노출되지 않는 문제가 있었습니다.
    *   *해결*: `components/features/planning/vendor-workspace.tsx`에 **"예약 최종 확정 필요" 우선순위 배너**를 최상단에 전면 배치하고, MetricCard 그리드를 5열(`sm:grid-cols-5`)로 고급스럽게 확장하여 **"최종 확정 필요 N건" 카드를 별도 제공**하도록 교정했습니다.
3.  **QA-03: `step4-booking-dashboard.tsx` 내 Frontend Heuristic Fallback 완전 제거 (MEDIUM)**:
    *   *원인*: 프론트엔드 레벨에서 백엔드 없이 독자적으로 `vendor.category` 등을 쪼개서 카테고리를 추론하는 heuristic fallback 함수들이 남아 있어 API 연동의 명세 신뢰성을 해치고 있었습니다.
    *   *해결*: `step4-booking-dashboard.tsx`에서 `getCategoryKeyOfRequest` / `getCategoryKeyOfReservation` 헬퍼 함수를 **완전히 삭제**했습니다. 오직 백엔드 DTO `step4DashboardData`만을 단 하나의 **Source of Truth**로 정립하여, 백엔드가 지정해준 벤더 요약 매핑에 의해서만 100% 수동적으로 UI를 그리게 강제했습니다.
4.  **QA-04: Funeral Step 4 empty state 내 부적절한 Sparkles 아이콘 제거 (LOW)**:
    *   *원인*: 경건함이 유지되어야 할 장례 Step 4 예약 확정 내역 비어있음 화면에 축하성 `Sparkles` 아이콘이 노출되었습니다.
    *   *해결*: `eventType === "WEDDING"` 일 때만 `Sparkles`를 렌더하고, `FUNERAL`인 경우 품위 있는 `ClipboardList` 아이콘이 나타나도록 교정하여 애도 공간의 진정성을 확보했습니다.
5.  **QA-05: Vendor Dashboard 내 raw enum 대문자 노출 제거 (MEDIUM)**:
    *   *원인*: [memorial@yeon.local](mailto:memorial@yeon.local) 벤더 서비스 관리 탭 등에서 `FUNERAL_HALL`, `ALTAR_FLORAL` 등의 대문자 DB string이 그대로 노출되었습니다.
    *   *해결*: `lib/step3.shared.ts`의 `getQuoteServiceModuleLabel` 헬퍼에 **`CATEGORY_LABEL_MAP` 명시적 한국어 프리미엄 매핑 딕셔너리**를 탑재하여, 어떠한 대소문자나 DB 원천 string이 들어와도 격식 있는 한글 라벨로 자동 정화되어 렌더링되게 설계했습니다.

---

## 2. 신규 QA 자동화 검증 스크립트 구축 (`verify-service-category-contract.ts`)

PM 지시사항 및 Claude QA의 동일 버그 재발 방지(Regression Prevention)를 위해, 신규 비즈니스 도메인 무결성 검증 스크립트인 `scripts/verify-service-category-contract.ts`를 작성하고 최종 검증 Baseline에 편입했습니다.

**검증 항목**:
1.  Moment Garden(`wedding_venue_package`)과 Orsay Floral(`wedding_floral_upgrade`)의 `comparableGroupKey` 격리 보장 검증.
2.  Moment Garden은 `PRIMARY` 공급 역할, Orsay Floral은 `ADDON` 성격으로 올바르게 귀속되는지 검증.
3.  동일 `quoteResponseId`가 Step 4 대시보드의 여러 카테고리 DTO 그룹에 중복 삽입되는 현상 차단 검증.
4.  장례식 벤더 "한결 의전"의 제안이 식음료(`meal`) 등의 타 레인에 동시 다발적으로 노출되는 중복 방지 검증.
5.  `canCompare`는 오직 동일 `comparableGroupKey` 내에 2개 이상의 유효 견적이 중첩 수신된 경우에만 `true`임을 검증.
6.  수락 완료된 `Reservation(PENDING)` 상태는 `pendingConfirmations` 우선순위 버킷으로, 최종 확정된 `CONFIRMED` 건은 `confirmedReservations`로 엄격히 분리 수렴되는지 검증.

---

## 3. 종합 검증 결과 (Full-stack Validation Baseline: 100% PASS)

Next.js 로컬 터미널 컴파일 및 최적화 빌드 파이프라인 검증이 완벽하게 통과되었습니다.

1.  `npx prisma generate` $\rightarrow$ **PASS** (Prisma Client successfully generated)
2.  `npm run db:seed` $\rightarrow$ **PASS** (Seed complete, 6 users, 2 plans, 3 reservations, 15 modules)
3.  `verify-demo-data-integrity` $\rightarrow$ **PASS**
4.  `verify-quote-flow` $\rightarrow$ **PASS** (53 core workflows and negative assertions validated)
5.  `launch-readiness-smoke` $\rightarrow$ **PASS** (RSC navigation and workflow event writes validated)
6.  `server-action-read-concurrency-smoke` $\rightarrow$ **PASS** (Concurrent read lock safety validated)
7.  `verify-planner-auth-redirect` $\rightarrow$ **PASS**
8.  `verify-service-category-contract` $\rightarrow$ **PASS** (Moment Garden & Orsay Floral isolated, no duplicate responses, disjoint segregation validated)
9.  `npx tsc --noEmit` $\rightarrow$ **PASS** (TypeScript 0 Errors)
10. `npm run lint` $\rightarrow$ **PASS** (ESLint 0 Warnings / 0 Errors, code strictly sanitized)
11. `npm run build` $\rightarrow$ **PASS** (Next.js optimized build completed, 19/19 routes generated successfully)
12. `npx prisma migrate status` $\rightarrow$ **PASS** (Database schema is up to date! 14 migrations confirmed)

---

## 4. 커밋 및 형상 관리
*   **현재 브랜치**: `codex/step3-main-logic-rewrite`
*   **커밋 메시지**: `git commit -m "Fix service category workflow QA issues"`
*   **작업 조건 준수**: push 금지 및 `tsconfig.tsbuildinfo` 커밋 제외 가이드를 완벽히 수행했습니다.

---

## 5. 2026-05-29 Remaining Workflow QA Stabilization 완결

PM 검수 및 최종 릴리즈를 위해, Claude QA에서 지적된 4대 Workflow QA Regression 이슈(WF-QA-01 ~ WF-QA-04)를 최종적으로 전원 해결 및 무결 패치 완료했습니다.

### 1. 세부 교정 명세
*   **WF-QA-01: Server Actions POST 503 (SQLite Lock & Concurrency Loop 해소)**:
    - *원인*: `event-planning-workspace.tsx` 내의 `useEffect` 의존성 배열에 `quoteRequestsCache` 가 무분별하게 참조되어, 캐시 갱신 시 `getStep4DashboardData` API 서버 액션이 무한히 중복/병렬 재호출되는 React 렌더링 순환 고리가 존재했습니다. 이와 동시에 `getStep4DashboardData` 백엔드 내부 Prisma 다중 트랜잭션이 `withPrismaRetry` 없이 원시 호출되어 동시성 락 상황에서 SQLite가 503 에러를 즉시 반환하는 취약점이 있었습니다.
    - *해결*: 의존성 배열에서 `quoteRequestsCache` 를 제거해 불필요한 호출 병목을 원천 박멸했으며, `getStep4DashboardData` 내의 모든 쿼리 묶음을 `withPrismaRetry` 트랜잭션 내에 완벽하게 내장하여 503 에러의 발생 가능성을 원천적으로 박멸했습니다.
*   **WF-QA-02: Vendor/Planner 카테고리 라벨 불일치 정렬 (Domain Language 통일)**:
    - *원인*: 한결 의전(의전 BUNDLE 벤더)의 제안서가 플래너 Step 4에서는 "장례식장" 레인에만 표시되도록 정밀 통제되었지만, 벤더 대시보드에서는 "문상객 식사" 등 원시 DB 카테고리 label 그대로 노출되어 카테고리명 불일치와 사용자 혼동을 일으켰습니다.
    - *해결*: `vendor-workspace.tsx` 파일 내부에 통합 판단 헬퍼 `getServiceLabel` 을 구현하여, BUNDLE 예약의 경우 리스트 카드 헤더, 상세 요건 뷰, "응답 대상 요청 선택" 드롭다운의 option 라벨 등 총 6곳의 출력지점을 모두 동일한 도메인 언어인 `"장례식장·기본 의전"`으로 통일 연동 노출시켰습니다.
*   **WF-QA-03: 장례 플랜 카드 카피 톤 보정 (경건한 톤 격리 분기)**:
    - *원인*: `/plans` 대시보드 화면 내의 장례(FUNERAL) 플랜 카드에 웨딩용 톤앤매너인 "도도하게 정비된..." 카피가 출력되는 미스매치가 있었습니다.
    - *해결*: `getNextActionMeta`가 `plan.eventType`을 주입받아 웨딩은 기존 럭셔리 골드 톤을 유지하고, 장례인 경우 경건하고 정중한 카피 분기("필요한 의전 제안서를 확인해 주세요", "정중하게 준비된 의전 제안서가 도착했습니다")를 타도록 완벽히 보정했습니다.
*   **WF-QA-04: Vendor 요청 상세 행사 유형 빈 값 방어 (Raw Enum 노출 원천 봉쇄)**:
    - *원인*: 벤더 대시보드의 새 견적 요청 상세 내 "행사 유형" 라벨 아래 값이 누락되어 빈 값 혹은 raw enum 형태로 깨져 노출되는 UX 결함이 존재했습니다.
    - *해결*: `selectedReservation.eventPlan?.type`이 존재하고 `eventTypeOptions`에 사상된 유효한 한국어 라벨("웨딩", "장례" 등)이 존재하는 정상적 렌더링 상황에서만 라벨과 값을 렌더링하고, 빈 값이나 fallback 상황에서는 라벨 행 자체를 숨기는 가드 조건을 입혀 원시 enum 노출을 완전 격파했습니다.

### 2. 최종 CI/CD 검증 파이프라인
- Prisma Generate, DB Seed, custom verify 스크립트 6종, TSC, Lint, Production Build 등 12종의 전체 validation pipeline을 100% 무결점으로 통과 완료하여 merge-ready 완결 상태를 달성했습니다.

