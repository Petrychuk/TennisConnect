import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { env } from "./env";
import { pool } from "./db";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(
  supplied: string,
  stored: string,
): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      role: string;
      avatar?: string | null;
      cover?: string | null;
      slug?: string;
      status?: string | null;
      profileCompleted?: boolean | null;
      isAdmin?: boolean;
      isOrganizer?: boolean;
    }
  }
}

export function setupAuth(app: Express) {
  const ONE_HOUR = 1000 * 60 * 60;
  const ONE_DAY = 24 * ONE_HOUR;

  const isProduction = process.env.NODE_ENV === "production";

  // Railway / other reverse proxy
  app.set("trust proxy", 1);

  // PostgreSQL session store - reuses db.ts's single, capped pool
  // instead of opening a second independent one. Two separate pools
  // (each defaulting to pg's max of 10) could total up to 20
  // connections, past the Supabase pooler's 15-connection session-mode
  // ceiling - that's what was behind the "max clients reached" crashes.
  const PgStore = pgSession(session);

  const sessionSettings: session.SessionOptions = {
    store: new PgStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),

    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      maxAge: ONE_DAY,

      // localhost npm start = HTTP
      // Railway production = HTTPS via proxy
      secure: isProduction ? "auto" : false,

      // Same domain: tennisconnect.com.au -> API
      sameSite: "lax",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // === Idle timeout middleware ===
  app.use((req, res, next) => {
    if (req.isAuthenticated() && req.session) {
      // A "remember me" session is meant to stay signed in for the
      // full 30 days regardless of activity gaps - the whole point is
      // not needing to log back in every time. Only the default
      // (non-remembered) 1-day session enforces the 1-hour idle cutoff.
      if ((req.session as any).rememberMe) {
        return next();
      }

      const now = Date.now();
      const lastActivity = (req.session as any).lastActivity || now;

      // 1 час без активности → logout
      if (now - lastActivity > 1000 * 60 * 60) {
        req.logout(() => {
          req.session.destroy(() => {
            res.clearCookie("connect.sid");
          });
        });
        return;
      }

      (req.session as any).lastActivity = now;
    }

    next();
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false);
          }

          const isMatch = await comparePasswords(password, user.password);
          if (!isMatch) {
            return done(null, false);
          }

          return done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            cover: user.cover,
            slug: user.slug,
            status: user.status,
            profileCompleted: user.profileCompleted,
            isAdmin: (user as any).isAdmin || false,
            isOrganizer: (user as any).isOrganizer || false,
          });
        } catch (err) {
          done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

    passport.deserializeUser(async (id: string, done) => {
    // Passport calls this as a plain callback - it does not await the
    // promise this async function returns, so a rejection here would
    // otherwise become an unhandled rejection and crash the process.
    // This runs on every request for a logged-in user, so any transient
    // DB hiccup would take the whole site down instead of just this
    // one request.
    try {
      const user = await storage.getUser(id);

      if (!user) {
        return done(null, false);
      }

      done(null, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        slug: user.slug,
        avatar: user.avatar,
        cover: user.cover,
        status: user.status,
        profileCompleted: user.profileCompleted,
        isAdmin: (user as any).isAdmin || false,
        isOrganizer: (user as any).isOrganizer || false,
      });
    } catch (err) {
      done(err);
    }
  });

}

export { hashPassword, comparePasswords };
