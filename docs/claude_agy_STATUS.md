# yeON Premium Product UI Redesign Status (Antigravity)

이 문서는 yeON 프로젝트의 Senior Brand Product Designer 겸 Frontend Motion Engineer인 Antigravity가 진행한 **Premium Product UI Redesign & Concierge-First Polish**의 디자인 시스템 원칙, 구현 디테일, 검증 결과 및 마감 상태를 기록한 공식 상태 문서입니다.

---

## 1. Brand UI Direction & Philosophy (Quiet Luxury)
yeON은 일생의 가장 정중하고 중요한 행사(Wedding, Funeral)를 차분하고 정밀하게 설계할 수 있도록 돕는 서비스입니다. 과시적인 사치나 화려한 그라데이션, 그리고 투박한 SaaS 대시보드 템플릿의 느낌을 완전히 배제하고 **절제된 타이포그래피, 깊은 여백, 신뢰도 높은 모노톤 중심의 컬러 시스템**을 설계했습니다.

*   **Neutral Palette & Accents**: 
    *   **Base**: 퓨어 화이트의 자극적인 반사를 피하고 차분한 아이보리 계열(`#faf9f5`), 깊고 부드러운 스톤 그레이 계열, 그리고 신뢰감을 주는 딥 네이비 슬레이트(`#2c3455`)를 테마 베이스로 활용.
    *   **Wedding**: 여백이 강조된 에디토리얼 스타일 위에, yeON 로고 핵심 색상과 정렬되는 부드럽고 차분한 로즈골드/샴페인 골드(`#c4977a`, `#ebdccf`) 톤을 미묘한 테두리 및 인디케이터 라인으로만 제한적으로 매핑.
    *   **Funeral**: 조용하고 장엄하며 신뢰감 있는 스톤 그레이 및 뮤티드 블루 계열(`#cbd3e0`, `#cbd3e0`/40)을 엄격하게 적용하여 모션의 반응 속도와 감도를 극도로 가라앉혀 절제미를 형성.
*   **Typography & Borders**:
    *   SaaS에서 흔히 쓰이는 둥그스름한 삼각형이나 무분별한 섀도우 블록을 제거하고, 에디토리얼 북 레이아웃 스타일의 얇은 실선 테두리(`border-[#ebdccf]/40`, `border-[#e5e2da]`)와 클래식 Serif 폰트(`font-[var(--font-serif)]`) 위계 위주로 구분.
*   **Interaction & Motion (Quiet & Elegant)**:
    *   사용자의 정신을 흩트리는 화려한 애니메이션을 전부 걷어내고, 150ms~250ms 사이의 억제된 트랜지션(opacity fade, micro border hover feedback, loading opacity delay)을 구현하여 차분한 컨시어지 서비스의 우아함을 재현.

---

## 2. 주요 개선 내용 & 피처 튜닝 (Launch-Ready Polish)

### A. Progressive Disclosure (점진적 노출 및 인지 부하 감소)
*   **견적 요청 상세 폼 슬라이드 다운 토글 (`isDetailOpen` state)**:
    *   사용자가 업체를 선택했을 때 마주하는 폼(희망 날짜, 인원수, 메모)이 기본적으로 펼쳐져 있으면 입력 스트레스를 느낄 수 있습니다. 이를 해결하기 위해 **"일정 및 상세 조건 설정 (선택)"** 버튼을 적용하고 progressive disclosure를 도입하여 기본 구성을 우선시했습니다.
    *   버튼 클릭 시에만 입력 필드가 우아하게 펼쳐지도록 인터랙션을 강화하여, "알아서 준비해 주는 컨시어지 서비스"로서의 가치를 구현했습니다.

### B. Wedding / Funeral 톤앤매너 완벽 분리
*   **축하성 모션의 엄격한 제한**:
    *   견적을 수락할 때 가동되는 `Confetti` 파티클 모션을 오직 결혼 플로우(`eventType === "WEDDING"`)에서만 작동되도록 한정하고, 장례 플로우(`eventType === "FUNERAL"`)에서는 차분하게 페이지가 갱신되도록 제어하여 행사 성격에 맞게 연출을 차별화했습니다.
