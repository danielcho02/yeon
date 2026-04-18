# Project
경조사 통합 플랫폼(가칭: YeON) MVP를 구현한다.

# Working mode
- 먼저 현재 단계에 대한 구현 계획을 5~10개 항목으로 작성한다.
- 계획 승인 없이 바로 구현을 시작하되, 범위를 현재 Step 안으로만 제한한다.
- 작업 중에는 관련 파일만 읽고 수정한다.
- 각 마일스톤 완료 후 반드시 검증 명령을 실행하고 실패를 수정한다.
- 요구사항이 충돌하면 이 프롬프트 > AGENTS.md > 기존 코드 순으로 우선한다.

# Tech stack
- Next.js 14 App Router
- React
- Tailwind CSS
- shadcn/ui
- Prisma + SQLite
- NextAuth Credentials
- Zustand (필요 시)

# Constraints
- 유료 API 금지
- 모든 외부 서비스는 Mock 또는 Rule-based 로컬 함수로 대체
- 모바일 우선 반응형 UI
- 실행 가능한 완전한 코드만 작성
- 불필요한 TODO, placeholder 금지

# Mock rules
1. 결제는 mockPaymentGateway 함수로 처리
   - 2초 대기
   - 90% 성공 / 10% 실패
2. AI 추천은 generateMockAIRecommendation 함수로 처리
   - 예산, 하객 수, 지역 기반 rule-based JSON 반환
3. 알림은 실제 SMS/카카오 대신 toast로 시뮬레이션

# Domain models
- User (GENERAL / VENDOR / ADMIN)
- EventPlan
- Reservation
- Post
- Review
- Transaction
- Invitation

# Additional constraints
- This project lives in WSL and should be treated as a Linux-first workspace.
- Do not modify `.venv/`, `node_modules/`, `.next/`, `dist/`, or `build/`.
- Infer the schema from the prompt and project requirements without relying on class-diagram files.
- Prefer practical Prisma modeling over literal inheritance.
- Keep all changes within the project root only.
- Assume the user wants to use the Codex app with WSL agent, not the CLI.

# Execution policy
- 한 번에 전체 MVP를 만들지 말고 현재 Step만 구현한다.
- 현재 Step 밖의 기능은 스키마/확장성만 고려하고 UI/로직은 최소화한다.
- 기존 파일이 없으면 생성한다.
- DB seed 데이터를 반드시 포함한다.
- 가능한 경우 서버 액션 우선, 필요 시 API Route 사용

# Output format
반드시 아래 순서로 응답:
1. 구현 계획
2. 생성/수정할 파일 목록
3. 전체 코드
4. 실행 방법
5. 검증 방법
6. 다음 Step으로 넘어가기 전에 확인할 체크리스트

# Current task
[Step 1] Project Setup & DB Schema
- Next.js 프로젝트 초기 구조
- Prisma schema.prisma 작성
- U01~U10을 커버할 수 있는 최소/확장형 모델 설계
- seed.ts 작성
- shadcn/ui, Tailwind, Prisma, NextAuth를 고려한 폴더 구조 제안
- SQLite 기준으로 즉시 실행 가능해야 함

# Acceptance criteria
- npm install 후 실행 가능
- prisma migrate dev 와 prisma db seed 가능
- 홈 화면에서 seed 데이터 일부 확인 가능
- Step 2에서 회원가입/로그인 구현이 가능하도록 스키마가 준비되어 있을 것
