# yeON AGENTS.md 업데이트 권장안

> 아래 내용을 프로젝트 루트의 `AGENTS.md` 파일에 반영하세요.

---

```markdown
# yeON - AI Agent Instructions

## Project Overview
yeON is a comprehensive lifecycle management platform for Korean ceremonial events (weddings and funerals). It provides an integrated workflow from event planning, vendor quote management, reservation, invitation sharing, to financial settlement.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.7 (Strict Mode)
- **UI**: shadcn/ui + Tailwind CSS 3.4 + Framer Motion 11
- **ORM**: Prisma 7.7 (SQLite → PostgreSQL for production)
- **Auth**: NextAuth.js 4.24 (JWT)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## Agent Roles

### Claude Code — Frontend & UX Specialist
- **Owns**: `app/` (page components), `components/`, `hooks/`, CSS/Tailwind config
- **Focus**: Interactive UI, Framer Motion animations, theme system, modular quote builder UI
- **Branch prefix**: `feature/ui-*`
- **DO NOT modify**: `prisma/`, `app/actions/`, `lib/state-machine.ts`

### Codex — Backend & Data Logic Specialist
- **Owns**: `prisma/`, `app/actions/`, `lib/`, `types/`
- **Focus**: Prisma schema, Server Actions, state machine logic, data validation
- **Branch prefix**: `feature/api-*`
- **DO NOT modify**: `components/`, `hooks/`, CSS files

## Shared Contracts
- All shared TypeScript interfaces live in `types/` directory
- Both agents MUST import types from `types/` — never define inline types
- Server Actions return `ActionResult<T>` wrapper (see `types/common.ts`)
- Mock data for frontend development goes in `__mocks__/` directory

## Integration Protocol
1. **Types First**: Define shared interfaces in `types/` before implementation
2. **Parallel Dev**: Frontend uses mock data; backend implements real APIs
3. **Integration**: Replace mocks with actual Server Action calls
4. **Verification**: Both agents verify: `tsc --noEmit && lint && build`

## Key Architecture Decisions
- **State Machine Pattern**: All status transitions (quote, reservation) MUST go through `lib/state-machine.ts` validation
- **Modular Pricing**: Vendor services are broken into independent modules (`VendorServiceModule`). Quote responses contain JSON with basePackage + includedModules + optionalModules + excludedModules
- **Context-Aware Theme**: Wedding (warm, fast animations) vs Funeral (cool, slow animations) — controlled by `useTheme` hook
- **Progressive Disclosure**: Multi-step wizard for plan creation instead of single-page forms

## Directory Structure
```
app/
  page.tsx                    # Landing page
  (auth)/                     # Login, signup
  planner/                    # Wedding/funeral workspaces
  actions/                    # Server Actions (Codex)
    plan.ts, quote.ts, reservation.ts, transaction.ts
  api/auth/                   # NextAuth endpoint
components/
  ui/                         # shadcn/ui primitives
    motion/                   # Shared animation wrappers (Claude Code)
  features/planning/          # Feature components (Claude Code)
hooks/                        # Shared React hooks (Claude Code)
lib/                          # Utilities (Codex)
  state-machine.ts            # Status transition validation
  errors.ts                   # Error handling utilities
types/                        # Shared TypeScript interfaces (both)
prisma/                       # Database schema & migrations (Codex)
__mocks__/                    # Mock data for frontend dev (Claude Code)
```

## Current Status
- [x] Project setup (Next.js, Prisma, Tailwind)
- [x] Authentication (NextAuth JWT, 3 demo accounts)
- [x] Basic routing (wedding/funeral split)
- [ ] Prisma schema refinement (VendorServiceModule)
- [ ] State machine implementation
- [ ] Server Actions (quote, reservation)
- [ ] Theme system (wedding/funeral)
- [ ] Animation components (Framer Motion)
- [ ] Modular quote builder UI
- [ ] Multi-step wizard form
- [ ] Quote comparison table
- [ ] Vendor quote editor
- [ ] Settlement system
- [ ] Mobile invitation

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Planner | planner@yeon.local | demo1234 |
| Venue Vendor | venue@yeon.local | demo1234 |
| Catering Vendor | catering@yeon.local | demo1234 |

## Handoff Protocol
When completing a task, update STATUS.md with:
- What was implemented
- Which endpoints/components are now available
- Any breaking changes or new dependencies
```
