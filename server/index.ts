import express, { type Request, Response, NextFunction } from "express";

// Must be registered before anything else runs. See comment below for why.
//
// "[CRASH-GUARD]" is a fixed, greppable prefix - when the server goes
// unreachable in prod, search the Railway logs for that string. If it's
// there, something below threw/rejected without a try/catch and this
// caught it (check the stack trace for where). If it's NOT there but the
// service still went down, the crash happened somewhere these two
// handlers can't see (e.g. the process was OOM-killed or hard-killed by
// the platform before it could log) - see the SIGTERM/SIGINT handlers
// further down, which tell that apart from an ordinary redeploy.
process.on("unhandledRejection", (reason) => {
  console.error(
    `[CRASH-GUARD] ${new Date().toISOString()} Unhandled promise rejection (process kept alive):`,
    reason,
  );
});
process.on("uncaughtException", (err) => {
  console.error(
    `[CRASH-GUARD] ${new Date().toISOString()} Uncaught exception (process kept alive):`,
    err,
  );
});
// Railway (and most platforms) send SIGTERM before stopping/replacing a
// container - both for a normal redeploy AND right before a health-check
// failure kills it. Logging this makes it possible to tell "the platform
// intentionally restarted this" apart from "the process vanished with no
// warning" (the latter means something below crashed hard enough that
// even the guards above never ran - e.g. an out-of-memory kill).
process.on("SIGTERM", () => {
  console.error(`[CRASH-GUARD] ${new Date().toISOString()} Received SIGTERM - process is shutting down.`);
  process.exit(0);
});
process.on("SIGINT", () => {
  console.error(`[CRASH-GUARD] ${new Date().toISOString()} Received SIGINT - process is shutting down.`);
  process.exit(0);
});
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";

const app = express();

// Health Check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "TennisConnect",
    env: process.env.DB_ENV,
    version: process.env.RAILWAY_GIT_COMMIT_SHA || "local",
    timestamp: new Date().toISOString(),
  });
});

// Canonical-domain redirect: the bare apex (tennisconnect.com.au) has a
// perfectly valid SSL cert of its own (Railway issues one for every
// connected custom domain) and serves the app directly with its own
// 200 - it was never "insecure", it just was never redirected to the
// www version the GA4 stream, SEO, and everything else already treat as
// canonical. Without this, apex and www are two separate origins split-
// ing session/analytics identity and diluting SEO between them. Placed
// right after /health (so Railway's own health checks, which don't hit
// this hostname, are never affected) and before everything else, so it
// runs before any other work happens on a request that's just going to
// be redirected anyway. Scoped to the exact apex hostname only, so local
// dev (localhost) and the Railway-assigned *.up.railway.app hostname are
// both untouched.
app.use((req, res, next) => {
  if (req.hostname === "tennisconnect.com.au") {
    return res.redirect(301, `https://www.tennisconnect.com.au${req.originalUrl}`);
  }
  next();
});

// Security headers (CSP, X-Frame-Options, etc). `crossOriginEmbedderPolicy`
// off + a permissive `img-src`/`connect-src` because we load images and
// call out to Supabase Storage from third-party origins - tighten this
// further (esp. connect-src) once every external host we hit is known.
// `script-src`/`connect-src` also allow Google Analytics (gtag.js in
// client/index.html loads from googletagmanager.com, runs inline, and
// reports events to google-analytics.com) - 'unsafe-inline' is needed
// since that snippet is a plain inline <script>, not nonce/hash-based.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": [
          "'self'",
          "https:",
          "https://www.google-analytics.com",
          "https://analytics.google.com",
        ],
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://www.googletagmanager.com",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration for remote access.
// In production only the deployed frontend (BASE_URL) is allowed, PLUS
// whatever origin the request itself came in on - this app always
// serves the client and API from the same origin (server/static.ts in
// prod, Vite middleware in dev), so a same-origin request should never
// be rejected just because BASE_URL wasn't set to that exact host:port
// (e.g. testing a local production build on a different port). Requests
// with no Origin header (server-to-server, curl, same-origin fetches
// some browsers omit it for) are let through since there's nothing to
// check.
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = [
  process.env.BASE_URL,
  ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:5173"]),
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors((req, callback) => {
    const requestOrigin = req.header("Origin");
    const selfOrigin = `${req.protocol}://${req.get("host")}`;
    const allowed =
      !requestOrigin ||
      allowedOrigins.includes(requestOrigin) ||
      requestOrigin === selfOrigin;

    callback(null, { origin: allowed, credentials: true });
  }),
);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
console.log("🟢 routes.ts loaded");

// gzip/brotli-compress every text response (JS/CSS/HTML/JSON) before it
// goes over the wire - the built JS bundles were being sent completely
// uncompressed. This typically cuts transferred bytes for text assets by
// 60-80%, which matters most for whatever the browser needs before it can
// render anything (the LCP path). Doesn't touch already-compressed
// formats (images, etc.) - compression's default filter skips those.
app.use(compression());

app.use(
  express.json({
    // Default is 100kb, which is fine for almost everything - but was
    // silently 413-ing session creation whenever a cover photo was
    // involved, because that used to be inlined as base64 straight into
    // this JSON body (now fixed - see server/routes/uploadMedia.ts
    // "session-cover" - coverImage is a Storage URL by the time it gets
    // here). Bumped as defensive headroom, not to re-allow big payloads.
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(app);
  console.log("✅ API routes registered");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
