# AGENTS.md

## Scope
- Only work within the current step.
- Do not fully implement future-step features.
- Schema extensibility for later steps is allowed.

## Workspace rules
- Treat this repository as the only writable workspace.
- Do not modify files outside the project root.

## Protected paths
- Never edit or delete `.venv/`
- Never edit or delete `node_modules/`
- Never edit or delete `.next/`
- Never edit or delete `dist/`
- Never edit or delete `build/`

## Environment
- This project lives in WSL and should be treated as a Linux-first workspace.
- Prefer WSL/Linux-compatible commands.
- A Python virtual environment may already exist in `.venv/`.
- Reuse `.venv/` if needed, but do not recreate or modify it unless explicitly asked.

## Safety
- Do not use destructive commands.
- Ask before deleting files.
- Ask before changing shell configuration, dependency managers, or project-wide tooling.
- Keep all changes within the project root only.

## Domain reference
- Infer the Prisma schema from the current prompt, use cases, and project requirements.
- Prefer practical Prisma modeling over literal UML or inheritance-based modeling.

## Execution
- First write a short implementation plan.
- Then implement only the current step.
- After each milestone, run verification commands and fix failures before finishing.

## Output
Always respond with:
1. implementation plan
2. file list
3. full code
4. run steps
5. verification steps
6. checklist before next step
