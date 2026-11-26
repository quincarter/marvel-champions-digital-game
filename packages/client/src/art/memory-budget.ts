/**
 * How many decoded bytes of card pictures the game keeps resident (`card-art.ts`) and of baked card faces
 * (`card-face-baker.ts`), by device.
 *
 * iOS gets half (issue #871): every browser there is WebKit, which kills a tab's web content process under memory
 * pressure and then loads the page again, so a player on an iPhone lost their game after a few fights. A tighter cap
 * costs a picture fetched again now and then; a killed tab costs the game.
 *
 * The other WebKit builds get the same: the Mac and Linux desktop apps and Safari. WebKit keeps a decoded copy of each
 * picture beside its texture, so a budget counted in texture bytes holds about three times that in the page process (an
 * 8 GB Mac reported 3.9 GB at round 12).
 */

const MB = 1024 * 1024;

/** iPhone, iPod and iPad, an iPad in desktop mode included (it reads as a Mac, but no Mac has a touch screen). */
export function onIos(
  userAgent: string = globalThis.navigator?.userAgent ?? "",
  touchPoints: number = globalThis.navigator?.maxTouchPoints ?? 0,
): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1);
}

/**
 * WebKit outside iOS: Safari, and the Tauri desktop apps on macOS (WKWebView) and Linux (WebKitGTK). Chromium and its
 * kin (Chrome, Edge, the Windows app's WebView2, Android) say AppleWebKit too, so they are ruled out by name.
 */
export function onWebKit(userAgent: string = globalThis.navigator?.userAgent ?? ""): boolean {
  return /AppleWebKit/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|Android|OPR/i.test(userAgent);
}

/** Whether this device gets the smaller budgets: iOS, or any other WebKit. */
const smallBudget = (): boolean => onIos() || onWebKit();

/** Card pictures (scans) resident at once. */
export function artBudgetBytes(ios: boolean = smallBudget()): number {
  return (ios ? 128 : 256) * MB;
}

/** Baked card faces resident at once. A desktop card at 2x is ~1.2 MB, so the larger budget holds about eighty. */
export function faceBudgetBytes(ios: boolean = smallBudget()): number {
  return (ios ? 48 : 96) * MB;
}
