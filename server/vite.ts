import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      // Diagnostic-only: Vite's transform plugins throw an error carrying
      // `.id` (the file that failed), `.loc` (line/column) and `.frame`
      // (a code snippet) - none of which show up in the bare stack trace
      // Node prints by default. Logging them here doesn't change what
      // happens to the request (still ssrFixStacktrace + next(e) exactly
      // as before); it just makes the next occurrence identifiable.
      const err = e as Error & { id?: string; loc?: { line: number; column: number }; frame?: string };
      if (err?.id) {
        console.error(
          `[vite] transform failed for file: ${err.id}` +
            (err.loc ? ` (line ${err.loc.line}, col ${err.loc.column})` : ""),
        );
        if (err.frame) console.error(err.frame);
      }
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
