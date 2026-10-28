/**
 * The platform's own Back: Android's back gesture and back button, a browser's Back (its button, Alt+Left, a phone
 * browser's edge swipe) and a mouse's back button (#480). Each one is Escape: it steps back a screen, closes the sheet
 * or popup on top, and in a game opens Pause, exactly as Escape and the pad's B already do on every screen, so no
 * screen needs to know about it.
 *
 * On the first screen (Title with nothing open over it) Back leaves instead, as it does at any app's first screen:
 * the Android app goes to the background, and a browser tab goes back to the page before the game.
 *
 * Android: the app's `BackGesture` plugin (`android/.../BackGesturePlugin.java`) takes the gesture from the OS and
 * sends a `back` event. Browser and desktop app: the game keeps one history entry of its own on top of the page's, so
 * Back lands on the page itself (`popstate`) instead of leaving it, and the entry goes back on at once. iOS has no
 * system back gesture inside the app, so nothing listens there.
 *
 * A limit in Chrome: its own Back skips a history entry the page added before the player last tapped or pressed a key
 * (its history-manipulation intervention). A tap or key takes that mark off, so in play, where every move is a tap, the
 * entry holds; a Back before the first tap, or two in a row with nothing between, can leave the page. The Android app
 * does not go through history and has no such limit.
 */
import { isTextEntry } from "../view/keyboard-intent.js";
import { CHROME_SCENES, SCENES } from "../scenes/keys.js";
import { detectPlatform, type Platform } from "./platform.js";

/** What a Back does now: press Escape for the screen on top, or leave the game. */
export type BackAction = "escape" | "leave";

/** Running scenes that are no screen over Title: the loader and the music, under every screen, and Title itself. */
const UNDERNEATH: ReadonlySet<string> = new Set([SCENES.boot, SCENES.music, SCENES.title]);

/**
 * `activeScenes` are the running scenes' keys. Back leaves when no screen but Title is up: the top bar's buttons and
 * toasts are chrome, not a screen, and the achievement popup's opened list is one while `listHeld` (Escape closes it).
 */
export function backActionFor(activeScenes: readonly string[], listHeld: boolean): BackAction {
  if (listHeld) return "escape";
  return activeScenes.every((key) => CHROME_SCENES.has(key) || UNDERNEATH.has(key)) ? "leave" : "escape";
}

/** A browser's Back and a mouse's back button can both report one press: the second within this window is the same Back. */
export const BACK_REPEAT_MS = 250;

/** True for a Back that is a new press, false for the echo of the one just taken. */
export function createBackGate(windowMs: number = BACK_REPEAT_MS): (now: number) => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return (now) => {
    if (now - last < windowMs) return false;
    last = now;
    return true;
  };
}

/** Marks the Escape a Back sends, so it is not taken for the keyboard coming into use (`platform/input-device.ts`). */
const FROM_BACK = Symbol.for("mc.platformBack");

/** True for the Escape that `pressEscape` sent for a Back, not one from a keyboard. */
export function isPlatformBack(event: Event): boolean {
  return FROM_BACK in event;
}

/**
 * Sends Escape (down, then up) to the page, where every screen's keyboard binding hears it as the player's own key. A
 * text field in focus is let go first: there Escape is a typed key, never Back.
 */
export function pressEscape(target: EventTarget = window, doc: Document = document): void {
  const active = doc.activeElement as (HTMLElement & { blur?: () => void }) | null;
  if (isTextEntry(active)) active?.blur?.();
  for (const type of ["keydown", "keyup"] as const) {
    const event = new KeyboardEvent(type, { key: "Escape", code: "Escape", bubbles: true, cancelable: true });
    // Phaser's per-key events ("keydown-ESC") read the legacy key code, which a constructed event leaves at 0.
    Object.defineProperty(event, "keyCode", { get: () => 27 });
    Object.defineProperty(event, "which", { get: () => 27 });
    Object.defineProperty(event, FROM_BACK, { value: true });
    target.dispatchEvent(event);
  }
}

/** Marks the game's own history entry. */
const TRAP = "mcBack";

interface HistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  back(): void;
}

function isTrap(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[TRAP] === true;
}

/**
 * The browser's Back as a callback: one history entry of the game's own sits on top, so Back pops it (`popstate`) and
 * the page stays. `back` answers what this Back did; on "leave" the entry stays off and the history steps back once
 * more, out of the game. A tap or a key puts the entry back if a leave found nothing to leave to. Returns the way to stop.
 */
