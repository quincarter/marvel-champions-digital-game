/**
 * Settings' own layout (docs/phase4-screen-gaps.md §3 "W4"; fidelity pass
 * 2026-09-17): an ink title bar ("Settings" + a boxed ✕, matching Pause's own
 * header) over a "Table" heading and one fixed-height toggle row per setting,
 * stacked — the same row shape Pause's inline "Table" column now uses, so a
 * player who opens either screen reads the identical group. `rowCount` is the
 * number of *real* toggle rows this build draws (reduced motion, sharper text,
 * large card text, sound-drawn-unavailable) — kept a parameter rather than a
 * hardcoded 4 so a later setting doesn't need this module touched to grow.
 */
import { toggleRowHeight, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

const HEADER_HEIGHT = 60;
const HEADING_HEIGHT = 20;
const ROW_GAP = 10;

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly tableHeading: Rect;
  readonly rows: readonly Rect[];
}

/**
 * `rowDetails[i]` is that row's own rendered detail text (`row.unavailable ??
 * row.detail`) — each row is sized to fit it (`toggleRowHeight`, shared with
 * Pause's inline "Table" column, `view/pause-layout.ts`) rather than every
 * row sharing one fixed height that only the *shortest* description actually
 * fit. Fidelity pass, 2026-09-17: at phone width "Reduced motion"'s
 * three-line detail used to run into "Sharper text"'s own heading below it.
 */
export function settingsLayout(bounds: Rect, rowDetails: readonly string[]): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const tableHeading: Rect = { x: body.x + 16, y: body.y + 8, width: body.width - 32, height: HEADING_HEIGHT };
  const rowsTop = tableHeading.y + tableHeading.height + 6;
  const rowWidth = body.width - 32;
  const rows: Rect[] = [];
  let y = rowsTop;
  for (const detail of rowDetails) {
    const height = toggleRowHeight(detail, rowWidth);
    rows.push({ x: body.x + 16, y, width: rowWidth, height });
    y += height + ROW_GAP;
  }
  return { panel, header, tableHeading, rows };
}

/** Every rect this layout places, for a no-overlap test. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.tableHeading, ...layout.rows];
}
