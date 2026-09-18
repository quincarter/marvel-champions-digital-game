import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The mobile shell (iOS/Android). It wraps the same `dist/` a web deploy
 * serves; Tauri wraps it for desktop (`src-tauri/`). Neither shell has the
 * dev server's `/card-art/*` or `/api/marvelcdb-import/*` routes, so both go
 * to MarvelCDB through native HTTP instead — see `src/platform/`.
 */
const config: CapacitorConfig = {
  appId: "com.quincarter.marvelchampions",
  appName: "Marvel Champions",
  webDir: "dist",
  backgroundColor: "#0e0c0a",
  ios: {
    // The canvas draws edge to edge; safe-area insets are the scene layout's job.
    contentInset: "never",
  },
};

export default config;
