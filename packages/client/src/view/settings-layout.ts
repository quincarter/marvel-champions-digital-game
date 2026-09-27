/**
 * Settings' own layout (docs/phase4-screen-gaps.md §3 "W4"; fidelity pass
 * 2026-09-17): an ink title bar ("Settings" + a boxed ✕, matching Pause's own
 * header) over a "Table" heading and one fixed-height toggle row per setting,
 * stacked — the same row shape Pause's inline "Table" column now uses, so a
 * player who opens either screen reads the identical group. `rowCount` is the
 * number of *real* toggle rows this build draws (reduced motion, sharper text,
 * large card text, sound-drawn-unavailable) — kept a parameter rather than a
 * hardcoded 4 so a later setting doesn't need this module touched to grow.
 *
 * **The whole body is one scroll region (docs/guided-mode.md §4 G2b, fixed
 * 2026-09-26).** Table, Unlocks and Guide used to be two pieces — the Table/
 * Unlocks rows stacked directly into the panel, only the Guide group (below
 * them) in its own bounded, scrollable viewport — so on a real phone height,
 * where the Table group and Unlocks row alone already use most of the panel,
 * the Guide group's own six rows either scrolled in a cramped little box of
 * their own or (found in browser verification, 2026-09-26) ran straight off
 * the bottom of the panel with nothing to scroll them into view. Every row
 * below the fixed header — `tableHeading` through the last Guide row — is now
 * one `content` block in content space (`y` measured from the content's own
 * top, `0`), and `bodyViewport` is the one scrollable window onto it, the
 * same convention `ui/scroll-region.ts`'s own doc comment states. The scene
 * draws every row into one `McScrollRegion` at `bodyViewport`, the way
 * `scenes/table-setup.ts`'s compact layout already does for its own
 * taller-than-the-screen content — never a second, nested scroll box for the
 * Guide group alone, at any width.
 */
import { formFactorFor, toggleRowHeight, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

const HEADER_HEIGHT = 60;
const HEADING_HEIGHT = 20;
const ROW_GAP = 10;
const GROUP_GAP = 16;
/** The "Guide level" segmented row: a fixed two-line-per-cell height, not sized off wrapped text like the toggle rows. */
export const GUIDE_LEVEL_ROW_HEIGHT = 52;

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  /** The one scroll region under the fixed header — screen space; everything in `content` draws inside it. */
  readonly bodyViewport: Rect;
  readonly content: SettingsContentLayout;
}

/** Every row this screen draws, in content space (`y` from the body's own top) — see this file's own doc comment. */
export interface SettingsContentLayout {
  readonly tableHeading: Rect;
  /** One rect per Table toggle row, then one more for the Unlocks row at the end — `rowDetails`'s own order. */
  readonly rows: readonly Rect[];
  readonly guideHeading: Rect;
  readonly guideLevelRow: Rect;
  /** One rect per Guide row after the level row: "Play the tutorial", "Aspect lessons", then one per warning toggle. */
  readonly guideRows: readonly Rect[];
  /** The content's own total height, for `McScrollRegion`'s `heights` (`view/layout.ts`'s `contentSlotHeights`) and its clamp. */
  readonly totalHeight: number;
}

/**
 * `rowDetails[i]` is that row's own rendered detail text (`row.unavailable ??
 * row.detail`, plus the Unlocks row's own summary line at the end) — each row
 * is sized to fit it (`toggleRowHeight`, shared with Pause's inline "Table"
 * column, `view/pause-layout.ts`) rather than every row sharing one fixed
 * height that only the *shortest* description actually fit. Fidelity pass,
 * 2026-09-17: at phone width "Reduced motion"'s three-line detail used to run
 * into "Sharper text"'s own heading below it.
 *
 * `guideRowDetails[i]` is the Guide group's own row-after-the-level-row detail text (`row.unavailable ??
 * row.detail`), in draw order: "Play the tutorial", "Aspect lessons", then one per warning toggle
 * (`guideRowInfoOf` minus its own `"guide-level"` entry) — sized the same way `rowDetails` is.
 */
export function settingsLayout(
  bounds: Rect,
  rowDetails: readonly string[],
  guideRowDetails: readonly string[] = [],
): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const contentX = body.x + 16;
  const contentWidth = Math.max(0, body.width - 32);
  const onDesktop = formFactorFor(bounds.width, bounds.height) === "desktop";

  // Content space: everything below starts at its own y=0, translated into the viewport by the scroll region.
  const tableHeading: Rect = { x: contentX, y: 0, width: contentWidth, height: HEADING_HEIGHT };
  const rowsTop = tableHeading.y + tableHeading.height + 6;
  const rows: Rect[] = [];
  let y = rowsTop;
  for (const detail of rowDetails) {
    const height = toggleRowHeight(detail, contentWidth, onDesktop);
    rows.push({ x: contentX, y, width: contentWidth, height });
    y += height + ROW_GAP;
  }
  const rowsBottom = rows.length > 0 ? rows[rows.length - 1]!.y + rows[rows.length - 1]!.height : rowsTop;

  const guideHeading: Rect = { x: contentX, y: rowsBottom + GROUP_GAP, width: contentWidth, height: HEADING_HEIGHT };
  const guideLevelRow: Rect = {
    x: contentX,
    y: guideHeading.y + guideHeading.height + 6,
    width: contentWidth,
    height: GUIDE_LEVEL_ROW_HEIGHT,
  };
  const guideRows: Rect[] = [];
  let gy = guideLevelRow.y + guideLevelRow.height + ROW_GAP;
  for (const detail of guideRowDetails) {
    const height = toggleRowHeight(detail, contentWidth, onDesktop);
    guideRows.push({ x: contentX, y: gy, width: contentWidth, height });
    gy += height + ROW_GAP;
  }
  const totalHeight = Math.max(0, gy - ROW_GAP);

  const viewportTop = body.y;
  // Never taller than the content itself (no dead scroll space when it already fits, as on a roomy desktop), and
  // never taller than what's actually left in the panel (the phone case this group exists for).
  const available = Math.max(0, body.y + body.height - viewportTop);
  const viewportHeight = Math.min(totalHeight, available);
  const bodyViewport: Rect = { x: contentX, y: viewportTop, width: contentWidth, height: viewportHeight };

  return {
    panel,
    header,
    bodyViewport,
    content: { tableHeading, rows, guideHeading, guideLevelRow, guideRows, totalHeight },
  };
}

/** Every rect this layout places, for a no-overlap test — the content's own rects are in a separate coordinate space (see `SettingsContentLayout`), so only the one viewport onto them is checked here. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.bodyViewport];
}
