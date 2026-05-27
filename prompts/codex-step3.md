# [Step 3 + 랜딩 리디자인] YeON 경조사 통합 플랫폼

## 작업 우선순위
이 태스크는 두 파트로 나뉜다. **파트 A (디자인 리뉴얼)를 먼저 완료한 뒤 파트 B (Step 3 기능)를 구현**한다.

---

## 파트 A: 랜딩 페이지 디자인 리뉴얼 (app/page.tsx + 공통 컴포넌트)

### A-1. 로고 처리 개선
- `/public/yeon-logo.png`는 흰 배경이 포함되어 있다.
- Next.js `<Image>`에 `style={{ mixBlendMode: 'multiply' }}` 또는 CSS `mix-blend-mode: multiply`를 적용해 흰 배경을 시각적으로 제거한다.
- 대안으로, 로고를 감싸는 컨테이너의 배경을 `transparent`로 바꾸고 `drop-shadow` 필터를 적용해 로고 자체가 부각되도록 한다.
- 랜딩 히어로 영역에서는 로고를 단순 아이콘이 아닌 **브랜드 심볼**로 활용한다: 로고를 80px~120px 크기로 확대하고, 아래에 한자 `緣`과 영문 `YeON` 레터링을 레이어로 쌓아 고급스러운 인상을 준다.

### A-2. 히어로 섹션 전면 교체
현재 랜딩의 상단 히어로 카드를 아래 스펙으로 완전히 교체한다:

**레이아웃 (모바일 우선)**
```
[배경: 전체 뷰포트 높이 100vh, 크림-네이비 그라디언트]
  ┌─────────────────────────────────────────┐
  │  [로고 심볼 + 브랜드네임]                │  ← 중앙 정렬, 큰 임팩트
  │                                         │
  │  "결혼, 장례, 모든 경조사의             │
  │   시작과 끝을 함께합니다"               │  ← 메인 카피
  │                                         │
  │  [서브 카피 한 줄]                       │
  │                                         │
  │  [시작하기 CTA] [더 알아보기]           │  ← 버튼 2개
  │                                         │
  │  ─── 아래로 스크롤 유도 애니메이션 ───  │
  └─────────────────────────────────────────┘
```

**디자인 지침**
- 배경: `radial-gradient`로 좌상단 크림(#F7EFE5), 우하단 네이비(#2C3455) 방향 그라디언트
- 한국어 메인 카피 폰트: `Noto Serif KR` (Google Fonts CDN) + `font-weight: 700`, `letter-spacing: -0.02em`
- 영문/서브 텍스트: 기존 `Space Grotesk` 유지
- 로고 뒤 배경에 반투명 원형 글로우 (`radial-gradient`) 처리로 로고 부각
- CTA 버튼: Accent 컬러(`#C4977A`) 기반 solid 버튼, hover 시 scale-up + shadow 트랜지션
- 스크롤 유도: `ChevronDown` 아이콘 bounce 애니메이션 (`animate-bounce`)

### A-3. 서비스 소개 섹션 추가 (히어로 아래)
3개 Feature Card를 가로 배치한다:
1. 🎊 **행사 관리** — "결혼·장례 일정을 한 곳에서"
2. 💸 **축의금·부의금** — "투명한 금전 관리"
3. 🏢 **업체 연결** — "검증된 업체와 바로 연결"

카드 스타일: 둥근 모서리 `rounded-3xl`, 흰색 반투명 배경 `bg-white/80 backdrop-blur`, hover 시 `translateY(-4px)` 트랜지션

### A-4. 폰트 설정 업데이트
`app/layout.tsx`에서 Google Fonts로 `Noto Serif KR`을 추가 로드한다:
```tsx
// next/font/google 사용
import { Noto_Serif_KR, Space_Grotesk } from "next/font/google"

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
})
```
`globals.css`에 `--font-serif` CSS 변수를 추가하고, 히어로 제목에만 적용한다.

---

## 파트 B: Step 3 — 행사 플랜 관리 + 업체 검색 + 견적 요청

### B-1. 행사 플랜 CRUD (U04)
- **`/plans`** 페이지: 로그인한 사용자의 행사 플랜 목록 (캘린더 + 리스트 뷰 토글)
- **`/plans/new`** 페이지: 행사 플랜 생성 폼
  - 필드: 행사 유형(결혼식/장례식), 제목, 예정일, 예산, 목표 하객 수, 장소명, 메모
  - Server Action으로 DB 저장
- **`/plans/[id]`** 페이지: 플랜 상세 (수정/삭제 버튼 포함)
- **`/plans/[id]/edit`** 페이지: 수정 폼

Prisma `EventPlan` 모델은 이미 존재하므로 스키마 변경 없이 진행한다.

### B-2. 업체 검색 (U05)
- **`/vendors`** 페이지: 업체 검색 목록
  - 검색 필터: 업체 유형(예식장/장례식장/스튜디오/드레스/기타), 지역, 키워드
  - URL searchParams 기반 필터링 (`/vendors?type=WEDDING_HALL&region=서울`)
  - Server Component에서 Prisma query로 필터링된 결과 렌더링
- **`/vendors/[id]`** 페이지: 업체 상세
  - 업체 정보 (이름, 소개, 지역, 연락처)
  - 평점 (Review 평균, 아직 리뷰 없으면 "-")
  - **"견적 요청하기"** 버튼 → 견적 요청 모달

### B-3. 견적 요청 (U06)
- `Reservation` 모델에 `type: QUOTE_REQUEST` 상태 추가 (혹은 기존 status 활용)
- 모달 폼 필드: 연결할 플랜 선택(드롭다운), 희망 날짜, 예산, 요청 메시지
- Server Action으로 `Reservation` 레코드 생성
- 성공 시 toast 알림: "견적 요청이 접수되었습니다. 업체에서 연락드릴 예정입니다."
- `/account` 페이지에 "나의 견적 요청" 섹션 추가

### B-4. 네비게이션 업데이트
`components/nav.tsx` (없으면 생성)에 로그인 상태에 따라 다른 메뉴 표시:
- 비로그인: 홈, 업체 찾기, 로그인/회원가입
- 로그인(GENERAL): 홈, 내 플랜, 업체 찾기, 내 계정
- 로그인(VENDOR): 홈, 업체 관리, 내 계정

---

## Tech stack & Constraints
- Next.js 14 App Router, React, Tailwind CSS, shadcn/ui, Prisma + SQLite, NextAuth
- 유료 API 금지, 모든 외부 서비스는 Mock 또는 로컬 함수로 대체
- WSL Linux 환경, `.next/`, `node_modules/` 수정 금지
- 가능한 경우 Server Action 우선, 필요 시 API Route 사용
- 모바일 우선 반응형 UI

## Output format
반드시 아래 순서로 응답:
1. 구현 계획 (A/B 파트 구분)
2. 생성/수정할 파일 목록
3. 전체 코드
4. 실행 방법
5. 검증 체크리스트

## Acceptance criteria
- [ ] 로고가 흰 배경 없이 브랜드 심볼로 랜딩에 표시됨
- [ ] 히어로 섹션이 Noto Serif KR 폰트 + 그라디언트 배경으로 교체됨
- [ ] `/plans` 목록 → `/plans/new` 생성 → `/plans/[id]` 상세가 동작함
- [ ] `/vendors` 필터 검색이 URL searchParams 기반으로 동작함
- [ ] `/vendors/[id]`에서 견적 요청 모달이 뜨고 DB에 저장됨
- [ ] 로그인 상태에 따른 네비게이션이 올바르게 표시됨
