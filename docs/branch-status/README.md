# Branch Status Documents

This directory tracks parallel feature-branch progress for yeON.

Global documents:
- `STATUS.md`: main/global project status only.
- `docs/PM_DEVELOPMENT_ROADMAP.md`: product roadmap and PM-level direction only.

Branch-specific documents:
- `u06-reservation-change-cancel.md`: reservation change/cancel branch.
- `u08-mobile-invitation-obituary.md`: mobile invitation/obituary branch.
- `u07-money-settlement.md`: congratulatory/condolence money settlement branch.

Rules:
1. Each feature branch updates only its own branch-status document.
2. Do not let multiple branches edit the same status file unless it is an integration branch.
3. Record schema changes, server actions, UI routes, validation results, QA notes, and merge risks.
4. After merge, summarize completed work back into `STATUS.md` and `docs/PM_DEVELOPMENT_ROADMAP.md`.
