# 🎾 TennisConnect

**TennisConnect** is an Australian tennis community and session management platform connecting players, coaches, clubs, organisers, and tennis businesses.

The platform combines tennis discovery, community features, organiser tools, and real-time session management in one ecosystem.

🌐 Production: https://tennisconnect.com.au

---

## About TennisConnect

TennisConnect is designed to make it easier to discover, organise, and manage tennis activities.

Players can connect with other players, discover coaches, clubs, sessions, tournaments, and tennis experiences.

Organisers can manage their tennis communities, registrations, players, sessions, and live tennis activities from a dedicated Organiser Hub.

The platform is initially focused on the Australian tennis community.

---

## Core Features

### Players

- Player profiles
- Tennis level and playing preferences
- Player discovery
- Tennis results and statistics
- Community participation
- Session and tournament registration
- Direct messaging

### Coaches

- Professional coach profiles
- Coaching information and services
- Availability and pricing
- Player discovery
- Community participation
- Organiser capabilities

### Clubs & Communities

- Tennis club directory
- Community pages
- Club information and facilities
- Community membership
- Follow and favourite functionality

### Sessions & Tournaments

- Social tennis sessions
- Tournament listings
- Player registration
- Registration approval
- Waiting lists
- Player management
- Session results

### Organiser Hub

Organisers have access to dedicated tools for managing tennis activities.

Features include:

- Dashboard
- Sessions
- Players
- Registration management
- Seasons
- Session configuration
- Live session management
- Results and leaderboards

### TennisConnect Live

TennisConnect Live provides real-time tools for running organised tennis sessions.

Current architecture supports:

Registration → Check-in → Live Rounds → Court Assignment → Scores → Results

The Live Engine is being developed to support:

- QR and manual check-in
- Court allocation
- Doubles pairing
- Multiple rounds
- Score submission
- Result confirmation
- Automatic next-round generation
- Final leaderboards
- Player statistics

### Travel & Tennis Experiences

- Tennis retreats
- Tennis travel packages
- Event information
- Galleries
- External booking options

### Marketplace

TennisConnect includes a tennis marketplace for discovering tennis-related products and services.

---

## User Roles

TennisConnect supports multiple user roles and capabilities:

- Player
- Coach
- Player / Organiser
- Coach / Organiser
- Admin

Role-based access controls determine available platform functionality.

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Wouter
- Tailwind CSS
- shadcn/ui
- Radix UI
- TanStack Query
- React Hook Form
- Zod
- Framer Motion

## Backend

- Node.js
- Express
- TypeScript
- REST API
- Passport.js
- Session-based authentication

## Database

- PostgreSQL
- Drizzle ORM
- Supabase PostgreSQL

Database schemas are shared between the frontend and backend where appropriate.

Primary schema:

```text
shared/schema.ts
```

## Storage

Media files are stored using **Supabase Storage**.

Storage is used for:

- Avatars
- Profile covers
- Articles
- Clubs
- Travel packages
- Tournament media
- Other platform content

## Testing

End-to-end testing is implemented with:

- Playwright
- TypeScript

Tests cover authentication, access control, profiles, and other critical user flows.

## Deployment

Application hosting and deployment:

- Railway

Database and media infrastructure:

- Supabase

---

# Project Structure

```text
TennisConnect/
│
├── client/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── pages/
│
├── server/
│   ├── routes/
│   ├── services/
│   ├── seeds/
│   ├── auth.ts
│   ├── db.ts
│   ├── storage.ts
│   └── index.ts
│
├── shared/
│   ├── constants/
│   └── schema.ts
│
├── migrations/
│
├── scripts/
│
├── tests/
│   ├── access/
│   ├── admin/
│   ├── auth/
│   ├── fixtures/
│   ├── helpers/
│   ├── profile/
│   ├── public/
│   ├── security/
│   └── setup/
│
├── playwright.config.ts
├── drizzle.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

# Environments

TennisConnect uses separate environments for development, staging, and production.

## Development

Used for local development and debugging.

```bash
npm run dev
```

## Staging

Staging is used for integration testing and verification before production deployment.

Staging has:

- Separate PostgreSQL database
- Separate Supabase project
- Separate Supabase Storage
- Independent environment configuration

Production data can be synchronised into staging when required.

## Production

Production contains live TennisConnect data and real user accounts.

Production and staging must always remain isolated.

---

# Environment Variables

Environment-specific configuration is stored outside the source code.

Typical server variables include:

```text
DATABASE_URL
SESSION_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Client-side variables use the `VITE_` prefix where required.

