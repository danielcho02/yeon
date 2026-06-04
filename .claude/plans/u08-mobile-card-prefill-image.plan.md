# Plan: U08 Mobile Card — Auto-Draft Prefill & Representative Image

**Source PRD**: `.claude/prds/u08-mobile-card-prefill-image.prd.md`
**Selected Milestone**: All 3 milestones (Prefill 수정 + 이미지 추가 + 검증) — tightly coupled
**Complexity**: Medium

---

## Summary

현재 `/plans/[id]/mobile-card/edit`은 `card?.content`가 null일 때 `undefined`를 form에 전달하여 빈 폼이 뜬다. 수정은 `edit/page.tsx`에서 `plan.reservations[0]` + `EventPlan` 필드로 prefill 객체를 직접 생성해 form에 넘기는 것으로 해결된다. 이미지는 Next.js Server Action + `fs.writeFile`로 `public/uploads/mobile-cards/`에 저장하고, content JSON에 `imageUrl` 필드를 추가하는 방식으로 구현한다.

---

## Root Cause

`app/plans/[id]/mobile-card/edit/page.tsx:41`:
```typescript
const card = plan.mobileCard ? mapMobileCard(plan.mobileCard) : null;
// card가 null이면 card?.content = undefined
// InvitationForm은 initialContent={undefined} → 기본값 {} → 빈 폼
```

`plan.reservations[0]`은 이미 로드되어 있지만 prefill에 사용되지 않음.
`plan.honoreeName`, `plan.hostName`, `plan.venueName`, `plan.region`, `plan.scheduledAt`은 모두 EventPlan 기본 필드로 별도 include 없이 로드됨.

---

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `app/actions/invitation.ts:40` | server action: `camelCase`, returns `ActionResult<T>` |
| Error handling | `app/actions/invitation.ts:136` | `try/catch` → `actionError(getActionError(error), "CODE")` |
| Data access | `app/actions/invitation.ts:62` | `withPrismaRetry(() => prisma.xxx.yyy(...))` |
| Server action in page | `edit/page.tsx:45` | inline `async function handleSaveX() { "use server"; ... }` |
| Content type | `types/invitation.ts:12` | interface with optional fields `?: string` |
| Form initial value | `InvitationForm.tsx:15` | `initialContent = {}` default, `defaultValue={initialContent.field ?? ""}` |

---

## Files to Change

| File | Action | Why |
|---|---|---|
| `types/invitation.ts` | UPDATE | `imageUrl?: string` 추가 (WeddingCardContent, FuneralCardContent) |
| `app/actions/invitation.ts` | UPDATE | Zod schema에 imageUrl 추가; `uploadMobileCardImage` action 추가 |
| `app/plans/[id]/mobile-card/edit/page.tsx` | UPDATE | Prefill 로직 추가; 헤더 텍스트 수정 |
| `components/features/invitation/InvitationForm.tsx` | UPDATE | imageUrl 상태 + 파일 업로드 UI + preview |
| `components/features/obituary/ObituaryForm.tsx` | UPDATE | 동일 |
| `components/features/invitation/InvitationPreview.tsx` | UPDATE | imageUrl 있으면 상단 이미지 표시 |
| `components/features/obituary/ObituaryPreview.tsx` | UPDATE | 동일 |
| `.gitignore` | UPDATE | `public/uploads/mobile-cards/` 추가 (.gitkeep 제외) |
| `public/uploads/mobile-cards/.gitkeep` | CREATE | 업로드 디렉터리 존재 보장 |
| `docs/branch-status/u08-mobile-invitation-obituary.md` | UPDATE | 변경사항 반영 |

**수정 금지 확인:**
- `app/planner/` — 미수정
- `components/features/planning/` — 미수정
- `app/actions/quote.ts` — 미수정
- `lib/vendor-packages.ts` — 미수정
- `prisma/schema.prisma` — **미수정** (imageUrl은 content JSON에 추가, migration 불필요)
- `app/plans/[id]/page.tsx` — **미수정** (CTA 유지)

---

## Tasks

### Task 1: Types — imageUrl 필드 추가

**File**: `types/invitation.ts`

`WeddingCardContent`와 `FuneralCardContent` 인터페이스 모두에 `imageUrl?: string` 추가.

**Validate**: `npx tsc --noEmit`

