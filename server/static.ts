import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
