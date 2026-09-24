/**
 * Which shell the client is running in.
 *
 * The same `dist/` bundle ships three ways: served to a browser, wrapped by
 * Capacitor (iOS/Android), and wrapped by Tauri (macOS/Windows/Linux). Almost
 * nothing cares — Phaser, the engine worker and IndexedDB behave the same in
 * all three. What differs is the two dev-server routes (`/card-art/*` and
 * `/api/marvelcdb-import/*`): a packaged app has no Vite middleware behind it,
 * so there it reaches MarvelCDB through the shell's native HTTP instead, which
 * is not subject to CORS. See `native-http.ts`.
 *
 * Both shells announce themselves on the global object before any page script
 * runs, so this is a synchronous sniff and needs neither package imported.
 */

export type Platform = "web" | "capacitor" | "tauri";

interface ShellGlobals {
  readonly Capacitor?: { readonly isNativePlatform?: () => boolean };
  readonly __TAURI_INTERNALS__?: unknown;
}

export function detectPlatform(global: object = globalThis): Platform {
  const shell = global as ShellGlobals;
  if (shell.__TAURI_INTERNALS__ !== undefined) return "tauri";
  // `Capacitor` also exists on the web when @capacitor/core is bundled; only a
  // native shell answers true here.
  if (shell.Capacitor?.isNativePlatform?.() === true) return "capacitor";
  return "web";
}

/** True when there is no dev/preview middleware to lean on. */
export function isNativeShell(platform: Platform = detectPlatform()): boolean {
  return platform !== "web";
}

/**
 * Opens `url` outside the game: a new browser tab on the web. Capacitor hands a navigation away from the app's own
 * origin to the system browser. Tauri has no opener plugin wired yet (a Phase 8 packaging item), so there this is
 * the webview's own `window.open`, which a desktop build may ignore.
 */
export function openExternal(url: string): void {
  globalThis.open?.(url, "_blank", "noopener,noreferrer");
}
