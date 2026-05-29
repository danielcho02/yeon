# yeON Premium Product UI Redesign Status (Antigravity)

이 문서는 yeON 프로젝트의 Senior Brand Product Designer 겸 Frontend Motion Engineer인 Antigravity가 진행한 **1차 Premium Product UI Redesign**의 디자인 시스템 원칙, 구현 디테일, 검증 결과 및 마감 상태를 기록한 공식 상태 문서입니다.

---

## 1. Brand UI Direction & Philosophy (Quiet Luxury)
yeON은 일생의 가장 정중하고 중요한 행사(Wedding, Funeral)를 차분하고 정밀하게 설계할 수 있도록 돕는 서비스입니다. 과시적인 사치나 화려한 그라데이션, 그리고 투박한 SaaS 대시보드 템플릿의 느낌을 완전히 배제하고 **절제된 타이포그래피, 깊은 여백, 신뢰도 높은 모노톤 중심의 컬러 시스템**을 설계했습니다.

*   **Neutral Palette & Accents**: 
    *   **Base**: 퓨어 화이트의 자극적인 반사를 피하고 차분한 아이보리 계열(`#faf9f5`), 깊고 부드러운 스톤 그레이 계열, 그리고 신뢰감을 주는 딥 네이비 슬레이트(`#2c3455`)를 테마 베이스로 활용.
    *   **Wedding**: 여백이 강조된 에디토리얼 스타일 위에, yeON 로고 핵심 색상과 정렬되는 부드럽고 차분한 로즈골드/샴페인 골드(`#c4977a`, `#ebdccf`) 톤을 미묘한 테두리 및 인디케이터 라인으로만 제한적으로 매핑.
    *   **Funeral**: 조용하고 장엄하며 신뢰감 있는 스톤 그레이 및 뮤티드 블루 계열(`#cbd3e0`, `#cbd3e0`/40)을 엄격하게 적용하여 모션의 반응 속도와 감도를 극도로 가라앉혀 절제미를 형성.
*   **Typography & Borders**:
    *   SaaS에서 흔히 쓰이는 둥그스름한 삼각형이나 무분별한 섀도우 블록을 제거하고, 에디토리얼 북 레이아웃 스타일의 얇은 실선 테두리(`border-[#ebdccf]/40`, `border-[#e5e2da]`)와 클래식 Serif 폰트(`font-[var(--font-serif)]`) 위계 위주로 구분.
*   **Interaction & Motion**:
    *   사용자의 정신을 흩트리는 화려한 애니메이션을 전부 걷어내고, 150ms~250ms 사이의 억제된 트랜지션(opacity fade, micro border hover feedback, loading opacity delay)을 구현하여 차분한 컨시어지 서비스의 우아함을 재현.

---

## 2. 주요 개선 내용 & 피처 튜닝

### A. Partner Operations Dashboard (업체 대시보드)
*   **업무 Queue & Priority Task Lineup**:
    *   견적 발송 후 사용자가 견적을 수락한 상태인 `quoteRequestStatus === "ACCEPTED"` 예약 건들을 단순 카드 그리드가 아닌 최상단의 독립적인 **"예약 최종 확정 필요"** 업무 Queue 리스트(우아한 로우 리스트 위계)로 우선 전개.
    *   **SLA 기한 명시**: `vendorConfirmationDueAt` 기한(수락 후 3일)을 우아한 시계 아이콘 및 보라색 문구와 결합하여 대시보드 및 리스트 최상단에 은은하고 명확하게 표시.
*   ** metrics & Cards**:
    *   SaaS 카드의 투박함을 지우기 위해 파트너 대시보드 헤더의 통계 수치를 세련된 디자이너 스펙 보드(아이보리 음영 보더, 샴페인 라인 탭) 형태로 개편.
    *   기존의 두껍고 큰 탭 바를 얇고 고급스러운 실선 언더라인 인디케이터 스타일로 바꾸고 hover 시 미세한 텍스트 컬러 피드백만 제공하여 조용한 luxury 구현.
