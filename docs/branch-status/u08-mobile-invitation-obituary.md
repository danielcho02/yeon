# U08 Mobile Invitation / Obituary Branch Status

> Branch: `claude/u08-mobile-invitation-obituary`
> Owner/Agent: Claude
> Scope: Mobile invitation (청첩장) and obituary (부고장) MVP

---

## IA Decision Record

### 핵심 결정: plan-scoped 종속 기능

U08 모바일 청첩장/부고장은 **독립 메뉴가 아니라 confirmed reservation을 가진 EventPlan의 종속 기능**이다.

- 플랜당 모바일 카드 1개 (`planId @unique`)
- Reservation(CONFIRMED)이 있어야 생성 가능
- cardType은 EventPlan.type으로 자동 결정 (WEDDING → 청첩장, FUNERAL → 부고장)
- `/plans/[id]`에는 진입 CTA만 제공, 기능 UI는 별도 페이지에서 처리
- 공개 URL만 외부 공유용으로 독립 제공 (`/i/[slug]`, `/o/[slug]`)
- 독립 목록 메뉴 (`/invitations`, `/obituaries`)는 이번 MVP에서 없음 → 추후 확장 기능으로 예약

---

### 최종 제품 IA 진화 방향 (통합 브랜치 대상)

> **U08 브랜치 범위 외 — 기록 목적으로만 작성**

- **U08은 예약 확정 이후 행사 운영 지원 허브의 모바일 카드 모듈이다.**
  - U07 브랜치에서 `/plans/[id]/support` 행사 운영 지원 허브가 구현되었다.
  - 최종 제품 IA에서 U08 모바일 카드 기능은 이 허브 아래에서 진입하는 모듈이 된다.

- **최종 진입점은 `/plans/[id]/support`가 된다.**
  ```
  /plans/[id]/support           ← AGY/U07 구현 (행사 운영 지원 허브)
    ├─ 모바일 청첩장/부고장 →  /plans/[id]/mobile-card  (U08)
    └─ 축의금/조의금 정산   →  /plans/[id]/settlement
  ```

- **현재 `/plans/[id]`의 `MobileCardCTA`는 U08 단독 브랜치에서 기능 접근성을 위한 임시 진입점이다.**
  - support hub 없이 기능을 테스트할 수 있도록 `app/plans/[id]/page.tsx`에 임시 배치한 것이다.

- **통합 브랜치에서 AGY의 support hub와 연결하면서 `/plans/[id]` 직접 CTA는 제거하거나 support CTA로 정리한다.**

- **U08 브랜치에서는 `/plans/[id]/support`를 직접 구현하지 않는다.**
  - AGY/U07 브랜치와 충돌 위험이 있다.
  - support hub 연결은 AGY/U07/U08 통합 브랜치에서 처리한다.

- **실제 기능은 `/plans/[id]/mobile-card/*`, 공개 URL은 `/i/[slug]`, `/o/[slug]`에 유지한다.**

---

## 추가된 Routes

| Route | 역할 | 인증 |
|---|---|---|
| `/plans/[id]/mobile-card` | 카드 관리 (편집/미리보기/공유/발행) | 필요 |
| `/plans/[id]/mobile-card/edit` | 카드 생성 및 내용 편집 | 필요 |
| `/plans/[id]/mobile-card/preview` | 모바일 시뮬레이터 미리보기 | 필요 |
| `/i/[slug]` | WEDDING 공개 청첩장 | 불필요 |
| `/o/[slug]` | FUNERAL 공개 부고장 | 불필요 |

---

## 추가된 Components

| 파일 | 역할 |
|---|---|
| `components/features/invitation/InvitationForm.tsx` | 청첩장 편집 폼 (client) |
| `components/features/invitation/InvitationPreview.tsx` | 청첩장 카드 렌더링 |
| `components/features/invitation/ShareLinkButton.tsx` | 공유 링크 복사 버튼 (client) |
| `components/features/obituary/ObituaryForm.tsx` | 부고장 편집 폼 (client) |
| `components/features/obituary/ObituaryPreview.tsx` | 부고장 카드 렌더링 |

---

## 추가된 Actions / Types / Models

### Prisma 스키마 (새 추가, 기존 모델 수정 없음)

```prisma
enum CardType { WEDDING, FUNERAL }

model MobileCard {
  id                  String       @id @default(cuid())
  planId              String       @unique
  sourceReservationId String?      @unique
  ownerId             String
  cardType            CardType
  slug                String       @unique
  content             Json
  isPublished         Boolean      @default(false)
  viewCount           Int          @default(0)
}
```

