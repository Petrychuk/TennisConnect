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
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "wouter"],
          // Every @radix-ui/react-* package actually used in the app (see
          // the grep that generated this list) - previously only about
          // half of them were listed here, so the rest (slot, toast,
          // label, separator, etc. - all pulled in by very foundational
          // UI primitives like Button/Toaster) were leaking into the
          // main entry chunk instead of this shared, separately-cached
          // one. This is a pure bundling change: it only affects which
          // file each import ends up in, not what the code does.
          "vendor-radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          // framer-motion is used on the homepage itself (hero.tsx etc.),
          // so it can't be deferred out of the initial load entirely -
          // but as its own chunk it downloads in parallel with the main
          // entry chunk instead of being baked into one large sequential
          // file, and it's cached independently: a deploy that only
          // touches app code (not this library's version) won't force
          // returning visitors to re-download it.
          "vendor-motion": ["framer-motion"],
          // Used broadly for data fetching (React Query) - same
          // parallel-download/independent-cache reasoning as above.
          "vendor-query": ["@tanstack/react-query"],
          // Loaded eagerly (AuthProvider wraps the whole app), so same
          // reasoning again - isolating it avoids it bloating whichever
          // chunk happened to import it first.
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
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