*   **비즈니스 계약 및 DTO 보존**:
    *   `requestMemo` 및 `responseMessage` 간의 계약이 온전히 준수되며, 최종 확정 시 Reservation `status='CONFIRMED'`와 `confirmedAmount`가 DB 무결성 흐름에 맞춰 안전하게 트랜잭션 처리됨.

### B. Step 4 Concierge Status Board & Guide (견적 비교 및 수락 UX)
*   **"견적 수락 ≠ 예약 완료" 인지 무결성 확보**:
    *   기존의 불분명했던 Step 4 안내를 럭셔리 호텔 컨시어지 프로세스 보드 형태로 전면 보강.
    *   **Callout**: *"견적을 수락하면 바로 예약이 확정되는 것은 아닙니다. 파트너사가 3일 이내에 최종 확정을 완료하면 예약이 완료됩니다."* 메시지를 Step 4 상단 정중앙에 고정 매핑.
    *   **상태 레인(Lane)의 완벽한 시각 차별화**:
        *   `PENDING + ACCEPTED` (업체 최종 확정 대기): 보라색(`text-violet-700 bg-violet-50/50`) 계열의 진중한 대기 배지와 테두리로 표시.
        *   `CONFIRMED` (예약 확정 완료): 싱그러운 청록색(`text-emerald-700 bg-emerald-50/50`) 계열의 확정 배지 및 행사 완료 완료 버튼 노출.
*   **중복 수락 Action 제거**:
    *   비교 테이블 하단에 흩어져 있던 투박한 수락 버튼들을 하나의 세련된 텍스트 기반 링크("이 제안 수락")로 톤다운하고, 메인 카드 영역의 시그니처 CTA로 사용자 시선을 통합하여 중복 제출 및 결제 혼선 차단.

### C. Detail Level Polishing
*   `app/vendor/dashboard/page.tsx`, `app/planner/wedding/page.tsx`, `app/planner/funeral/page.tsx` 등 래퍼 레이아웃의 폭을 `max-w-7xl`에서 차분하고 집중력 높은 `max-w-5xl`로 정돈하고 상하좌우 패딩 여백을 `py-10 sm:px-8 sm:py-16`으로 늘려 Aesop/Apple 같은 브랜드 웹사이트 특유의 고급스러운 여백미를 확보했습니다.
*   견적 에디터(`VendorQuoteEditor`) 인풋 여백, 금액 기입 부분의 폰트 크기 및 Count-up 모션 등이 럭셔리 명세서 스타일로 매끄럽게 통일되었습니다.

---

## 3. 검증 결과 (Verification Checks)
Next.js 로컬 터미널 컴파일 및 코드 빌드 파이프라인 검증이 완벽하게 통과되었습니다.

1.  **TypeScript 검증 (`npx tsc --noEmit`)**: **PASS** (0 Errors)
2.  **Linter 검증 (`npm run lint`)**: **PASS** (0 Warnings / 0 Errors)
3.  **Next.js Production Build (`npm run build`)**: **PASS** (정적 경로 컴파일 및 RSC 번들링 완벽 통과)
4.  **Data Flow Contract 검증**:
    *   `QuoteRequest` -> `QuoteResponse` -> `Accept` -> `Reservation(PENDING)` -> `confirmReservation(CONFIRMED)` 흐름과 DTO 변환이 무결하게 작동함을 확인했습니다.

---

## 4. 남은 UI Polish 마이너 과제 (Future Roadmap)
1.  **Step 3 CTA 세련미 극대화**: 모바일 하단 플로팅 앵커 CTA의 디자인을 좀 더 은은한 보더 톤으로 정돈.
2.  **Funeral Copy 분기 세분화**: 장례 플래닝 스텝에서 조문객 안내 등 추모 절차에 특화된 문안 톤앤매너 추가 개선.
3.  **Homepage 1차 Polish**: 서비스 입구 페이지(웰컴 피쳐 뷰)의 여백 및 로고 크기 조정을 통해 전체적인 브랜드 룩앤필 동기화.
