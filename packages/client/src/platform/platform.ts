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
 * Whether the page should draw under the notch and gesture bar (`viewport-fit=cover`) and inset itself by the safe
 * area. Only when nothing else keeps the page clear of them: a native shell, or an app installed to the home screen.
 * In a browser tab the browser's own toolbars already do, and Android 15+ Chrome-based browsers still report the
 * gesture bar as `safe-area-inset-bottom` under a bottom address bar, which left a VOID strip above that bar.
 */
export function drawsEdgeToEdge(platform: Platform, installed: boolean): boolean {
  return isNativeShell(platform) || installed;
}

/** Opts the page into `viewport-fit=cover` when `drawsEdgeToEdge` says so; index.html ships without it. */
export function applyViewportFit(doc: Document = document): void {
  const installed =
    globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
    (globalThis.navigator as { standalone?: boolean } | undefined)?.standalone === true;
  if (!drawsEdgeToEdge(detectPlatform(), installed)) return;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta !== null && !meta.content.includes("viewport-fit")) meta.content += ", viewport-fit=cover";
}

/** How `openExternal` reaches outside the game on each shell. */
export type ExternalOpener = "window" | "tauri-opener" | "android-browser";

export function externalOpenerFor(platform: Platform, userAgent: string): ExternalOpener {
  if (platform === "tauri") return "tauri-opener";
  if (platform === "capacitor" && /android/i.test(userAgent)) return "android-browser";
  return "window";
}

interface ExternalBrowserPlugin {
  open(options: { url: string }): Promise<void>;
}

// Capacitor warns on a second registration, so the plugin's proxy is made once.
let externalBrowser: Promise<ExternalBrowserPlugin> | null = null;

/**
 * Opens `url` outside the game: a new browser tab on the web, and on iOS, where Capacitor hands a navigation away
 * from the app's own origin to Safari. A Tauri webview ignores `window.open`, so there the opener plugin asks the OS
 * for the default browser; `src-tauri/capabilities/default.json` lists the sites it may open. On Android Capacitor's
 * own hand-off is a plain intent that the GitHub app answers for github.com, opening release downloads in its in-app
 * tab where they stall; the app's `ExternalBrowser` plugin (`android/.../ExternalBrowserPlugin.java`) sends the link
 * to the browser instead, and the plain hand-off is the fallback.
 */
export function openExternal(url: string): void {
  const viaWindow = (): void => void globalThis.open?.(url, "_blank", "noopener,noreferrer");
  switch (externalOpenerFor(detectPlatform(), globalThis.navigator?.userAgent ?? "")) {
    case "tauri-opener":
      void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url)).catch(() => {});
      return;
    case "android-browser":
      externalBrowser ??= import("@capacitor/core").then(({ registerPlugin }) =>
        registerPlugin<ExternalBrowserPlugin>("ExternalBrowser"),
      );
      void externalBrowser.then((plugin) => plugin.open({ url })).catch(viaWindow);
      return;
    case "window":
      viaWindow();
  }
}
