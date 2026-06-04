# U08 Mobile Invitation / Obituary Branch Status

> Branch: `claude/u08-mobile-invitation-obituary`
> Owner/Agent: Claude
> Scope: Mobile invitation and obituary MVP

## Goal

Implement mobile invitation/obituary MVP.

## Product Rules

- Build MVP around create/edit/preview/share URL.
- Do not implement real SMS/Kakao sending API yet.
- Wedding invitation and funeral obituary should share structure where possible, but preserve tone differences.
- Funeral tone must remain calm and non-celebratory.
- Public share page should be readable on mobile.

## Expected Areas

- `app/invitations/`
- `app/obituaries/`
- `components/features/invitation/`
- `components/features/obituary/`
- `types/invitation.ts`
- `app/actions/invitation.ts` if persistence is needed
- minimal Prisma additions only if persistence is needed

## Must Not Touch

- Reservation change/cancel action logic
- Money settlement logic
- Vendor package/quote core contracts
- Notification/alarm integration beyond TODO notes

## Current Status

- Not started.

## Validation Log

Pending.

## Manual QA Notes

Pending.

## Merge Risks

- Public route naming may overlap with future alarm/settlement links.
- If Prisma schema is changed, coordinate migration names carefully.