export function trapHistoryBack(
  back: () => BackAction,
  win: Pick<Window, "addEventListener" | "removeEventListener"> & { readonly history: HistoryLike } = window,
): () => void {
  let trapped = false;
  const arm = (): void => {
    if (trapped) return;
    trapped = true;
    if (!isTrap(win.history.state)) win.history.pushState({ [TRAP]: true }, "");
  };
  const onPop = (): void => {
    // Landing back on our own entry is a Forward, not a Back.
    if (isTrap(win.history.state)) {
      trapped = true;
      return;
    }
    trapped = false;
    if (back() === "leave") {
      win.history.back();
      return;
    }
    arm();
  };
  win.addEventListener("popstate", onPop);
  win.addEventListener("pointerdown", arm, { capture: true, passive: true });
  win.addEventListener("keydown", arm, { capture: true, passive: true });
  arm();
  return () => {
    win.removeEventListener("popstate", onPop);
    win.removeEventListener("pointerdown", arm, { capture: true });
    win.removeEventListener("keydown", arm, { capture: true });
  };
}

/** Where Back comes from on this platform: the Android plugin, or the browser's history. */
export function backSourceFor(platform: Platform, userAgent: string): "android" | "history" | null {
  if (platform === "capacitor") return /android/i.test(userAgent) ? "android" : null;
  return "history";
}

/** Whether this app build has the `BackGesture` plugin: an older APK has none, and Back then closes the app as it did. */
export function hasBackGesturePlugin(global: object = globalThis): boolean {
  const headers = (global as { Capacitor?: { PluginHeaders?: readonly { name?: string }[] } }).Capacitor?.PluginHeaders;
  return Array.isArray(headers) && headers.some((header) => header?.name === "BackGesture");
}

interface BackGesturePlugin {
  addListener(event: "back", listener: () => void): Promise<unknown>;
  minimize(): Promise<void>;
}

interface SceneSource {
  readonly scene: {
    getScenes(isActive: boolean): readonly { readonly sys: { readonly settings: { readonly key: string } } }[];
    getScene(key: string): unknown;
  };
}

/** Starts listening for the platform's Back: once, at launch. */
export function installBackGesture(
  game: SceneSource,
  platform: Platform = detectPlatform(),
  userAgent: string = globalThis.navigator?.userAgent ?? "",
): void {
  const source = backSourceFor(platform, userAgent);
  if (source === null) return;
  const gate = createBackGate();
  // Read at the moment of the Back: a screen asked for in the same frame (Phaser starts it on the next step) is not up
  // yet, so a Back within a frame of a Title button still leaves. Too quick to matter.
  const action = (): BackAction =>
    backActionFor(
      game.scene.getScenes(true).map((scene) => scene.sys.settings.key),
      (game.scene.getScene(SCENES.achievementToast) as { listHeld?: boolean } | null)?.listHeld === true,
    );
  /** Escape for the screen on top; at the first screen, what `leave` says. A repeat of the same Back does nothing. */
  const take = (leave: () => void): BackAction => {
    if (!gate(globalThis.performance?.now() ?? Date.now())) return "escape";
    const next = action();
    if (next === "leave") leave();
    else pressEscape();
    return next;
  };

  if (source === "history") {
    trapHistoryBack(() => take(() => {}));
    // A mouse's back button, in a webview that does not turn it into a history Back by itself (WebKitGTK): it becomes
    // one here, so it takes the same path. Its own default is stopped; where that comes too late, the gate takes the
    // second Back as the same press.
    window.addEventListener("mouseup", (event) => {
      if (event.button !== 3) return;
      event.preventDefault();
      globalThis.history.back();
    });
    return;
  }

  if (!hasBackGesturePlugin()) return;
  // Boxed, as `openExternal` does: the plugin proxy answers every property, `then` included.
  void import("@capacitor/core")
    .then(({ registerPlugin }) => ({ plugin: registerPlugin<BackGesturePlugin>("BackGesture") }))
    .then(({ plugin }) => plugin.addListener("back", () => take(() => void plugin.minimize().catch(() => {}))))
    // An older app build without the plugin: Back closes the app, as it always did.
    .catch(() => {});
}
