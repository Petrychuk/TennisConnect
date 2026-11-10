import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { staticCacheControl } from "./lib/staticCache";
import { buildSessionShareMeta, injectShareMeta } from "./lib/shareMeta";
import { PRODUCTION_SITE } from "./lib/appUrl";
import { storage } from "./storage";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // index.html must never be cached: it's what points the browser at the
  // current build's hashed JS/CSS chunk filenames. If a browser (or an
  // intermediate proxy/CDN) caches an old index.html across a deploy, it
  // keeps asking for chunk files from the *previous* build that no longer
  // exist on the server - which is exactly the "works after a reload"
  // symptom, since a reload finally fetches a fresh index.html. The
  // hashed asset files themselves are safe to let the browser cache
  // normally (their filename changes whenever their content does).
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader("Cache-Control", staticCacheControl(filePath));
      },
    }),
  );

  // /.well-known/* is for machine-read files (security.txt, ai-catalog.json,
  // ...). express.static above ignores dot-folders, so without this the
  // catch-all below answered them with index.html - HTML where a crawler or
  // Lighthouse expects JSON/text. Serve a real file from
  // client/public/.well-known/ if one is added later, else a plain 404.
  app.use(
    "/.well-known",
    express.static(path.join(distPath, ".well-known"), { dotfiles: "allow", index: false }),
  );
  app.use("/.well-known", (_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  // A shared session link (/play/:id) gets its own title, description and
  // image in the HTML, so Facebook / WhatsApp previews show the session
  // rather than the generic site card (server/lib/shareMeta.ts). Anything
  // that isn't a published public session - or any error - falls through to
  // the plain shell below, exactly as before.
  app.get("/play/:id", async (req, res, next) => {
    try {
      const session = await storage.getPublicSessionById(req.params.id);
      if (!session) return next();
      const html = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      const when = new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: session.timeZone || "Australia/Sydney",
      }).format(new Date(session.startAt));
      res.setHeader("Cache-Control", "no-cache");
      res.type("html").send(injectShareMeta(html, buildSessionShareMeta(session, PRODUCTION_SITE, when)));
    } catch {
      next();
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
