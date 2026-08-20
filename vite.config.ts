import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    // No manualChunks. Three rounds of hand-written vendor-chunking rules
    // went through here (list form, then a function form meant to fix an
    // "empty chunk" warning from the first) - none of it could be
    // verified against a real `vite build` in this environment, and
    // production started showing intermittent 500s and worse Core Web
    // Vitals shortly after. Rather than risk a fourth unverified guess,
    // this reverts to Vite/Rollup's own default chunking, which needs no
    // package-path assumptions and is what was running before any of
    // this was touched. If custom vendor chunking is worth revisiting
    // later, it should be done with a real build available to check the
    // output against, not blind.
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    hmr: false, // Disable hot reload completely
    watch: {
      usePolling: false,
      ignored: ['**/server/**', '**/node_modules/**', '**/.git/**'],
    },
  },
});
