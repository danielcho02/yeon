# YeON 프로젝트 상태 기록
> 마지막 업데이트: 2026-04-30

---

## ✅ 완료된 작업

### 라우팅 구조
- `/planner/wedding/page.tsx` — 생성 완료. WEDDING 플랜 fetch → `EventPlanningWorkspace eventType="WEDDING"` 렌더
- `/planner/funeral/page.tsx` — 생성 완료. FUNERAL 플랜 fetch → `EventPlanningWorkspace eventType="FUNERAL"` 렌더
- `/planner/page.tsx` — 라우터로 재작성:
  - VENDOR → `VendorWorkspace`
  - GENERAL + wedding 플랜만 → `redirect("/planner/wedding")`
  - GENERAL + funeral 플랜만 → `redirect("/planner/funeral")`
  - GENERAL + 둘 다 / 없음 → 결혼/장례 선택 카드 화면

### 버그 수정
- 랜딩 페이지 CTA 버그 수정: 장례 버튼이 `/planner/wedding`으로 가던 문제 → 각각 분리
- 로그인 후 기본 리다이렉트: `/account` → `/planner`
- `mvpEventTypes as const` TypeScript 타입 충돌 수정
- `SummaryChip` 미사용 함수 제거 (ESLint 빌드 오류)

### 컴포넌트
- `event-planning-workspace.tsx` — 신규 생성 (1009줄)
  - 4단계 스테퍼: 행사 준비 → AI 추천 → 견적 요청 → 예약 확정
  - WEDDING / FUNERAL THEMES 객체로 색상/텍스트 분기
  - 플랜 있으면 요약 카드, 없으면 폼 (isEditingPlan 토글)
  - API 연동: handleSavePlan, handleSendRequest, handleConfirm, handleCancel

### 빌드 상태
- `npx tsc --noEmit` ✅ 0 errors
- `npm run lint` ✅ no warnings/errors
- `npm run build` ✅ 성공

---

## ❌ 다음 세션에서 해야 할 작업

### 핵심 문제
**"색깔만 바뀐 것 같다. UI가 너무 단순하고 폼 위주라 제품답지 않다. 웨딩이면 웨딩다운 비주얼(이미지/이모지/장식 요소)이 있어야 한다."**

---

### 작업 1: Landing Page (`app/page.tsx`) 비주얼 강화
현재: 카드 2개 + 텍스트 나열  
목표:
- 웨딩 카드에 💍🌸🥂 이모지 장식, 플로럴 패턴 느낌의 배경
- 장례 카드에 🕯️🌿 조용하고 무게감 있는 장식
- Hero 섹션 전체 높이 확대, 큰 타이포 + 분위기 있는 서브카피
- "How it works" 섹션을 타임라인 스타일로 변경

### 작업 2: Wedding Workspace (`/planner/wedding`) 대폭 개선
현재: 흰 카드 + 로즈 색상 정도  
목표:
- **Hero 헤더**: 꽃/리본 SVG 패턴 또는 이모지 장식 배경, 큰 웨딩 타이틀
- **Step 1 (행사 준비)**: 폼 패널을 `결혼식` 분위기로 — 필드 레이블에 💒 📅 👰 💰 이모지, 배경에 미묘한 플로럴 패턴
- **Step 2 (AI 추천)**: 추천 결과를 "웨딩 무드보드" 스타일 카드로 — 큰 타이틀 + 태그 클라우드 + 타임라인을 수평 스크롤 스텝으로
- **Step 3 (견적 요청)**: 업체 카드에 서비스 아이콘 (📸 촬영, 🎂 케이터링, 💐 플라워 등)
- **Step 4 (예약 확정)**: 확정 시 작은 축하 애니메이션 (confetti 느낌)
- 스테퍼를 숫자 버블이 아닌 아이콘 버블로: 📋 ✨ 🤝 ✅

### 작업 3: Funeral Workspace (`/planner/funeral`) 개선
현재: 슬레이트 색상만  
목표:
- **Hero 헤더**: 🕯️ 🌿 조용하고 차분한 장식 (화려하지 않게)
- **전체 톤**: 네이비/다크슬레이트 + 아이보리 조합, 폰트 weight 조금 더 가볍게
- 필드 레이블에 관련 이모지: 🗓️ 📍 🌹 등
- AI 추천을 "준비 체크리스트" 스타일 (타임라인 목록 강조)
- 업체 카드 아이콘: ⛪ 장례식장, 🌸 화환, 🚗 운구 등

### 작업 4: Vendor Workspace 개선
파일: `components/features/planning/vendor-workspace.tsx`  
현재: 탭 기반 인박스  
목표:
- 헤더에 업체명 + 업종 배지 강조
- 요청 카드를 더 카드답게 (상태별 컬러 왼쪽 보더)
- 빈 인박스 상태를 더 예쁘게 (일러스트 스타일 이모지 + 설명)

### 작업 5: Auth Layout / Login 페이지 개선
파일: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`  
현재: 2패널 레이아웃 (왼쪽 브랜드, 오른쪽 폼)  
목표:
- 왼쪽 패널에 wedding/funeral 이미지나 이모지 강조 장식
- 폼 필드 더 크고 여유있게

---

## 파일 구조 현황

```
app/
  page.tsx                          ← 랜딩 (완료, 비주얼 강화 필요)
  (auth)/
    layout.tsx                      ← 인증 레이아웃 (완료, 개선 필요)
    login/page.tsx                  ← 로그인 (완료)
    signup/page.tsx                 ← 회원가입
  planner/
    page.tsx                        ← 라우터 (완료)
    wedding/page.tsx                ← 웨딩 워크스페이스 (완료, UI 개선 필요)
    funeral/page.tsx                ← 장례 워크스페이스 (완료, UI 개선 필요)

components/features/planning/
  event-planning-workspace.tsx      ← 핵심 워크스페이스 컴포넌트 (완료, UI 개선 핵심)
  vendor-workspace.tsx              ← 업체 워크스페이스
  planner-general-workspace.tsx     ← 구버전 (더 이상 /planner에서 안 쓰임, 삭제 검토)
  planning-workspace.tsx            ← 구버전 (삭제 검토)
  workspace-types.ts                ← 공용 타입
```

---

## 다음 세션 시작 시 우선순위

1. `event-planning-workspace.tsx` — WEDDING Hero 헤더 + Step 비주얼 전면 개선 (가장 임팩트 큼)
2. `app/page.tsx` — 랜딩 카드 비주얼 강화
3. 구버전 컴포넌트 정리 (`planner-general-workspace.tsx`, `planning-workspace.tsx`)
4. Funeral 특화 비주얼
5. Vendor workspace

---

## 기술 스택 메모
- Next.js 14 App Router, TypeScript strict
- Tailwind CSS (커스텀 animate-fade-in, animate-slide-up in globals.css)
- Prisma + SQLite (better-sqlite3)
- NextAuth v4 JWT
- Lucide React 아이콘
- `npm run build` 통과 유지 필수 (tsc + eslint)
- Demo 계정: `planner@yeon.local` / `venue@yeon.local` / `catering@yeon.local`, pw: `demo1234`
