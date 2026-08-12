import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";

const app = express();

// Security headers (CSP, X-Frame-Options, etc). `crossOriginEmbedderPolicy`
// off + a permissive `img-src`/`connect-src` because we load images and
// call out to Supabase Storage from third-party origins - tighten this
// further (esp. connect-src) once every external host we hit is known.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https:"],
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

app.use(
  express.json({
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

    res.status(status).json({ message });
    throw err;
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
