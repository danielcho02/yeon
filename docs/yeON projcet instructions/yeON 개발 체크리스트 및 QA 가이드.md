# yeON 개발 체크리스트 및 QA 가이드

> 각 Phase 완료 시 아래 체크리스트를 순서대로 검증합니다.

---

## Phase 1 체크리스트: 기반 아키텍처 (Codex 주도)

### 데이터베이스
| 항목 | 검증 명령어 | 기대 결과 |
|---|---|---|
| Schema 문법 | `npx prisma format` | 에러 없이 포맷 완료 |
| DB 동기화 | `npx prisma db push` | 테이블 생성 성공 |
| Client 생성 | `npx prisma generate` | Prisma Client 생성 |
| Seed 실행 | `npx prisma db seed` | 더미 데이터 삽입 |
| 관계 검증 | Prisma Studio에서 데이터 확인 | 모든 FK 관계 정상 |

### Server Actions
| 항목 | 검증 방법 | 기대 결과 |
|---|---|---|
| createPlan | 웨딩/장례 플랜 각 1개 생성 | DB에 레코드 생성 확인 |
| createQuoteRequest | 플랜에 견적 요청 생성 | status = PENDING |
| submitQuoteResponse | 견적 응답 제출 | status → RESPONDED |
| acceptQuote | 견적 수락 | status → ACCEPTED |
| 잘못된 전이 시도 | ACCEPTED → RESPONDED 시도 | InvalidTransitionError 발생 |

### 타입 안전성
| 항목 | 검증 명령어 | 기대 결과 |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 에러 0 |
| ESLint | `npm run lint` | 경고 0 |

---

## Phase 2 체크리스트: 인터랙티브 UI (Claude Code 주도)

### 테마 시스템
| 항목 | 검증 방법 | 기대 결과 |
|---|---|---|
| 웨딩 테마 | 웨딩 워크스페이스 진입 | Rose 컬러, 빠른 애니메이션 |
| 장례 테마 | 장례 워크스페이스 진입 | Slate 컬러, 느린 애니메이션 |
| 테마 전환 | 타입 변경 시 | 즉각적이고 자연스러운 전환 |

### 애니메이션 컴포넌트
| 컴포넌트 | 검증 방법 | 기대 결과 |
|---|---|---|
| FadeIn | 페이지 진입 시 | 요소가 부드럽게 나타남 |
| SlideUp | 리스트 렌더링 시 | 아래에서 위로 순차 등장 |
| SwipeTransition | 마법사 단계 이동 | 좌우 스와이프 전환 |
| CountUp | 견적 총액 변경 | 숫자 카운트업 애니메이션 |
| Confetti | 웨딩 예약 확정 | 파티클 효과 |
| ProgressBar | 마법사 진행 | 부드러운 진행률 채움 |

### 다단계 마법사
| 항목 | 검증 방법 | 기대 결과 |
|---|---|---|
| 웨딩 5단계 | 각 단계 순차 진행 | 모든 단계 정상 렌더링 |
| 장례 4단계 | 각 단계 순차 진행 | 모든 단계 정상 렌더링 |
| 뒤로 가기 | 이전 단계로 복귀 | 입력 데이터 유지 |
| 유효성 검사 | 필수 필드 미입력 | 다음 버튼 비활성화 |
| 최종 확인 | 마지막 단계 | 전체 입력 요약 표시 |

### 모듈형 견적 빌더
| 항목 | 검증 방법 | 기대 결과 |
|---|---|---|
| 모듈 선택 | 타일 클릭 | 선택 상태 토글 + 요약 패널 업데이트 |
| 총액 업데이트 | 모듈 추가/제거 | CountUp 애니메이션으로 총액 변경 |
| 카테고리 필터 | 탭 클릭 | 해당 카테고리 모듈만 표시 |
| 모바일 레이아웃 | 375px 뷰포트 | 하단 바 + 바텀 시트 |
| 데스크톱 레이아웃 | 1440px 뷰포트 | 좌측 그리드 + 우측 Sticky |

### 반응형 테스트
| 브레이크포인트 | 뷰포트 | 확인 사항 |
|---|---|---|
| 모바일 | 375px | 단일 컬럼, 하단 바, 터치 친화적 |
| 태블릿 | 768px | 2컬럼 그리드, 사이드바 축소 |
| 데스크톱 | 1024px | 전체 레이아웃, Sticky 패널 |
| 와이드 | 1440px | 최대 너비 제한, 중앙 정렬 |

---

## Phase 3 체크리스트: 통합 (협업)

### API 연동
| 항목 | 검증 방법 | 기대 결과 |
|---|---|---|
| Mock 제거 | `__mocks__/` import 제거 | 실제 Server Action 호출 |
| 로딩 상태 | API 호출 중 | 스켈레톤 UI 표시 |
| 에러 상태 | 의도적 에러 발생 | 에러 메시지 표시 |
| 빈 상태 | 데이터 없는 플랜 조회 | Empty State UI 표시 |
| 낙관적 업데이트 | 모듈 선택 | 서버 응답 전 UI 즉시 반영 |

### 전체 플로우 테스트
| 시나리오 | 단계 | 기대 결과 |
|---|---|---|
| 웨딩 플랜 생성 | 마법사 5단계 완료 | DB에 플랜 생성 |
| 견적 요청 | 모듈 선택 후 요청 | DB에 견적 요청 생성 (PENDING) |
| 견적 응답 | 업체 계정으로 응답 | 상태 → RESPONDED |
| 견적 비교 | 여러 업체 응답 확인 | 비교 테이블 정상 렌더링 |
| 견적 수락 | 사용자 수락 | 상태 → ACCEPTED |
| 예약 생성 | 수락 후 예약 | DB에 예약 생성 (PENDING) |
| 예약 확정 | 업체 확정 | 상태 → CONFIRMED + 축하 피드백 |

### 빌드 검증
| 항목 | 명령어 | 기대 결과 |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 에러 0 |
| ESLint | `npm run lint` | 경고 0 |
| 프로덕션 빌드 | `npm run build` | 성공 |
| 번들 크기 | 빌드 로그 확인 | First Load JS < 200KB |

---

## 공통 코딩 컨벤션

### 파일 명명 규칙
| 유형 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 | kebab-case | `modular-quote-builder.tsx` |
| 훅 | use- 접두사 + kebab-case | `use-quote-builder.ts` |
| 타입 | kebab-case | `quote.ts` |
| Server Action | kebab-case | `quote.ts` |
| 유틸리티 | kebab-case | `state-machine.ts` |

### 커밋 메시지 규칙
```
feat(scope): 설명
fix(scope): 설명
refactor(scope): 설명
docs: 설명

scope 예시: ui, api, prisma, types, hooks
```

### import 순서
```typescript
// 1. React/Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. 외부 라이브러리
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

// 3. 내부 타입
import type { QuoteModule } from '@/types/quote';

// 4. 내부 컴포넌트/훅
import { FadeIn } from '@/components/ui/motion/fade-in';
import { useTheme } from '@/hooks/use-theme';

// 5. 유틸리티
import { cn } from '@/lib/utils';
```
