# TennisConnect - PRD

## Original Problem Statement
Запустить существующий проект TennisConnect из GitHub репозитория с подключением к Supabase базе данных.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Express.js + TypeScript + Drizzle ORM
- **Database**: Supabase PostgreSQL (via pooler connection)
- **Storage**: Supabase Storage for media files
- **Auth**: Passport.js with session-based authentication

## What's Been Implemented (March 26, 2026)
- ✅ Cloned repository from GitHub
- ✅ Pulled latest changes (marketplace CRUD, player profile updates)
- ✅ Configured environment variables (.env.dev, client/.env)
- ✅ Configured Supabase PostgreSQL connection via pooler
- ✅ Removed vite-plugin-imagemin (native dependencies issue)
- ✅ Configured nginx proxy for preview
- ✅ Server running on port 3000
- ✅ Database connection working
- ✅ Frontend and backend fully functional

## Environment Configuration
- `.env.dev` - Backend environment (DATABASE_URL, SESSION_SECRET, SUPABASE credentials)
- `client/.env` - Frontend environment (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## Key Endpoints Verified
- GET /api/players - Returns player profiles ✅
- GET /api/coaches - Returns coach profiles ✅
- GET /api/clubs - Returns clubs ✅
- GET /api/auth/me - Authentication check ✅

## Running the Project
```bash
cd /app
NODE_ENV=development npx tsx server/index.ts
```

## Next Tasks / Backlog
- P0: None (project running)
- P1: Add SSL for production deployment
- P2: Image optimization (re-add vite-plugin-imagemin with proper dependencies)
- P3: Add monitoring and logging
