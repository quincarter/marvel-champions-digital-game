import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The mobile shell (iOS/Android). It wraps the same `dist/` a web deploy
 * serves; Tauri wraps it for desktop (`src-tauri/`). Card art is already in
 * that `dist/` (`vite-card-art.ts` bundles it at build time), so it needs
 * nothing here. The dev server's `/api/marvelcdb-import/*` route is the one
 * thing neither shell has, so deck import goes to MarvelCDB through native
 * HTTP instead — see `src/platform/`.
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
  android: {
    buildOptions: {
      releaseType: "APK",
      signingType: "apksigner",
    },
  },
};

export default config;
