import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { bundleMode, cardArtPlugin, cardLanguageOf, carriedLanguagesOf, servedLanguages } from "./vite-card-art.js";
import { artCopyPlugin } from "./vite-roster-art.js";
import { marvelcdbImportPlugin } from "./vite-marvelcdb-import.js";
import { releaseHistoryPlugin } from "./vite-release-history.js";
import { RULES_ROOTS, rulesFingerprintOf } from "./src/rules-fingerprint.js";

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
/**
 * The commit this bundle is built from, for the Title footer's version stamp (`src/view/app-version.ts`). Netlify
 * sets `COMMIT_REF` on every deploy; a local or CI build asks git; with neither, the stamp is just the release.
 */
function buildCommit(): string {
  const fromNetlify = process.env.COMMIT_REF?.trim();
  if (fromNetlify) return fromNetlify.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

/** The rules fingerprint (`rules-fingerprint.ts`): engine, cards, content, mod SDK and session-to-game client code, for live rooms' build check. */
function rulesFingerprint(): string {
  const packages = fileURLToPath(new URL("../", import.meta.url));
  return rulesFingerprintOf(RULES_ROOTS.map((p) => `${packages}${p}`));
}

export default defineConfig(({ command }) => ({
  // `__CARD_LANG__`: the build language of the card scans (`MC_CARD_LANG`, `src/art/card-language.ts`).
  // `__CARD_LANGS__`: every language the bundle carries (`MC_CARD_LANGS`), or in dev every one the dev server serves.
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __RULES_FINGERPRINT__: JSON.stringify(rulesFingerprint()),
    __CARD_LANG__: JSON.stringify(cardLanguageOf()),
    // Only a pool copy writes the other languages; `all` and `none` builds offer the build language alone.
    __CARD_LANGS__: JSON.stringify(
      (command !== "build"
        ? servedLanguages()
        : bundleMode() === "pool"
          ? carriedLanguagesOf()
          : [cardLanguageOf()]
      ).join(","),
    ),
  },
  plugins: [artCopyPlugin(), cardArtPlugin(), marvelcdbImportPlugin(), releaseHistoryPlugin()],
  worker: { format: "es" },
  optimizeDeps: {
    // Scenes load by dynamic import, so on a cold cache the dev server finds these only when a screen first opens,
    // re-bundles them and reloads the page under the player (and under an e2e spec that just opened Settings).
    // Listing them pre-bundles everything at start-up instead.
    include: [
      "@tauri-apps/plugin-http",
      "fflate",
      "uqr",
      "phaser4-rex-plugins/plugins/utils/mask/MaskMethods.js",
      "phaser4-rex-plugins/templates/ui/inputtext/InputText.js",
      "phaser4-rex-plugins/templates/ui/textarea/TextArea.js",
      "phaser4-rex-plugins/templates/ui/textareainput/TextAreaInput.js",
    ],
  },
  build: {
    target: "es2022",
    // The app, and the chat's light pop-out page (`chat-popout.html`, opened beside the lobby on a desktop).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        "chat-popout": fileURLToPath(new URL("./chat-popout.html", import.meta.url)),
      },
    },
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
}));