> Never commit passwords, service role keys, database credentials, session secrets, or other sensitive values to Git.

---

# Local Development

Install dependencies:

```bash
npm install
```

Start the development application:

```bash
npm run dev
```

The local application is available at:

```text
http://localhost:3000
```

---

# TypeScript Check

Run the project TypeScript validation:

```bash
npm run check
```

This should be run before committing or deploying changes.

---

# Production Build

Create a production build:

```bash
npm run build
```

The build generates:

```text
dist/
├── index.cjs
└── public/
```

Start the production build:

```bash
npm start
```

---

# Database

TennisConnect uses PostgreSQL with Drizzle ORM.

Database changes must always be tested against staging before being applied to production.

## Staging

```bash
npm run db:push:staging
```

## Production

```bash
npm run db:push:prod
```

Production database operations should only be executed after the same schema change has been successfully verified on staging.

---

# Production → Staging Sync

Production data can be synchronised into staging with:

```bash
npm run staging:sync
```

Direction:

```text
PRODUCTION
     │
     ▼
  STAGING
```

The sync process is designed to:

- Upsert production database records into staging
- Preserve staging-only records
- Keep production unchanged
- Copy production media into staging Storage
- Convert production Storage URLs to staging URLs
- Keep `user_sessions` independent from production

Never use staging as a source for production data.

---

# Playwright Tests

Run all Playwright tests:

```bash
npx playwright test
```

Run a specific test file:

```bash
npx playwright test tests/auth/login.spec.ts
```

Run a specific test by test name:

```bash
npx playwright test -g "Login Player"
```

Run tests in headed mode:

```bash
npx playwright test --headed
```

Run Playwright UI mode:

```bash
npx playwright test --ui
```

Open the latest Playwright report:

```bash
npx playwright show-report
```

Generated Playwright reports and test artifacts should not be committed to the repository.

---

# Development Workflow

The standard TennisConnect development workflow is:

```text
main
 │
 ├── create feature/fix branch
 │
 ▼
Development
 │
 ▼
TypeScript check
 │
 ▼
Playwright / manual testing
 │
 ▼
Staging
 │
 ▼
Verify database changes
 │
 ▼
Verify application
 │
 ▼
Merge into main
 │
 ▼
Production deployment
```

Example:

```bash
git switch main
git pull origin main

git switch -c feature/example-feature
```

After development:

```bash
npm run check
npm run build
```

Commit:

```bash
git add .
git commit -m "feat: add example feature"
git push -u origin feature/example-feature
```

After successful staging verification, merge the feature into `main`.

---

# Security

TennisConnect follows standard production security practices.

Important principles:

- Passwords are never stored in plain text
- Authentication uses secure password hashing
- Sessions use secure cookies
- Production and staging credentials are isolated
- Sensitive credentials are stored in environment variables
- Uploads are validated
- Authentication endpoints are protected against abuse
- CORS is environment-specific
- Production security headers are enabled
- Role-based access protects restricted functionality
- Development-only functionality must not be publicly exposed in production

Secrets, passwords, database URLs, service-role keys, and test credentials must never be committed to Git.

---

# Responsive Design

TennisConnect is designed for:

- Desktop
- Tablet
- Mobile

All new user-facing functionality should support all three layouts.

---

# Development Principles

The project prioritises:

1. Readability
2. Maintainability
3. Reusability
4. Responsive design
5. Stable APIs
6. Security
7. Testability
8. User experience
9. Clean architecture

Changes should remain focused and avoid unnecessary modifications to unrelated functionality.

---

# Status

TennisConnect is under active development.

The platform is being prepared for public use while additional organiser and real-time tennis management capabilities continue to be developed.

---

## TennisConnect

**Connect. Play. Compete.**

© 2026 TennisConnect. All rights reserved.
