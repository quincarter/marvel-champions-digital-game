/** True for the desktop app on Linux: a Tauri shell whose user agent names Linux and not Android. */
export function isLinuxDesktopApp(isTauri: boolean, userAgent: string): boolean {
  return isTauri && /Linux/i.test(userAgent) && !/Android/i.test(userAgent);
}

/** `isLinuxDesktopApp` for the page this code is running in (false outside a browser, as in unit tests). */
export function runningInLinuxDesktopApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const tauri = (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== undefined;
  return isLinuxDesktopApp(tauri, navigator.userAgent);
}
