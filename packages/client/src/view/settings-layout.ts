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
 * **The Guide group (docs/guided-mode.md §4 G2b)** — "Guide level", "Play the
 * tutorial", "Aspect lessons" and the four warning toggles — is drawn under
 * everything above in its own bounded, scrollable viewport (`guideViewport`),
 * not stacked inline and left to run off the bottom of the panel the way a
 * sixth Table row would: on a phone the Table group and Unlocks row alone
 * already use most of the panel's height, so six more rows have to scroll
 * rather than push the panel past the screen. `guideContent`'s own rects are
 * in *content space* (`y` measured from the group's own top, `0`), the same
 * convention `ui/scroll-region.ts`'s own doc comment states — the scene draws
 * them into an `McScrollRegion` the way `scenes/table-setup.ts`'s compact
 * layout already does for its own taller-than-the-screen content.
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
  readonly tableHeading: Rect;
  readonly rows: readonly Rect[];
  /** Where the Guide group's own scroll region sits — screen space, below the Table rows and the Unlocks row. */
  readonly guideViewport: Rect;
  readonly guideContent: GuideContentLayout;
}

/** The Guide group's own rows, in content space (`y` from the group's own top) — see this file's own doc comment. */
export interface GuideContentLayout {
  readonly heading: Rect;
  readonly levelRow: Rect;
  /** One rect per row after the level row: "Play the tutorial", "Aspect lessons", then one per warning toggle. */
  readonly rows: readonly Rect[];
  /** The content's own total height, for `McScrollRegion`'s `heights` (one entry per row) and its clamp. */
  readonly totalHeight: number;
}

/**
 * `rowDetails[i]` is that row's own rendered detail text (`row.unavailable ??
 * row.detail`) — each row is sized to fit it (`toggleRowHeight`, shared with
 * Pause's inline "Table" column, `view/pause-layout.ts`) rather than every
 * row sharing one fixed height that only the *shortest* description actually
 * fit. Fidelity pass, 2026-09-17: at phone width "Reduced motion"'s
 * three-line detail used to run into "Sharper text"'s own heading below it.
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
  const tableHeading: Rect = { x: body.x + 16, y: body.y + 8, width: body.width - 32, height: HEADING_HEIGHT };
  const rowsTop = tableHeading.y + tableHeading.height + 6;
  const rowWidth = body.width - 32;
  const rows: Rect[] = [];
  const onDesktop = formFactorFor(bounds.width, bounds.height) === "desktop";
  let y = rowsTop;
  for (const detail of rowDetails) {
    const height = toggleRowHeight(detail, rowWidth, onDesktop);
    rows.push({ x: body.x + 16, y, width: rowWidth, height });
    y += height + ROW_GAP;
  }

  // Content space: everything below starts at its own y=0, translated into the viewport by the scroll region.
  const heading: Rect = { x: body.x + 16, y: 0, width: rowWidth, height: HEADING_HEIGHT };
  const levelRow: Rect = { x: body.x + 16, y: heading.height + 6, width: rowWidth, height: GUIDE_LEVEL_ROW_HEIGHT };
  const guideRows: Rect[] = [];
  let contentY = levelRow.y + levelRow.height + ROW_GAP;
  for (const detail of guideRowDetails) {
    const height = toggleRowHeight(detail, rowWidth, onDesktop);
    guideRows.push({ x: body.x + 16, y: contentY, width: rowWidth, height });
    contentY += height + ROW_GAP;
  }
  const totalHeight = Math.max(0, contentY - ROW_GAP);

  const viewportTop = y + GROUP_GAP - ROW_GAP;
  // Never taller than the content itself (no dead scroll space when it already fits, as on a roomy desktop), and
  // never taller than what's actually left in the panel (the phone case this group exists for).
  const available = Math.max(0, body.y + body.height - viewportTop);
  const viewportHeight = Math.min(totalHeight, available);
  const guideViewport: Rect = { x: body.x + 16, y: viewportTop, width: rowWidth, height: viewportHeight };

  return {
    panel,
    header,
    tableHeading,
    rows,
    guideViewport,
    guideContent: { heading, levelRow, rows: guideRows, totalHeight },
  };
}

/** Every rect this layout places, for a no-overlap test — the Guide group's own content rects are in a separate coordinate space (see `GuideContentLayout`), so only its viewport is checked here. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.tableHeading, ...layout.rows, layout.guideViewport];
}
