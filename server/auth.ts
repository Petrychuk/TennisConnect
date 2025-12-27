import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { ENV } from "./env";

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
    }
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);

  const sessionSettings: session.SessionOptions = {
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
      secure: app.get("env") === "production",
    },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = { secure: true };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // === Idle timeout middleware ===
  app.use((req, res, next) => {
    if (req.isAuthenticated() && req.session) {
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
    console.log("🔄 deserializeUser id:", id);

    const user = await storage.getUser(id);
    console.log("👤 user from storage:", user);

    if (!user) {
      console.warn("❌ User not found during deserialize");
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
    });
  });

}

export { hashPassword };
