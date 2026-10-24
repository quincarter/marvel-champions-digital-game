/**
 * Where the key and button glyphs sit, as pure math (`docs/controller-support.md`, owner decisions 5 and 6).
 *
 * The rules, for all of it:
 *  - A glyph sits right beside its button's word, the pair centered together ("A CONFIRM"). It takes room only inside
 *    the button: the button never changes size, and the word slides over just far enough to make room (and slides back
 *    as the glyph closes). The word is never shortened or wrapped.
 *  - When glyph and word do not fit together, the glyph hangs just outside the button, below it or above it when below
 *    would leave the screen, like the MENU glyph.
 *  - A hanging glyph is never drawn over another object (a card, a pile, a panel): if its spot overlaps one, nothing
 *    is drawn at all.
 *  - Glyphs are for desktop and tablet landscape only, never the tabbed phone layouts.
 *
 * `ui/glyph-hints.ts` draws what these functions place.
 */

import type { GlyphSpec } from "./input-glyph-model.js";
import { rectsOverlap, type Rect } from "./layout.js";

/** Room kept between a button's left edge and its glyph. */
export const GLYPH_EDGE_PAD = 5;
/** Room kept between a glyph and the label it sits beside. */
export const GLYPH_LABEL_GAP = 6;
export const GLYPH_MAX_HEIGHT = 20;
export const GLYPH_MIN_HEIGHT = 14;

/** Glyphs are for a keyboard or a pad, which a phone layout (tabbed) is not: desktop and tablet landscape only. */
export const glyphsFitLayout = (tabbed: boolean): boolean => !tabbed;

/** A base glyph height scaled by the hint size setting (`Settings.glyphSize`, percent), to a whole pixel. */
export const scaledGlyphHeight = (base: number, percent: number): number =>
  Math.max(1, Math.round((base * percent) / 100));

/**
 * A glyph's base height for a control `controlHeight` tall: it sits inside the control's own padding. The hint size
 * setting then scales it (`percent`, default 100 = the base), so a larger hint may overhang the button's own padding:
 * `glyphBesideLabel` then finds no room and the glyph hangs outside instead.
 */
export function glyphHeightFor(controlHeight: number, percent = 100): number {
  const base = Math.max(GLYPH_MIN_HEIGHT, Math.min(GLYPH_MAX_HEIGHT, Math.floor(controlHeight - 12)));
  return scaledGlyphHeight(base, percent);
}

export interface GlyphPoint {
  /** The glyph's left edge. */
  readonly x: number;
  /** The glyph's vertical center. */
  readonly y: number;
}

export interface LabelBox {
  /** The label's center x, before any slide. */
  readonly cx: number;
  readonly width: number;
  /** The room the button leaves for the label and a glyph: left and right limits. */
  readonly minX: number;
  readonly maxX: number;
}

export interface BesideLabel {
  /** The glyph's left edge and vertical center. */
  readonly x: number;
  readonly y: number;
  /** How far the label slides right to make room; 0 when the glyph is closed. */
  readonly labelShift: number;
}

/**
 * The glyph right beside the button's word, the pair centered together, or null when the pair (at the glyph's full
 * width) does not fit inside the button's own padding. Decided on the full width, so a glyph that is mid-animation
 * never flickers in and out of existence. `glyphWidth` and `openness` are the glyph's current ones: the word slides by
 * `openness` of the way, so a closed glyph leaves the word exactly where the button put it.
 */
export function glyphBesideLabel(
  button: Rect,
  label: LabelBox,
  glyphFullWidth: number,
  glyphWidth: number,
  openness: number,
): BesideLabel | null {
  const total = glyphFullWidth + GLYPH_LABEL_GAP + label.width;
  const start = label.cx - total / 2;
  if (start < label.minX + GLYPH_EDGE_PAD || start + total > label.maxX - GLYPH_EDGE_PAD) return null;
  const labelShift = (openness * (glyphWidth + GLYPH_LABEL_GAP)) / 2;
  const x = label.cx + labelShift - label.width / 2 - GLYPH_LABEL_GAP - glyphWidth;
  return { x, y: button.y + button.height / 2, labelShift };
}

/** The rect a glyph at `point` covers. */
export const glyphRect = (point: GlyphPoint, width: number, height: number): Rect => ({
  x: point.x,
  y: point.y - height / 2,
  width,
  height,
});

/** True when a hanging glyph's spot is free of every `obstacles` rect, so it can be drawn without covering anything. */
export const hangIsClear = (spot: Rect, obstacles: readonly Rect[]): boolean =>
  !obstacles.some((obstacle) => rectsOverlap(spot, obstacle));

/** A glyph hanging just below `anchor`, its right edge on the anchor's right edge (the chrome's MENU button). */
export function glyphHangingBelow(anchor: Rect, width: number, height: number, gap = 3): GlyphPoint {
  return { x: anchor.x + anchor.width - width, y: anchor.y + anchor.height + gap + height / 2 };
}

/**
 * Where a glyph goes when its button is too narrow to hold it: hung just outside, right edges aligned, below the
 * button, or above it when below would leave the viewport. Kept inside the viewport horizontally.
 */