---

### Task 2: Actions — Zod 업데이트 + 이미지 업로드 action

**File**: `app/actions/invitation.ts`

**2-A**: 두 Zod schema에 추가:
```typescript
imageUrl: z.string().url().optional().or(z.literal("")),
```

**2-B**: `uploadMobileCardImage(formData: FormData)` server action 추가:
- `requireGeneralUser()` 호출 (소유자 검증)
- `formData.get("file")` — File 타입 검증
- 파일 타입 allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- 파일 크기 제한: 5MB
- 파일명: `{Date.now()}-{random}.{ext}`
- `fs.mkdir(uploadDir, { recursive: true })` + `fs.writeFile(...)` 로 저장
- 저장 경로: `public/uploads/mobile-cards/`
- 반환: `ActionResult<{ imageUrl: string }>` where imageUrl = `/uploads/mobile-cards/{fileName}`

**Validate**: `npx tsc --noEmit`

---

### Task 3: Edit Page — Prefill 로직 추가

**File**: `app/plans/[id]/mobile-card/edit/page.tsx`

**3-A**: `card === null`일 때 prefill 생성:

Wedding prefill 규칙:
- `date`: `reservation.serviceDate?.toISOString().split("T")[0]` → `plan.scheduledAt?.toISOString().split("T")[0]` 순
- `venue`: `reservation.serviceName` → `plan.venueName` 순
- `venueAddress`: `plan.region`
- `greeting`: 고정 기본 웨딩 초대 문구 (4줄)

Funeral prefill 규칙:
- `deceasedName`: `plan.honoreeName`
- `funeralHall`: `reservation.serviceName` → `plan.venueName` 순
- `funeralHallAddress`: `plan.region`
- `departureDatetime`: `reservation.serviceDate?.toISOString().slice(0, 16)` → `plan.scheduledAt?.toISOString().slice(0, 16)` 순
- `chiefMourners`: `plan.hostName`
- `visitingInfo`: 고정 기본 조문 안내 문구 (3줄)

**3-B**: form에 전달:
```typescript
// 기존: card?.content as Partial<WeddingCardContent>
// 수정: card ? (card.content as Partial<WeddingCardContent>) : weddingPrefill
```

**3-C**: 헤더 텍스트:
- `card ? "편집" : "초안 수정"`
- `card ? "내용을 수정하고 저장하세요." : "예약 정보 기반 자동 초안을 확인하고 수정해 주세요."`

**Validate**: CONFIRMED reservation이 있는 플랜에서 edit 진입 시 날짜·장소 채워짐 확인

---

### Task 4: InvitationForm — imageUrl 필드 + 파일 업로드

**File**: `components/features/invitation/InvitationForm.tsx`

변경:
1. `useState` import 추가
2. `uploadMobileCardImage` import 추가
3. `imageUrl` state: `useState(initialContent?.imageUrl ?? "")`
4. `isUploading` state: `useState(false)`
5. `handleFileChange`: 파일 선택 → `uploadMobileCardImage(fd)` 호출 → `setImageUrl(result.data.imageUrl)`
6. `content` 객체에 `imageUrl: imageUrl || undefined` 포함
7. 폼 UI에 이미지 섹션 추가:
   - `<input type="file" accept="image/*">` + 업로드 중 표시
   - 업로드 완료 시 `<img>` preview (max-h-40, object-cover)
   - rose 계열 스타일 유지

**Validate**: `npx tsc --noEmit`

---

### Task 5: ObituaryForm — 동일 패턴 적용

**File**: `components/features/obituary/ObituaryForm.tsx`

Task 4와 동일. 스타일은 slate 계열 유지.
- 파일 입력 버튼: slate 계열
- 이미지 preview: `rounded-xl`, 장식 없음
- 금색/confetti 완전 배제

**Validate**: `npx tsc --noEmit`

---

### Task 6: Preview 컴포넌트 — 이미지 표시

**File**: `components/features/invitation/InvitationPreview.tsx`
- `content.imageUrl`이 있으면 ✿ 헤더 아래에 이미지 표시
- `rounded-2xl overflow-hidden`, max-height 200px, object-cover
- `alt="대표 이미지"` 설정