역방향 relation 추가 (DB column 변경 없음):
- `User.mobileCards`
- `EventPlan.mobileCard`
- `Reservation.mobileCard`

### Server Actions (`app/actions/invitation.ts`)

| 함수 | 역할 |
|---|---|
| `createMobileCard(planId)` | CONFIRMED reservation 확인 → prefill → 카드 생성 |
| `updateMobileCard(cardId, content)` | 소유자 검증 후 content 업데이트 |
| `publishMobileCard(cardId)` | isPublished = true |
| `getMobileCardByPlanId(planId)` | 소유자 카드 조회 |
| `getPublicMobileCard(slug)` | 공개 조회 + viewCount 증가 |

### Types (`types/invitation.ts`)

- `WeddingCardContent` — 청첩장 필드 (groomName, brideName, date, venue, ...)
- `FuneralCardContent` — 부고장 필드 (deceasedName, funeralHall, departureDatetime, ...)
- `MobileCardData` — 공통 카드 DTO

### Mappers (`app/actions/_utils.ts`)

- `MobileCardLike` type 추가
- `mapMobileCard()` 함수 추가

---

## 웨딩/장례 톤 분리 방식

| 항목 | 청첩장 (WEDDING) | 부고장 (FUNERAL) |
|---|---|---|
| 공개 배경 | `#fff7ed` (warm cream) | `#f8fafc` (cool white) |
| 주색 | rose-500, rose-300 | slate-600, slate-400 |
| 폰트 weight | serif 400/700 | serif 400 위주 |
| 장식 | ✿ 꽃, ♡ 하트 | 선 구분만 |
| 금색/confetti | 허용 | 절대 금지 |

---

## 알람 탭 연동 TODO (미구현)

다음 hook point를 코드 주석으로 표시해 두었음. 별도 브랜치에서 구현 예정.

- `publishMobileCard()`: `// TODO(alarm-tab): onMobileCardPublished(planId, cardType, slug)`
- `getPublicMobileCard()`: `// TODO(alarm-tab): onCardViewed(slug, viewCount + 1)`

---

## 검증 결과

| 명령 | 결과 |
|---|---|
| `npm run db:generate` | ✅ Prisma client 생성 성공 |
| `npx prisma migrate reset --force` | ✅ 20개 migration 전부 적용 성공 (MobileCard 포함) |
| `npx tsc --noEmit` | ✅ 오류 없음 |
| `npm run lint` | ✅ 경고/오류 없음 |
| `npm run build` | ✅ 빌드 성공 (29개 route 컴파일) |
| `git diff --check` | ✅ whitespace 오류 없음 |

---

## 변경 파일 목록

**Modified:**
- `prisma/schema.prisma`
- `types/invitation.ts`
- `app/actions/_utils.ts`
- `app/plans/[id]/page.tsx`

**Created:**
- `app/actions/invitation.ts`
- `app/plans/[id]/mobile-card/page.tsx`
- `app/plans/[id]/mobile-card/edit/page.tsx`
- `app/plans/[id]/mobile-card/preview/page.tsx`
- `app/i/[slug]/page.tsx`
- `app/o/[slug]/page.tsx`
- `components/features/invitation/InvitationForm.tsx`
- `components/features/invitation/InvitationPreview.tsx`
- `components/features/invitation/ShareLinkButton.tsx`
- `components/features/obituary/ObituaryForm.tsx`
- `components/features/obituary/ObituaryPreview.tsx`

---

## 남은 이슈

1. **`NEXT_PUBLIC_BASE_URL`**: 공개 URL 생성에 사용. 미설정 시 상대 경로만 표시됨. 배포 환경에서 설정 필요.
2. **카드 생성 flow**: `createMobileCard` → `updateMobileCard` 2-step. 추후 단일 action으로 통합 가능.
3. **MobileCardCTA 임시 위치**: 현재 `/plans/[id]`에 직접 노출. AGY/U07/U08 통합 시 `/plans/[id]/support` 허브로 이동 예정.

---

## Merge Risk

| 위험 | 수준 | 비고 |
|---|---|---|
| Prisma 스키마 (신규 모델만 추가) | Low | 기존 모델 수정 없음 |
| `app/plans/[id]/page.tsx` 수정 | **Medium** | AGY/U07 통합 브랜치에서 MobileCardCTA 제거/이동 필요 |
| `/i/`, `/o/` route | Low | 기존 app/ 하위 충돌 없음 확인 |
| Reservation 역방향 relation | Low | DB column 변경 없음 |
| 알람 탭 미연동 | Intentional | TODO 주석으로 명시 |
| `/plans/[id]/support` 미구현 | Intentional | AGY/U07 충돌 방지. 통합 브랜치에서 연결 |
