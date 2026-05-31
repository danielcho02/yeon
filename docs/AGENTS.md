# Agents

> See [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md) for the current agent rules.
>
> All yeON agents are full-stack by default as of 2026-05-31.
> The prior frontend/backend split model is retired.

---

## Preserved Workspace Rules

The following workspace safety rules from the original AGENTS.md remain in effect:

- Treat this repository as the only writable workspace.
- Do not modify files outside the project root.
- Never edit or delete `.venv/`, `node_modules/`, `.next/`, `dist/`, `build/`.
- This project lives in WSL — use Linux-compatible commands.
- Do not use destructive commands; ask before deleting files.
- Ask before changing shell configuration, dependency managers, or project-wide tooling.

## Execution Pattern

1. Write a short implementation plan.
2. Read all affected layers (see AGENT_OPERATING_MODEL.md Rule 1).
3. Implement only the current scope.
4. After each milestone, run the full validation suite.
5. Fix failures before finishing.
6. Stop before push — always ask the user first.

## Output Format

Always respond with:
1. Implementation plan
2. File list
3. Full code changes
4. Run steps
5. Verification steps
6. Checklist before next step
