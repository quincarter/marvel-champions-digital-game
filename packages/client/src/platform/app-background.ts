/**
 * When the Android app (or the game in an Android browser) leaves the foreground: the player switched apps, went
 * home or turned the screen off. The music pauses then and plays again on the way back (`audio/music-controller.ts`).
 *
 * The page's own `visibilitychange` says so: Android's WebView and Chrome hide the page when its app stops being the
 * one on screen. It is an event, not a poll. Everywhere else the music keeps playing behind another window, as it
 * always has (#243), so this only listens on Android.
 */

/** Android: the app and its browsers. */
export function pausesMusicInBackground(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * Calls `listener(true)` when the game goes to the background and `listener(false)` when it comes back; returns the
 * way to stop. Listens to nothing off Android.
 */
export function onAppBackgroundChange(
  listener: (background: boolean) => void,
  doc: VisibilitySource | undefined = globalThis.document,
  userAgent: string = globalThis.navigator?.userAgent ?? "",
): () => void {
  if (doc === undefined || !pausesMusicInBackground(userAgent)) return () => {};
  let background = doc.hidden;
  const changed = (): void => {
    if (doc.hidden === background) return;
    background = doc.hidden;
    listener(background);
  };
  doc.addEventListener("visibilitychange", changed);
  return () => doc.removeEventListener("visibilitychange", changed);
}
