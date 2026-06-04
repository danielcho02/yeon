# U08 Mobile Card — Auto-Draft Prefill & Representative Image

## Problem

모바일 청첩장/부고장 편집 화면(`/plans/[id]/mobile-card/edit`)에 진입하면 확정된 예약 데이터가 있음에도 빈 폼이 표시된다. 예약 확정 이후에 만드는 기능임에도 불구하고 사용자가 날짜·장소·기본 안내 문구를 처음부터 직접 입력해야 하는 UX는 제품 방향에 위배된다. 또한 대표 이미지를 설정할 방법이 없어 카드 완성도가 낮다.

## Evidence

- QA FAIL — `/plans/[id]/mobile-card` 및 `/plans/[id]/mobile-card/edit` 진입 시 모든 필드가 빈 값으로 시작하는 것이 직접 확인됨.
- 기존 `createMobileCard` 서버 액션이 `defaultContent`를 초기화하지만, 해당 값이 카드 생성 후 edit 폼의 초기값으로 올바르게 전달되지 않음 (Assumption — 코드 경로 검증 필요).
- 이미지 필드: `MobileCardData`와 content 타입 어디에도 imageUrl 항목 없음.

## Users

- **Primary**: 결혼·장례 행사 플랜의 소유자 (확정 예약이 1개 이상 존재하는 상태)
- **Not for**: 예약 미확정 플랜 소유자 / 공개 초대장 수신자(하객·조문객)

## Hypothesis

We believe **EventPlan + confirmed Reservation 데이터로 자동 초안을 생성하고 대표 이미지 입력을 지원하는 것**이 **카드 초안 없이 빈 폼이 뜨는 UX 문제를 해결**할 것이다.  
We'll know we're right when **edit 화면 최초 진입 시 날짜·장소 등 핵심 필드가 이미 채워진 상태로 표시되고, 이미지를 설정한 카드가 preview 및 공개 URL에 정상 반영된다.**

## Success Metrics

| Metric | Target | How measured |
|---|---|---|
| edit 진입 시 날짜 필드 자동 채움 | confirmed Reservation.serviceDate → date 필드에 표시 | 수동 QA + seed 데이터로 검증 |
| edit 진입 시 장소 필드 자동 채움 | Reservation.serviceName 또는 EventPlan.venueName → venue 필드에 표시 | 수동 QA |
| 이미지 설정 후 공개 URL 반영 | `/i/[slug]` 또는 `/o/[slug]`에 설정한 이미지 표시 | 수동 QA |
| 빌드 통과 | `npm run build` 0 오류 | CI |
| TypeScript 오류 0 | `npx tsc --noEmit` 통과 | CI |

## Scope

### MVP

1. **자동 초안 prefill 수정** — `createMobileCard`가 이미 prefill을 시도하지만 edit 폼에 전달되지 않는 경로를 수정한다. 또는 `/plans/[id]/mobile-card/edit` 페이지에서 card가 없을 때 `createMobileCard`를 호출한 뒤 초안 내용을 form에 넘겨주는 흐름으로 재설계한다.

2. **Prefill 소스 우선순위 (Wedding)**
   - `date`: `confirmed Reservation.serviceDate` → `EventPlan.scheduledAt` 순
   - `venue`: `Reservation.serviceName` → `EventPlan.venueName` 순
   - `groomName`/`brideName`: 현재 스키마에 직접 필드 없음 → 빈값 허용, form은 "초안 수정" 상태로 표시
   - `greeting`: 고정 기본 문구 ("저희 두 사람이 하나가 되는 날...")

3. **Prefill 소스 우선순위 (Funeral)**
   - `deceasedName`: `EventPlan.honoreeName` → 빈값 허용
   - `funeralHall`: `Reservation.serviceName` → `EventPlan.venueName` 순
   - `departureDatetime`: `confirmed Reservation.serviceDate` → `EventPlan.scheduledAt` 순
   - `chiefMourners`: `EventPlan.hostName` → 빈값 허용
   - `visitingInfo`: 기본 조문 안내 문구

4. **대표 이미지 필드 (URL 입력 방식)**
   - `WeddingCardContent` / `FuneralCardContent` 타입에 `imageUrl?: string` 추가
   - edit 폼에 "대표 이미지 URL" 입력 필드 + 실시간 미리보기
   - `InvitationPreview` / `ObituaryPreview` 컴포넌트에 이미지 표시 영역 추가
   - `/plans/[id]/mobile-card/preview`, `/i/[slug]`, `/o/[slug]` 에 반영

### Out of scope

- 파일 직접 업로드 (`<input type="file">` + 서버 저장) — MVP 이후 별도 브랜치
- 신랑/신부명 자동 추출 (스키마에 해당 필드 없음) — 추후 EventPlan 확장 시
- 카카오톡/SMS 발송 — U08 MVP 외
- 알람 탭 연동 — TODO 주석 유지, 별도 브랜치
- `/plans/[id]/support` hub 구현 — AGY/U07 담당
- 이미지 CDN 연동 — MVP 이후

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Prefill 경로 수정 | edit 진입 시 날짜·장소 등 핵심 필드가 채워진 상태로 표시 | in-progress | `.claude/plans/u08-mobile-card-prefill-image.plan.md` |
| 2 | 대표 이미지 파일 업로드 | 파일 업로드 → public/uploads 저장 → preview·공개 URL에 반영 | in-progress | `.claude/plans/u08-mobile-card-prefill-image.plan.md` |
| 3 | 검증 통과 | tsc·lint·build 통과, seed 시나리오 검증 | in-progress | `.claude/plans/u08-mobile-card-prefill-image.plan.md` |

## Open Questions

- [ ] `createMobileCard`가 생성한 초안이 edit 폼 초기값으로 전달되지 않는 정확한 원인 — 코드 경로 추적 필요 (`/plans/[id]/mobile-card/edit/page.tsx` 서버 액션 흐름)
- [ ] Wedding용 신랑/신부명 소스 — `EventPlan`에 별도 필드 추가 계획이 있는가? (현재 MVP에서는 빈값 허용)
- [ ] `EventPlan.coverImageUrl` 을 모바일 카드 기본 이미지 fallback으로 사용할지 여부

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| edit 페이지 서버/클라이언트 경계에서 prefill 데이터 유실 | Medium | High | page.tsx에서 직접 card.content를 form 초기값으로 전달하는 패턴 확인 |
| imageUrl을 content JSON에 추가하면 기존 저장된 카드와 타입 불일치 | Low | Medium | content 파싱 시 `imageUrl: undefined`를 허용하는 optional 처리로 방어 |
| migration이 필요한 경우 기존 migration 파일 충돌 | Low | Low | content JSON에 추가 시 migration 불필요; 별도 컬럼 추가 시 새 migration 생성 |
| seed 시나리오 D 상태에서 CONFIRMED reservation 없을 경우 테스트 불가 | Medium | Medium | `seed-demo-scenario.ts --state=D` 실행 결과로 사전 확인 |

---
*Status: DRAFT — requirements only. Implementation planning via /plan.*
