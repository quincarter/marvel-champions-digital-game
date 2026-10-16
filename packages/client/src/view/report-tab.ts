/**
 * The Report tab (#176, `scenes/report-tab.ts`): a small ink tab on the right edge of every screen that opens the
 * report panel. Every screen in this app runs to the edges, so no corner is free on all of them: the tab sits in the
 * right-hand gutter instead, and the player can drag it up or down the edge off anything it covers. Where it sits is
 * kept as a fraction of the screen's height, so it lands in the same place after a rotation or a resize.
 */
import type { FormFactor, Rect } from "./layout.js";

export interface ReportTabGeometry {
  /** What is drawn: flush with the right edge. */
  readonly tab: Rect;
  /** What takes a press: wider than the tab, toward the screen, so a thumb finds it. */
  readonly hit: Rect;
  /** The label's size: it reads bottom to top along the tab. */
  readonly labelSize: number;
}

const SIZES: Record<"compact" | "wide", { width: number; height: number; hitWidth: number; labelSize: number }> = {
  compact: { width: 18, height: 72, hitWidth: 30, labelSize: 9 },
  wide: { width: 24, height: 92, hitWidth: 34, labelSize: 11 },
};

/** Where a tab with no saved place sits: just under the middle of the edge, below every screen's top chrome. */
export const DEFAULT_REPORT_TAB_Y = 0.55;

/** Keeps the tab clear of the top chrome bar and the bottom action row on every screen. */
const EDGE_MARGIN = { top: 60, bottom: 72 } as const;

export function reportTabGeometry(
  viewport: { readonly width: number; readonly height: number },
  formFactor: FormFactor,
  fraction: number,
): ReportTabGeometry {
  const size = formFactor === "phone" || formFactor === "phoneLandscape" ? SIZES.compact : SIZES.wide;
  const minY = Math.min(EDGE_MARGIN.top, Math.max(0, viewport.height - size.height));
  const maxY = Math.max(minY, viewport.height - EDGE_MARGIN.bottom - size.height);
  const centre = clampFraction(fraction) * viewport.height;
  const y = Math.round(Math.min(maxY, Math.max(minY, centre - size.height / 2)));
  const tab = { x: viewport.width - size.width, y, width: size.width, height: size.height };
  const hit = { x: viewport.width - size.hitWidth, y, width: size.hitWidth, height: size.height };
  return { tab, hit, labelSize: size.labelSize };
}

/** The fraction a drag ending with the tab's centre at `centreY` saves. */
export function reportTabFractionAt(centreY: number, viewportHeight: number): number {
  return viewportHeight <= 0 ? DEFAULT_REPORT_TAB_Y : clampFraction(centreY / viewportHeight);
}

/** A saved place read back from storage: anything that is not a number between 0 and 1 is the default. */
export function parseReportTabFraction(saved: string | null): number {
  if (saved === null || saved.trim() === "") return DEFAULT_REPORT_TAB_Y;
  const value = Number(saved);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_REPORT_TAB_Y;
}

function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_REPORT_TAB_Y;
}
