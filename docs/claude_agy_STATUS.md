# yeON Premium Product UI & Full-stack QA Stabilization Status (Antigravity)

이 문서는 yeON 프로젝트의 Full-stack QA Stabilization Owner 겸 Senior Product UX Architect인 Antigravity가 진행한 **QA Stabilization & Category-Based Focus**의 설계 해결 방안, 구현 디테일, 검증 결과 및 마감 상태를 기록한 공식 상태 문서입니다.

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
