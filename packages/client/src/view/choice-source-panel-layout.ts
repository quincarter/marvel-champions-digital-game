/**
 * Where the choice sheet's source-card panel sits, pure geometry.
 *
 * Two shapes, chosen by form factor alone (mirroring `inspect-layout.ts`'s own "panels vs sheet" split, which draws
 * the same distinction for the same reason — width to spare beside a centered panel, or not):
 *
 *  - **Rail** (desktop, tablet landscape): a full card-sized panel to the left of the decision sheet, the pair
 *    centred together as one group — the same composition Inspect's D08 pair uses for its card/rules panels.
 *  - **Strip** (phone, phone landscape, tablet portrait): there is no width to spare beside the sheet at these
 *    sizes, so a compact horizontal strip sits *inside* the sheet, above its title bar's content — a thumbnail,
 *    the name and ability line, and rules text capped at the design's own table line count (`RULES_TEXT_TABLE_LINES`).
 *
 * `railReserve`/`stripReserve` say how much room the caller has to carve out of its own layout *before* asking for
 * a placement — `sourceRailPlacement`/`sourceStripPlacement` only ever place a panel inside room already given to
 * them, the same "the scene measures, this file only lays out" split `inspect-layout.ts` keeps.
 */

import { type FormFactor, type Rect } from "./layout.js";

export type SourcePanelMode = "rail" | "strip";

/**
 * Rail on desktop and tablet landscape, where a decision sheet already sits well short of the viewport's width;
 * strip everywhere shorter or narrower — phone, a phone on its side, and tablet portrait — where the sheet itself
 * is already close to the full width and there is nothing to put beside it.
 */
export function sourcePanelModeFor(formFactor: FormFactor): SourcePanelMode {
  return formFactor === "desktop" || formFactor === "tabletLandscape" ? "rail" : "strip";
}

export const SOURCE_RAIL_WIDTH = 240;
export const SOURCE_RAIL_GAP = 18;
export const SOURCE_STRIP_HEIGHT = 84;
export const SOURCE_STRIP_GAP = 10;

/** How much width the rail needs beside the sheet, gap included — 0 in strip mode, where nothing sits beside it. */
export function railReserve(formFactor: FormFactor): number {
  return sourcePanelModeFor(formFactor) === "rail" ? SOURCE_RAIL_WIDTH + SOURCE_RAIL_GAP : 0;
}

/** How much height the strip needs at the top of the sheet, its own trailing gap included — 0 in rail mode. */
export function stripReserve(formFactor: FormFactor): number {
  return sourcePanelModeFor(formFactor) === "strip" ? SOURCE_STRIP_HEIGHT + SOURCE_STRIP_GAP : 0;
}

export interface SourceRailPlacement {
  readonly mode: "rail";
  readonly rail: Rect;
  readonly art: Rect;
  readonly text: Rect;
}

export interface SourceStripPlacement {
  readonly mode: "strip";
  readonly strip: Rect;
  readonly thumb: Rect;
  readonly text: Rect;
}

export type SourcePanelPlacement = SourceRailPlacement | SourceStripPlacement;

const RAIL_PAD = 12;
const STRIP_PAD = 8;
/** A portrait scan's own height/width ratio (300×419 — the pool's own card scans), so the art slot never distorts one. */
const CARD_ASPECT_HW = 419 / 300;

/**
 * The rail directly to the left of `sheet`, matching its height. Call only after `sheet` has already had
 * `railReserve(formFactor)` subtracted from whatever width budget it was centred against — this function places the
 * rail relative to the sheet it's handed, it does not itself make room.
 */
export function sourceRailPlacement(sheet: Rect): SourceRailPlacement {
  const rail: Rect = {
    x: sheet.x - SOURCE_RAIL_GAP - SOURCE_RAIL_WIDTH,
    y: sheet.y,
    width: SOURCE_RAIL_WIDTH,
    height: sheet.height,
  };
  const artWidth = Math.max(0, rail.width - RAIL_PAD * 2);
  // The art never claims more than half the rail — a tall sheet would otherwise stretch the card far past a
  // readable size and leave the name/rules text column with almost nothing.
  const artHeight = Math.max(0, Math.min(Math.round(artWidth * CARD_ASPECT_HW), Math.round(rail.height * 0.5)));
  const art: Rect = { x: rail.x + RAIL_PAD, y: rail.y + RAIL_PAD, width: artWidth, height: artHeight };
  const textTop = art.y + art.height + (artHeight > 0 ? 10 : 0);
  const text: Rect = {
    x: rail.x + RAIL_PAD,
    y: textTop,
    width: artWidth,
    height: Math.max(0, rail.y + rail.height - RAIL_PAD - textTop),
  };
  return { mode: "rail", rail, art, text };
}

/** The strip filling `area` exactly — a thumbnail on the left, the text column filling the rest. */
export function sourceStripPlacement(area: Rect): SourceStripPlacement {
  const thumbHeight = Math.max(0, area.height - STRIP_PAD * 2);
  const thumbWidth = Math.round(thumbHeight / CARD_ASPECT_HW);
  const thumb: Rect = { x: area.x + STRIP_PAD, y: area.y + STRIP_PAD, width: thumbWidth, height: thumbHeight };
  const textX = thumb.x + thumb.width + (thumbWidth > 0 ? 10 : 0);
  const text: Rect = {
    x: textX,
    y: area.y + STRIP_PAD,
    width: Math.max(0, area.x + area.width - STRIP_PAD - textX),
    height: thumbHeight,
  };
  return { mode: "strip", strip: area, thumb, text };
}
