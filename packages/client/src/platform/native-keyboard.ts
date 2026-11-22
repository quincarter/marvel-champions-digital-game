/**
 * The Android app's keyboard height (#880 chat, on #537): KeyboardOverlay.java drops the keyboard's insets so the game
 * is not resized by it, which leaves the page's visual viewport unchanged. It reports the height itself by calling
 * window.__mcKeyboard(cssPx) on every change; this module takes that call. Nothing calls it on the web, iOS or
 * desktop, so nativeKeyboardHeight() stays null there and the visual viewport is read instead.
 */
type Listener = (height: number) => void;

let height: number | null = null;
const listeners = new Set<Listener>();

(globalThis as unknown as Record<string, unknown>)["__mcKeyboard"] = (cssPx: number): void => {
  height = Number.isFinite(cssPx) ? Math.max(0, cssPx) : 0;
  for (const listener of [...listeners]) listener(height);
};

/** The last height the app reported (CSS px), or null when it never has. */
export const nativeKeyboardHeight = (): number | null => height;

/** Calls listener on each report. Returns the unsubscribe. */
export function onNativeKeyboard(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
