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

## Updates (March 26, 2026 - Session 2)

### New Features Added:
1. **"The Tennis Vault" Pro Shop Section**
   - New arrivals showcase with 4 product cards
   - Badges: New, Bestseller, Pro Choice, Sale
   - External link to shop.tennisconnect.com
   - Mobile responsive with dedicated CTA button

2. **Brand Marquee**
   - 12 tennis brands: Wilson, Babolat, Head, Nike, Adidas, Yonex, Prince, Tecnifibre, Dunlop, Asics, Lacoste, New Balance
   - Smooth infinite scroll animation (120s duration - slow)
   - Compact pill-style brand names
   - Minimal vertical padding

3. **Navigation Update**
   - Added "Shop" link after "Clubs"
   - Opens in new tab (external link)
   - External icon indicator on desktop and mobile

### Files Created/Modified:
- `/app/client/src/components/pro-shop.tsx` (new)
- `/app/client/src/components/brand-marquee.tsx` (new)
- `/app/client/src/components/navbar.tsx` (modified)
- `/app/client/src/pages/home.tsx` (modified)

### Section Order on Homepage:
Hero → AboutUs → ProShop → BrandMarquee → Gallery → Marketplace → Testimonials → Features → Partnership → CTA → Footer

## Updates (March 26, 2026 - Session 3)

### Password Reset Feature Added:
1. **Forgot Password Flow**
   - "Forgot password?" link on login page
   - Email input form with validation
   - Success confirmation with "Check your email" message
   - Toast notifications

2. **Reset Password Page** (`/reset-password?token=...`)
   - Token validation on page load
   - Invalid/expired token handling with error message
   - New password + confirm password form
   - Success state with redirect to login

3. **Backend Endpoints**
   - `POST /api/auth/forgot-password` - Generate reset token, send email
   - `GET /api/auth/verify-reset-token` - Validate token
   - `POST /api/auth/reset-password` - Reset password with token

4. **Database**
   - New table: `password_reset_tokens`
   - Fields: id, userId, token, expiresAt, used, createdAt
   - Token expires in 1 hour

### Files Created/Modified:
- `/app/shared/schema.ts` - Added passwordResetTokens table
- `/app/server/routes.ts` - Added password reset endpoints
- `/app/server/storage.ts` - Added updateUserPassword method
- `/app/server/auth.ts` - Exported comparePasswords
- `/app/client/src/pages/reset-password.tsx` (new)
- `/app/client/src/pages/auth.tsx` - Added forgot password form
- `/app/client/src/App.tsx` - Added reset-password route

### Notes:
- In development mode, reset URL is logged to console and returned in API response
- For production, integrate proper email service (SendGrid, Resend, or Supabase email)

## Updates (April 15, 2026 - Session 4)

### Coach Photo Upload Feature:
1. **Default Photos on Registration**
   - Coach: Default avatar (professional woman) + tennis court cover
   - Player: Default avatar + tennis equipment cover
   - Stored in Supabase Storage

2. **Upload Route Updated**
   - `/api/uploadMedia/:type` now supports both coach and player roles
   - Files stored in `coaches/{userId}/` or `players/{userId}/` based on role
   - Supports avatar and cover uploads

3. **Coaches Page**
   - Cards now display actual avatar from database
   - Fallback to default image if no avatar

4. **Coach Profile Page**
   - Fixed TypeError with null schedule
   - Avatar and cover display properly
   - Edit mode allows photo updates

5. **Session/Auth Fixes**
   - Added session regeneration on login (prevents session fixation)
   - Proper cookie settings for HTTPS (sameSite=none, secure=true)
   - Fixed 401 errors after login

### Files Modified:
- `/app/server/routes/uploadMedia.ts` - Role-based folder selection
- `/app/server/routes.ts` - Default photos on registration, session regeneration
- `/app/client/src/pages/coach-profile.tsx` - Fixed schedule null check, proper upload endpoint
- `/app/client/src/pages/coaches.tsx` - Use avatar from API
- `/app/server/auth.ts` - Secure cookie settings
