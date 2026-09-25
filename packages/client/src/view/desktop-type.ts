/**
 * The size bump `ui/desktop-type.ts` applies to small text on desktop, as plain functions of a size or a CSS font
 * string (no Phaser), so the rule is testable on its own.
 */

/** Sizes at or below this are the "small" text that gets bumped. */
const SMALL_MAX = 12;
/** How much a small size grows on desktop. */
const BUMP = 2;
/** Where a bumped size stops, so the largest small sizes don't overtake the next step up the scale. */
const BUMPED_MAX = 13;

/** The px size actually drawn for a requested `size`, on desktop or not. */
export function desktopTypeSize(size: number, onDesktop: boolean): number {
  if (!onDesktop || size > SMALL_MAX) return size;
  return Math.min(BUMPED_MAX, size + BUMP);
}

/** `font` ("800 11px \"Public Sans\", sans-serif") with its px size swapped for the drawn one. */
export function desktopFont(font: string, onDesktop: boolean): string {
  if (!onDesktop) return font;
  return font.replace(/(\d+(?:\.\d+)?)px/, (_, size: string) => `${desktopTypeSize(Number(size), true)}px`);
}
