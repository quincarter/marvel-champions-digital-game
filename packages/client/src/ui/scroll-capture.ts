/**
 * Moving eagerly drawn content into a `McScrollRegion` after the fact: a screen draws a stretch of rows at the top
 * level exactly as it would without scrolling, then hands the slice of `scene.children` it drew to the region, which
 * sizes the scroll from what was drawn and turns each focus stop drawn inside it into one that follows the offset and
 * scrolls itself into view. Campaign Briefing's phone column and the Market's shelf both work this way.
 */
import type Phaser from "phaser";
import type { FocusStop } from "../scenes/focus-route.js";
import { revealDelta } from "../view/scroll-reveal.js";
import type { VariableListScroll } from "../view/variable-list-scroll.js";
import type { McScrollRegion } from "./scroll-region.js";

/** The lowest edge of everything drawn at the top level in `[fromIndex, toIndex)`, graphics aside (they only frame text). */
export function bottomOfDrawn(scene: Phaser.Scene, fromIndex: number, toIndex?: number): number {
  let bottom = 0;
  for (const object of scene.children.list.slice(fromIndex, toIndex)) {
    if (object.type === "Graphics") continue;
    const bounds = (object as Phaser.GameObjects.Text).getBounds();
    bottom = Math.max(bottom, bounds.bottom);
  }
  return bottom;
}

export interface CaptureIntoRegionOptions {
  readonly region: McScrollRegion;
  /** The region's one-entry `heights` array; entry 0 becomes the content's height, measured from `viewportTop`. */
  readonly heights: number[];
  readonly scroll: VariableListScroll;
  /** The first top-level child drawn for the region (`scene.children.list.length` before drawing). */
  readonly fromIndex: number;
  readonly toIndex?: number;
  readonly stops: Map<string, FocusStop>;
  /** Stop keys that existed before the region's content was drawn: those stay as they are. */
  readonly stopsBefore: ReadonlySet<string>;
  readonly viewportTop: number;
  readonly viewportBottom: number;
  /** The content's lowest edge, when the caller knows it: graphics (a card's frame) are not measured otherwise. */
  readonly bottom?: number;
  /** Air under the last row. */
  readonly padBottom?: number;
}

/** Moves the drawn slice into `region.content`, sizes the scroll, and rewires the slice's focus stops. */
export function captureIntoRegion(scene: Phaser.Scene, options: CaptureIntoRegionOptions): void {
  const { region, heights, scroll, fromIndex, toIndex, stops, stopsBefore, viewportTop, viewportBottom } = options;
  const bottom = options.bottom ?? bottomOfDrawn(scene, fromIndex, toIndex);
  const added = scene.children.list.slice(fromIndex, toIndex);
  if (added.length > 0) region.content.add(added);
  heights[0] = Math.max(0, bottom + (options.padBottom ?? 16) - viewportTop);
  for (const [key, stop] of stops) {
    if (stopsBefore.has(key) || typeof stop.rect === "function") continue;
    const rect = stop.rect;
    stops.set(key, {
      ...stop,
      rect: () => ({ ...rect, y: rect.y - scroll.offsetPx }),
      ensureVisible: () => {
        const offset = scroll.offsetPx;
        const delta = revealDelta(
          { top: viewportTop, bottom: viewportBottom },
          { top: rect.y - offset, bottom: rect.y + rect.height - offset },
        );
        if (delta !== 0) region.scrollByPx(delta);
      },
    });
  }
  region.refresh();
}