**File**: `components/features/obituary/ObituaryPreview.tsx`
- `content.imageUrl`이 있으면 부고 헤더 텍스트 아래에 표시
- `rounded-xl overflow-hidden`, max-height 180px, object-cover
- 장식 없음, slate 계열 보더만

---

### Task 7: 인프라

**`.gitignore`** 추가:
```
# Mobile card uploads (local only)
public/uploads/mobile-cards/*
!public/uploads/mobile-cards/.gitkeep
```

**`public/uploads/mobile-cards/.gitkeep`** 생성 (빈 파일)

---

### Task 8: 문서 업데이트

**`docs/branch-status/u08-mobile-invitation-obituary.md`**:
- imageUrl (content JSON) 추가 기록
- 파일 업로드 action 추가 기록
- Prefill 수정 사항 기록
- `public/uploads/mobile-cards/` 경로 언급

---

## 자동 초안 생성 흐름 (최종)

```
사용자: /plans/[id]/mobile-card 진입
  └─ plan.mobileCard 없음 → redirect to edit

사용자: /plans/[id]/mobile-card/edit 진입
  └─ card = null
     └─ edit/page.tsx에서 plan + reservation[0]으로 prefillContent 생성
        └─ InvitationForm / ObituaryForm에 initialContent={prefillContent}
           └─ 날짜·장소·기본 문구가 채워진 상태로 렌더링

사용자: 내용 수정 후 저장
  └─ handleSaveWedding / handleSaveFuneral 호출
     └─ card 없으면: createMobileCard(planId) → updateMobileCard(cardId, content)
     └─ card 있으면: updateMobileCard(cardId, content)
        └─ redirect to /plans/[id]/mobile-card
```

---

## 이미지 저장 방식

| 항목 | 결정 |
|---|---|
| 저장 위치 | `public/uploads/mobile-cards/{timestamp}-{random}.{ext}` |
| DB 저장 | `MobileCard.content` JSON 내 `imageUrl` 필드 |
| Schema 변경 | **없음** |
| Migration 변경 | **없음** |
| 파일 크기 제한 | 5MB |
| 허용 형식 | jpg, png, webp, gif |
| Git 추적 | `.gitignore`에 `public/uploads/mobile-cards/*` 추가 |

---

## Validation

```bash
npm run db:generate
npx prisma migrate reset --force
npm run db:seed
npx tsx scripts/seed-demo-scenario.ts --state=D
npx tsx scripts/verify-demo-scenario.ts --state=D
npx tsc --noEmit
npm run lint
npm run build
git diff --check
git status --short
# tsbuildinfo dirty면:
git restore tsconfig.tsbuildinfo
```

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `plan.reservations[0]` 서비스 날짜 null | Low | optional chaining + fallback chain으로 처리 |
| `uploadMobileCardImage`에서 File instanceof 실패 | Low | `!(file instanceof File)` 체크로 방어 |
| imageUrl 기존 저장 카드에 없으면 타입 에러 | Low | optional 필드 — TypeScript 안전 |
| `public/uploads/` git 포함 | Medium | .gitignore에 명시 추가 + .gitkeep으로 폴더만 추적 |
| next/image 없이 `<img>` 사용 | Low | 로컬 public 경로는 최적화 불필요 |

---

## Merge Risk (업데이트)

| 위험 | 수준 | 비고 |
|---|---|---|
| `app/plans/[id]/page.tsx` | **Medium** | 이번 task 수정 없음; 기존 medium 유지 |
| `types/invitation.ts` | Low | optional 필드만 추가 |
| Forms / Preview | Low | 기존 인터페이스 유지 |
| `app/actions/invitation.ts` | Low | 기존 함수 시그니처 유지, 새 함수 추가만 |
| `public/uploads/` | Low | .gitignore 처리 |

---

## Acceptance

- [ ] `/plans/[id]/mobile-card/edit` 최초 진입 시 날짜·장소 필드가 CONFIRMED reservation 데이터로 채워짐
- [ ] Wedding: 기본 웨딩 초대 문구 자동 입력
- [ ] Funeral: 고인명(honoreeName), 상주(hostName), 기본 조문 안내 문구 자동 입력
- [ ] 파일 업로드 → edit/preview/`/i/[slug]`/`/o/[slug]` 이미지 반영
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과
- [ ] `npm run lint` 통과
- [ ] 장례 화면에 금색/축하/confetti 톤 없음
