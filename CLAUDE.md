
# TennisConnect — Claude Project Instructions

## Project Rules

Before implementing or modifying code, review the relevant existing project rules:

- .cursor/rules/project.mdc
- .cursor/rules/tennisconnect.mdc
- .cursor/rules/react.mdc
- .cursor/rules/ui-design.mdc
- .cursor/rules/playwright.mdc

These Cursor rule files are also part of the project's development guidance. Read the relevant files explicitly; do not assume they are automatically loaded by Claude.

Follow project-wide rules for all tasks, React and UI rules for frontend work, and Playwright rules for automated testing.

## Playwright E2E Testing Rules

Before creating, updating, or executing Playwright tests, read:

- docs/CLAUDE_PLAYWRIGHT_RULES.md
- docs/ci-staging-e2e.md

Never run destructive tests against Production.

Before running tests against Staging, verify the target environment, test-data isolation, and test safety.

Do not run the full Staging regression suite until its safety blockers have been resolved.

## Conflicting Instructions

If any rules conflict, explain the conflict and ask for clarification before making risky changes.

## Change Management

- Keep changes scoped to the requested task.
- Do not commit, push, merge, or deploy unless explicitly requested.
- Do not modify Production configuration or data without explicit approval.
- Report changed files, tests performed, results, and remaining risks.
  