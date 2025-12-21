# TennisConnect

## Overview

TennisConnect is a tennis community platform designed for the Australian market, connecting tennis players with partners, coaches, clubs, and a marketplace for gear. The application enables users to create profiles as either players or coaches, find sparring partners, book coaching sessions, browse tennis clubs, and buy/sell tennis equipment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **Styling**: Tailwind CSS v4 with custom theme configuration
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives
- **Animations**: Framer Motion for page transitions and micro-interactions
- **State Management**: TanStack React Query for server state, React Context for auth state
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful API with JSON responses
- **Authentication**: Session-based auth using Passport.js with local strategy
- **Password Hashing**: scrypt with salt for secure password storage
- **Session Storage**: MemoryStore (development), with connect-pg-simple available for production

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Validation**: drizzle-zod for automatic Zod schema generation from database tables
- **Migrations**: Drizzle Kit with `db:push` command for schema sync

### Data Models
- **Users**: Core authentication with role-based access (player/coach)
- **PlayerProfiles**: Extended player data including skill level, location, preferred courts
- **CoachProfiles**: Coach-specific data with ratings, rates, schedule, photos
- **Tournaments**: User-created tournament entries
- **MarketplaceItems**: Gear listings for buy/sell
- **Clubs**: Tennis club directory

### Build System
- **Development**: Vite dev server with HMR for frontend, tsx for backend
- **Production Build**: esbuild bundles server to single file, Vite builds client
- **Static Serving**: Express serves built client from `dist/public`

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Route pages
│   │   ├── lib/          # Utilities and context
│   │   └── hooks/        # Custom React hooks
├── server/           # Express backend
│   ├── auth.ts       # Authentication setup
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── db.ts         # Database connection
├── shared/           # Shared code
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Connection**: pg Pool with Drizzle ORM wrapper

### Authentication
- **Passport.js**: Authentication middleware
- **express-session**: Session management
- **passport-local**: Username/password strategy

### UI Libraries
- **Radix UI**: Full suite of accessible UI primitives
- **Lucide React**: Icon library
- **embla-carousel-react**: Carousel functionality
- **react-day-picker**: Calendar/date picker
- **cmdk**: Command palette component
- **vaul**: Drawer component

### Development Tools
- **Vite**: Frontend dev server and bundler
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for development
- **@replit/vite-plugin-cartographer**: Replit-specific dev tooling
- **esbuild**: Production bundler for server code

### Validation & Utilities
- **Zod**: Runtime type validation
- **date-fns**: Date manipulation
- **class-variance-authority**: Component variant styling
- **clsx/tailwind-merge**: Class name utilities