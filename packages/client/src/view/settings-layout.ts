/**
 * Settings' own layout (docs/phase4-screen-gaps.md §3 "W4"): header, then one
 * fixed-height toggle row per setting, stacked. `rowCount` is the number of
 * *real* toggle rows this build draws (reduced motion, large card text,
 * sound-drawn-unavailable) — kept a parameter rather than a hardcoded 3 so a
 * later setting doesn't need this module touched to grow.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { overlayPanelLayout, stackedRow } from "./overlay-layout.js";

const HEADER_HEIGHT = 56;

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly rows: readonly Rect[];
}

export function settingsLayout(bounds: Rect, rowCount: number): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const inset: Rect = { x: body.x + 16, y: body.y + 8, width: body.width - 32, height: body.height };
  const rows = Array.from({ length: rowCount }, (_, index) => stackedRow(inset, index, hit.target, 10));
  return { panel, header, rows };
}