export function glyphOutsideButton(button: Rect, width: number, height: number, viewport: Rect, gap = 3): GlyphPoint {
  const below = button.y + button.height + gap + height;
  const y =
    below <= viewport.y + viewport.height ? button.y + button.height + gap + height / 2 : button.y - gap - height / 2;
  const x = Math.max(viewport.x, Math.min(button.x + button.width - width, viewport.x + viewport.width - width));
  return { x, y };
}

/** A glyph on the right edge of a header row `row` tall that starts at `top`, `padX` in from `panel`'s right edge. */
export function glyphRightInRow(panel: Rect, top: number, row: number, width: number, padX: number): GlyphPoint {
  return { x: panel.x + panel.width - padX - width, y: top + row / 2 };
}

/** A stable identity for a spec list, so a scene re-sets its glyph only when the keys it shows actually changed. */
export const specsSignature = (specs: readonly GlyphSpec[] | null): string =>
  specs === null ? "" : specs.map((spec) => `${spec.kind}:${spec.label}`).join("|");

export interface LegendItem {
  readonly glyphWidth: number;
  readonly textWidth: number;
}

export interface LegendSlot {
  readonly glyphX: number;
  readonly textX: number;
}

export const LEGEND_PAD = 8;
/** The legend strip's base glyph height and strip height (scaled by the hint size setting). */
export const LEGEND_GLYPH_HEIGHT = 16;
export const LEGEND_HEIGHT = 22;

/** The strip's height for a hint size: it grows with its glyphs, never below the base. */
export const legendHeightFor = (percent: number): number =>
  Math.max(LEGEND_HEIGHT, scaledGlyphHeight(LEGEND_GLYPH_HEIGHT, percent) + 6);
const LEGEND_GLYPH_TEXT_GAP = 5;
const LEGEND_ITEM_GAP = 12;

/** Lays a strip's items in a row from x 0: each its glyph, then its words. Returns the slots and the strip's width. */
export function legendLayout(items: readonly LegendItem[]): { slots: LegendSlot[]; width: number } {
  let x = LEGEND_PAD;
  const slots: LegendSlot[] = [];
  items.forEach((item, index) => {
    if (index > 0) x += LEGEND_ITEM_GAP;
    const glyphX = x;
    const textX = glyphX + item.glyphWidth + (item.glyphWidth > 0 ? LEGEND_GLYPH_TEXT_GAP : 0);
    slots.push({ glyphX, textX });
    x = textX + item.textWidth;
  });
  return { slots, width: x + LEGEND_PAD };
}

/**
 * The strip's rect above a focused card, centered on it and kept inside the viewport; below the card when there is no
 * room above.
 */
export function legendRect(card: Rect, size: { width: number; height: number }, viewport: Rect, gap = 4): Rect {
  const above = card.y - gap - size.height;
  const y = above >= viewport.y ? above : card.y + card.height + gap;
  const centered = card.x + card.width / 2 - size.width / 2;
  const x = Math.max(viewport.x, Math.min(centered, viewport.x + viewport.width - size.width));
  return { x, y, width: size.width, height: size.height };
}

export interface LegendSegment {
  /** The shortcut whose glyph leads the segment. */
  readonly id: "activate" | "inspect" | "cancel";
  readonly text: string;
}

/**
 * What the focused-card strip says: "A Select · Y Inspect · B Back" ("Enter Select · I Inspect · Esc Back" on a
 * keyboard). The last item says what Esc / B does right now: "Back" when there is something to back out of, "Pause"
 * when the board is idle and it opens Pause. Inspect adds "hold to zoom" while the zoom is on (Card hover size is not
 * "off": `docs/controller-support.md` decision 8).
 */
export function legendSegments(cancelMeans: "back" | "pause", zoom = true): readonly LegendSegment[] {
  return [
    { id: "activate", text: "Select" },
    { id: "inspect", text: zoom ? "Inspect · hold to zoom" : "Inspect" },
    { id: "cancel", text: cancelMeans === "back" ? "Back" : "Pause" },
  ];
}

/** The most room the hand caption's "[ ] Zones" hint takes, from the glyph's left edge. */
export const ZONES_HINT_WIDTH = 150;

/** Whether the "[ ] Zones" hint at `x` clears the owed-Forced-Action note, whose left edge is `noteLeft` (null: no note). */
export const zonesHintFits = (x: number, noteLeft: number | null, percent = 100): boolean =>
  noteLeft === null || x + Math.round((ZONES_HINT_WIDTH * percent) / 100) + 8 <= noteLeft;

/** The targeting panel's Cancel label: the Esc hint stays as text until a key or pad is in use, then it is a glyph. */
export const cancelLabel = (hinted: boolean, glyphSet: "keyboard" | "pad" | null): string =>
  hinted && glyphSet === null ? "Cancel · Esc" : "Cancel";

/** The same rule by form factor, for scenes that do not carry the board's `tabbed` flag (the decision popup, the villain phase). */
export const glyphsFitFormFactor = (formFactor: string): boolean =>
  formFactor === "desktop" || formFactor === "tabletLandscape";
