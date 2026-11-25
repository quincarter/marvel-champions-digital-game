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
  plugins: {
    App: {
      // `@capacitor/app` (App Links, #863) adds its own handler to Android's back dispatcher. Capacitor loads it after
      // the app's own plugins, so it sits on top and takes every back, which then only steps back the webview's
      // history and does nothing in the game (#998). Off, back reaches the game's `BackGesture` plugin (#480).
      disableBackButtonHandler: true,
    },
  },
};

export default config;
