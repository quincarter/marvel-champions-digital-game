import { defineConfig } from "vite";
import { cardArtPlugin } from "./vite-card-art.js";
import { marvelcdbImportPlugin } from "./vite-marvelcdb-import.js";

/**
 * The engine runs in a module worker (PLAN.md Phase 4), so the worker format is
 * ES rather than the default IIFE — an IIFE worker can't `import` the engine.
 *
 * `cardArtPlugin` serves `/card-art/*` from this origin. Card art has to be
 * same-origin or WebGL won't accept it as a texture; see vite-card-art.ts.
 *
 * `marvelcdbImportPlugin` serves `/api/marvelcdb-import/*` the same way, for
 * MarvelCDB deck import by URL/id (PLAN.md Phase 9, dev/preview-only; paste
 * is the fallback that works in a production build). See
 * vite-marvelcdb-import.ts.
 */
export default defineConfig({
  plugins: [cardArtPlugin(), marvelcdbImportPlugin()],
  worker: { format: "es" },
  build: {
    target: "es2022",
    // Phaser is large and ships as one chunk; the warning adds nothing here.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    // Never watch the Tauri build tree: cargo rewrites executables under
    // src-tauri/target while a desktop build runs, and a watch handle on one
    // of them fails with EBUSY on Windows and takes the whole dev server down.
    watch: { ignored: ["**/src-tauri/**", "**/android/**", "**/ios/**"] },
  },
});
