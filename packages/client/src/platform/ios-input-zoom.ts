/**
 * Issue #939: on an iPhone or iPad, tapping a text field (a search box, the MarvelCDB import) zoomed the whole page in,
 * and nothing zoomed it back out. iOS zooms in on any focused field whose text is under 16px, and every field here is
 * smaller than that (`McTextInput` draws in the design's type sizes; rexUI's `TextAreaInput` types into a hidden
 * native textarea at the browser's own small default). The page is one canvas laid out to the window, so a zoomed page
 * stays cut off until a reload.
 *
 * `maximum-scale=1` on the viewport stops that zoom on iOS. Safari ignores the limit for the player's own pinch zoom
 * (since iOS 10), so only the automatic focus zoom goes away. It is iOS only: Chrome on Android would honor it by
 * blocking pinch zoom, and Android never zooms in on a focused field anyway. The iOS app's WKWebView may enforce the
 * limit for pinches too, which costs nothing there: the canvas fills the page with `touch-action: none` (index.html),
 * so a pinch on the game never zoomed the page in the first place.
 */

/** The parts of `navigator` this reads, so a test can pass its own. */
export interface NavigatorLike {
  readonly userAgent: string;
  readonly platform?: string;
  readonly maxTouchPoints?: number;
}

/** True on an iPhone, iPod or iPad, including an iPad whose Safari asks for the desktop site (a Mac user agent). */
export function isIosDevice(nav: NavigatorLike | undefined): boolean {
  if (nav === undefined) return false;
  if (/\b(iPhone|iPad|iPod)\b/.test(nav.userAgent)) return true;
  // iPadOS 13+ reports itself as a Mac; a Mac has no touch screen.
  return /\bMacintosh\b/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
}

/** The viewport content with `maximum-scale=1`, so a focused field never zooms the page; unchanged when it has one. */
export function withoutFocusZoom(content: string): string {
  if (/maximum-scale\s*=/.test(content)) return content;
  return content.trim() === "" ? "maximum-scale=1" : `${content}, maximum-scale=1`;
}

/** True for an element the on-screen keyboard types into: what iOS zooms in on. */
function isTextEntry(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

/**
 * Whether leaving a field should put the page back to its own scale: only when the page was at its own scale as the
 * field took focus, is zoomed now, and the player made no pinch in between, so the zoom came from the field. A zoom the
 * player chose, before tapping the field or while typing in it, is kept.
 */
export function zoomedByFocus(scaleAtFocus: number, scaleNow: number, pinchedSinceFocus: boolean): boolean {
  return !pinchedSinceFocus && scaleAtFocus <= 1.01 && scaleNow > 1.01;
}

/**
 * Turns off the focus zoom on iOS (see the top of this file), and puts the page back to its own scale when a field
 * that zoomed it anyway loses focus (a WebKit that ignores the limit). Rewriting the viewport content makes WebKit fit
 * the page to the window again. Does nothing elsewhere.
 */
export function applyIosInputZoomGuard(doc: Document = document, nav: NavigatorLike | undefined = navigator): void {
  if (!isIosDevice(nav)) return;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta === null) return;
  const guarded = withoutFocusZoom(meta.content);
  meta.content = guarded;
  const view = doc.defaultView;
  const scaleNow = (): number => view?.visualViewport?.scale ?? 1;
  let scaleAtFocus = 1;
  let pinched = false;
  doc.addEventListener("focusin", (event) => {
    if (!isTextEntry(event.target)) return;
    scaleAtFocus = scaleNow();
    pinched = false;
  });
  // Capture, so a field's own touch handlers (rexUI stops touch events at its elements) can't hide a pinch.
  doc.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length > 1) pinched = true;
    },
    { capture: true, passive: true },
  );
  doc.addEventListener("focusout", (event) => {
    if (!isTextEntry(event.target) || !zoomedByFocus(scaleAtFocus, scaleNow(), pinched)) return;
    // The same content again is not a change, so WebKit would skip it: drop the limit for a frame, then put it back.
    meta.content = guarded.replace(/,?\s*maximum-scale\s*=\s*[\d.]+/, "");
    const restore = (): void => {
      meta.content = guarded;
    };
    if (view?.requestAnimationFrame !== undefined) view.requestAnimationFrame(restore);
    else restore();
  });
}