*   **상태 미니맵 및 안내 보드 테마화**:
    *   Step 4 예약 관리 상단의 **"예약 안전 가이드"** Callout 및 하단의 `WorkflowStep` 미니맵이 기존에는 Wedding 샴페인 골드 톤으로 하드코딩되어 있던 것을 테마 변수(`theme.accentBorder`, `theme.cardHighlight`, `isWedding`)에 연동하여 장례 화면에서는 진중하고 정숙한 스톤 차콜 톤으로 표시되도록 개편했습니다.

### C. No-Emoji & High-End Iconography (이모지 정화 및 고급화)
*   **SaaS 템플릿 느낌의 이모지 남발 척결**:
    *   폼 라벨(`💒`, `🌹`, `📍`, `📅`, `🗓️`, `👥`, `💰`, `📝`) 및 UI 요소 곳곳에 배치되어 있던 이모지들을 전면 제거하고 명료하고 차분한 텍스트로 대체하여 전문적인 프리미엄 인상을 배가했습니다.
*   **Refined EmptyState**:
    *   텅 빈 상태에서 렌더링되던 투박한 이모지(`🏢`, `📬`, `📩`, `✨`)를 깔끔하고 우아한 Lucide 아이콘(`Building2`, `ClipboardList`, `Clock`, `Sparkles`)으로 전환하고 배경 및 보더의 패딩 위계를 은은하게 다듬어 럭셔리 대시보드 질감을 훌륭하게 부여했습니다.

### D. Partner Operations Dashboard & Plans (대시보드 뷰 완성)
*   **업무 Queue & Priority Task Lineup**:
    *   사용자가 수락한 상태인 `quoteRequestStatus === "ACCEPTED"` 예약 건들을 단순 카드 그리드가 아닌 최상단의 독립적인 **"오늘 처리할 일: 예약 최종 확정"** 업무 Queue 리스트로 우선 정렬.
    *   **SLA 기한 명시**: `vendorConfirmationDueAt` 기한(수락 후 3일)을 우아한 시계 아이콘 및 보라색 문구와 결합하여 대시보드 및 리스트 최상단에 은은하고 명확하게 표시.
*   ** metrics & Cards**:
    *   SaaS 카드의 투박함을 지우기 위해 파트너 대시보드 헤더의 통계 수치를 세련된 디자이너 스펙 보드(아이보리 음영 보더, 샴페인 라인 탭) 형태로 개편.
    *   기존의 두껍고 큰 탭 바를 얇고 고급스러운 실선 언더라인 인디케이터 스타일로 바꾸고 hover 시 미세한 텍스트 컬러 피드백만 제공하여 조용한 luxury 구현.

---

## 3. 검증 결과 (Verification Checks)
Next.js 로컬 터미널 컴파일 및 코드 빌드 파이프라인 검증이 완벽하게 통과되었습니다.

1.  **TypeScript 검증 (`npx tsc --noEmit`)**: **PASS** (0 Errors)
2.  **Linter 검증 (`npm run lint`)**: **PASS** (0 Warnings / 0 Errors - Unused imports in `app/page.tsx`, `app/plans/page.tsx` 완벽 수정 완료)
3.  **Next.js Production Build (`npm run build`)**: **PASS** (정적 경로 컴파일 및 RSC 번들링 완벽 통과)
4.  **Data Flow Contract 검증**:
    *   `/plans`의 하드 네비게이션 `<a>` 속성이 정상 보존되어 CSR 오작동을 차단함을 확인.
    *   `QuoteRequest` -> `QuoteResponse` -> `Accept` -> `Reservation(PENDING)` -> `confirmReservation(CONFIRMED)` 흐름과 DTO 변환이 무결하게 작동함을 확인했습니다.

---

## 4. 커밋 및 형상 관리
*   **현재 브랜치**: `codex/step3-main-logic-rewrite`
*   **작업 조건 준수**: 새 브랜치를 만들지 않고 그대로 유지하였으며, `git push` 및 `tsconfig.tsbuildinfo` 커밋 금지 제약을 완벽하게 엄수합니다.
