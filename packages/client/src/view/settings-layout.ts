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
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { overlayPanelLayout, stackedRow } from "./overlay-layout.js";

const HEADER_HEIGHT = 60;
const HEADING_HEIGHT = 20;

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly tableHeading: Rect;
  readonly rows: readonly Rect[];
}

export function settingsLayout(bounds: Rect, rowCount: number): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const tableHeading: Rect = { x: body.x + 16, y: body.y + 8, width: body.width - 32, height: HEADING_HEIGHT };
  const inset: Rect = { x: body.x + 16, y: tableHeading.y + tableHeading.height + 6, width: body.width - 32, height: body.height };
  const rows = Array.from({ length: rowCount }, (_, index) => stackedRow(inset, index, hit.target, 10));
  return { panel, header, tableHeading, rows };
}

/** Every rect this layout places, for a no-overlap test. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.tableHeading, ...layout.rows];
}
