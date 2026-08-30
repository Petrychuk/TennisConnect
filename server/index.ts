import express, { type Request, Response, NextFunction } from "express";

// Process diagnostics for unexpected crashes and Railway restarts.
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

process.on("SIGTERM", () => {
  console.error(
    `[CRASH-GUARD] ${new Date().toISOString()} Received SIGTERM - process is shutting down.`,
  );
  process.exit(0);
});

process.on("SIGINT", () => {
  console.error(
    `[CRASH-GUARD] ${new Date().toISOString()} Received SIGINT - process is shutting down.`,
  );
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

// Railway / application health check.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "TennisConnect",
    env: process.env.DB_ENV,
    version: process.env.RAILWAY_GIT_COMMIT_SHA || "local",
    timestamp: new Date().toISOString(),
  });
});

// Redirect apex domain to canonical www domain.
app.use((req, res, next) => {
  if (req.hostname === "tennisconnect.com.au") {
    return res.redirect(
      301,
      `https://www.tennisconnect.com.au${req.originalUrl}`,
    );
  }

  next();
});

// Security headers. External sources are required for Supabase and GA4.
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

// Allow configured frontend origin and same-origin requests.
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
  process.env.BASE_URL,
  ...(isProduction
    ? []
    : ["http://localhost:3000", "http://localhost:5173"]),
].filter((origin): origin is string => Boolean(origin));

app.use(
  cors((req, callback) => {
    const requestOrigin = req.header("Origin");
    const selfOrigin = `${req.protocol}://${req.get("host")}`;

    const allowed =
      !requestOrigin ||
      allowedOrigins.includes(requestOrigin) ||
      requestOrigin === selfOrigin;

    callback(null, {
      origin: allowed,
      credentials: true,
    });
  }),
);

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

console.log("🟢 routes.ts loaded");

// Compress text responses such as HTML, JS, CSS and JSON.
app.use(compression());

app.use(
  express.json({
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

// Log API response time and highlight requests slower than 3 seconds.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;

  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (!path.startsWith("/api")) {
      return;
    }

    let logLine =
      `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

    // Keep existing response-body logging outside production only.
    if (capturedJsonResponse && !isProduction) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    log(logLine);

    if (duration > 3000) {
      console.warn(
        `[SLOW REQUEST] ${new Date().toISOString()} ` +
          `${req.method} ${req.originalUrl} ` +
          `${res.statusCode} ${duration}ms`,
      );
    }
  });

  next();
});

(async () => {
  await registerRoutes(app);

  console.log("✅ API routes registered");

  app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(err);

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    },
  );

  // Serve static production build or Vite development server.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Railway provides PORT; local development falls back to 3000.
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