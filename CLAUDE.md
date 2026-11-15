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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

### Local Graphify Environment

Graphify is installed only in this project's `.venv` directory.

- Use `.\.venv\Scripts\graphify.exe` when running Graphify from PowerShell without an activated virtual environment.
- When `.venv` is activated, use `graphify` directly.
- Do not install Graphify globally.
- Do not use Graphify Cloud or paid LLM APIs without explicit approval.
- Keep Graphify analysis and generated files scoped to TennisConnect.
- Never index environment secrets, credentials, or production data.
- If Graphify is unavailable, report the issue instead of installing it globally or changing the environment automatically.
- Follow all existing TennisConnect security, testing, and change-management rules.
