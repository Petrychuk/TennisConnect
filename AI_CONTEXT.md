# AI_CONTEXT.md

# TennisConnect

TennisConnect is a production-ready tennis community platform for Australia.

The project is actively developed and follows consistent architecture and coding standards.

---
# Load command AI
TEXT -> "Read AI_CONTEXT.md first and follow all project conventions."

# Tech Stack

Frontend

- React
- Vite
- TypeScript
- Wouter
- Tailwind CSS
- shadcn/ui
- Framer Motion

Backend

- Node.js
- Express
- PostgreSQL
- Drizzle ORM
- Supabase Storage

Testing

- Playwright

Deployment

- Railway

---

# Project Goals

The project should remain:

- Clean
- Modern
- Scalable
- Easy to maintain
- Easy to understand

Readability is more important than clever code.

---

# Architecture

Never change project architecture unless explicitly requested.

Always preserve existing structure.

Folder structure:

client/
server/
shared/
tests/

Routes are separated into dedicated files.

Shared reusable components belong in:

client/src/components/shared

UI components belong in:

client/src/components/ui

Feature-specific components remain inside feature folders.

---

# Coding Rules

Always use TypeScript.

Prefer explicit types.

Avoid using any.

Prefer const over let.

Never use var.

Use async/await.

Prefer early return.

Avoid deeply nested conditions.

Do not create duplicate logic.

Reuse existing components whenever possible.

Never modify unrelated code.

Keep changes minimal.

---

# React Rules

Use functional components only.

One component per file.

Maximum component size:

300 lines

Split large components into smaller reusable ones.

Preferred component structure:

1. Imports

2. Interfaces

3. Hooks

4. useEffect

5. Event handlers

6. Helper functions

7. JSX

---

# useEffect

Each useEffect should contain a short comment.

Example

// Fetch players

useEffect(() => {

}, []);

Avoid multiple unrelated responsibilities inside one useEffect.

---

# Functions

Function names should start with verbs.

Examples

fetchPlayers

saveProfile

updateCoach

deleteTournament

loadArticles

Every exported function should contain a short comment.

Example

// Save player profile

const handleSave = async () => {

};

---

# Styling

Tailwind CSS only.

Avoid inline styles.

Follow TennisConnect design language.

Design should be

- clean
- premium
- spacious
- sports-oriented
- modern

Avoid clutter.

Whitespace is preferred over dense layouts.

---

# Responsive Design

Every feature must work on

Desktop

Tablet

Mobile

Never build desktop-only layouts.

---

# API

Do not modify backend unless explicitly requested.

Preserve existing endpoints.

Preserve response formats.

Prefer pagination for all lists.

Typical API response:

{
  data,
  pagination
}

or

{
  players,
  pagination
}

or

{
  coaches,
  pagination
}

Pagination object:

page

limit

total

totalPages

---

# Images

Avatar uploads:

avatar.webp

Cover uploads:

cover.webp

Do not overwrite gallery images.

---

# Comments

Use meaningful comments.

Good:

// Fetch players

// Upload avatar

// Save profile

Bad:

// Set variable

Avoid obvious comments.

---

# Playwright

All UI features should be testable.

Prefer data-testid selectors.

Never remove existing test ids.

Test structure:

// ---------- Login ----------

// ---------- Verify ----------

// ---------- Test Data ----------

// ---------- Actions ----------

// ---------- Save ----------

// ---------- Reload ----------

// ---------- Final Verification ----------

---

# Naming

React Components

PascalCase

PlayerCard

CoachCard

Variables

camelCase

Functions

camelCase

Constants

UPPER_CASE

---

# Formatting

Use Prettier.

Use ESLint.

Maximum line length:

80–100 characters.

Use empty lines between logical blocks.

Keep JSX readable.

---

# Performance

Avoid unnecessary renders.

Avoid duplicate API requests.

Reuse fetched data whenever possible.

Memoize only when needed.

---

# User Experience

UI should feel smooth.

After:

Saving

Uploading

Pagination

Filtering

Searching

Always keep transitions smooth.

Use smooth scrolling where appropriate.

---

# AI Instructions

Before generating code:

Search for existing implementation.

Reuse existing components.

Preserve current project style.

Do not rename variables without reason.

Do not refactor unrelated files.

Do not change backend unless requested.

Generate production-ready code.

When editing existing files:

Modify only the requested functionality.

Preserve formatting.

Preserve comments.

Keep diffs as small as possible.

---

# Educational Mode

The project owner is actively learning software engineering.

When generating new code:

Prefer readability over clever solutions.

Add short educational comments for important logic.

Keep explanations simple.

Avoid unnecessary abstractions.

Explain architectural decisions when introducing new patterns.

---

# Final Principle

This project values:

1. Readability

2. Reusability

3. Maintainability

4. Responsive Design

5. Stable API

6. Testability

7. User Experience

8. Clean Architecture

Always follow these principles unless explicitly instructed otherwise.
