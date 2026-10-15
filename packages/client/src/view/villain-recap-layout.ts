/**
 * The held-open villain-phase recap's own layout (D3 desktop, T3 tablet, P4 phone;
 * artifacts/design-screenshots/villain-phase/).
 *
 *  - **Desktop (D3):** header (title, subtitle, Hide), the "what changed" tiles in one row, then five step columns
 *    side by side (widths weighted by how much each usually holds), and a footer: the auto-advance toggle and its
 *    hint on the left, FULL LOG and the red START PLAYER PHASE on the right.
 *  - **Tablet (T3):** the step columns sit left (steps 1-2, then 3-5) and a "WHAT CHANGED" rail runs down the right
 *    with the toggle and the CTA at its foot; FULL LOG moves up beside Hide. Tablet portrait has the room for one
 *    steps column only, so it stacks all five.
 *  - **Phone (P4):** tiles in a short grid, one column of steps, then toggle + FULL LOG and the CTA at the foot.
 *
 * Every steps region is a scrolling viewport (`ui/scroll-region.ts`); the scene draws the steps top to bottom into it.
 * Pure function of `bounds`, the form factor and the tile count: no text measurement.
 */
import { hit } from "../tokens.js";
import type { FormFactor, Rect } from "./layout.js";

const MARGIN_PHONE = 8;
const MARGIN_WIDE = 28;
const PAD_PHONE = 12;
const PAD_WIDE = 24;
const GAP = 20;
const COLUMN_WEIGHTS = [1, 1.8, 1, 1.6, 0.95];

/** The margin the ordinary layout keeps around its panel: a docked tab panel is inflated by it, to fill the dock's own. */
export const recapMarginFor = (formFactor: FormFactor): number => (formFactor === "phone" ? MARGIN_PHONE : MARGIN_WIDE);

export interface VillainRecapLayout {
  readonly panel: Rect;
  readonly title: Rect;
  readonly subtitle: Rect;
  /** Closes the recap (the mockups' "HIDE"). */
  readonly hide: Rect;
  /** Opens the game log; beside Hide on tablet, in the footer on desktop and phone. */
  readonly fullLog: Rect;
  /** The "WHAT CHANGED" caption over the tablet rail; zero height elsewhere. */
  readonly tilesLabel: Rect;
  /** One rect per "what changed" tile, in order. */
  readonly tiles: readonly Rect[];
  /** The scrolling viewports the five steps are drawn into. */
  readonly regions: readonly Rect[];
  /** Which region each of the five steps belongs to. */
  readonly stepRegion: readonly number[];
  readonly toggle: Rect;
  /** The sentence beside the toggle (desktop only; zero width elsewhere). */
  readonly hint: Rect;
  /** START PLAYER PHASE. */
  readonly cta: Rect;
  /**
   * How many entry cards sit side by side in each region (default 1, stacked): the docked recap's step 4 runs across
   * the bottom (B2).
   */
  readonly regionAcross?: readonly number[];
}

const zero = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 });

export function villainRecapLayout(bounds: Rect, formFactor: FormFactor, tileCount: number): VillainRecapLayout {
  const phone = formFactor === "phone";
  const tablet = formFactor === "tabletLandscape" || formFactor === "tabletPortrait";
  const margin = phone ? MARGIN_PHONE : MARGIN_WIDE;
  const pad = phone ? PAD_PHONE : PAD_WIDE;
  const panel: Rect = {
    x: bounds.x + margin,
    y: bounds.y + margin,
    width: bounds.width - margin * 2,
    height: bounds.height - margin * 2,
  };
  const contentX = panel.x + pad;
  const contentWidth = panel.width - pad * 2;
  const right = contentX + contentWidth;
  const bottom = panel.y + panel.height - pad;
  let y = panel.y + pad;

  const hideWidth = phone ? 80 : 96;
  const hide: Rect = { x: right - hideWidth, y, width: hideWidth, height: hit.target };
  const fullLogWidth = phone ? 104 : 140;
  const title: Rect = {
    x: contentX,
    y,
    width: contentWidth - hideWidth - 12 - (tablet ? fullLogWidth + 12 : 0),
    height: Math.max(phone ? 22 : 34, hit.target),
  };
  const tabletFullLog: Rect = { x: hide.x - 12 - fullLogWidth, y, width: fullLogWidth, height: hit.target };
  y += title.height + 6;
  const subtitle: Rect = { x: contentX, y, width: contentWidth, height: phone ? 0 : 20 };
  y += subtitle.height + (phone ? 4 : 14);

  const ctaHeight = hit.primary;

  if (phone) {
    const cols = Math.max(1, Math.min(3, tileCount));
    const rows = Math.ceil(tileCount / cols);
    const tileGap = 8;
    const tileHeight = 52;
    const tileWidth = (contentWidth - tileGap * (cols - 1)) / cols;
    const tiles = Array.from({ length: tileCount }, (_, i): Rect => {
      return {
        x: contentX + (i % cols) * (tileWidth + tileGap),
        y: y + Math.floor(i / cols) * (tileHeight + tileGap),
        width: tileWidth,
        height: tileHeight,
      };
    });
    y += rows > 0 ? rows * tileHeight + (rows - 1) * tileGap + 10 : 0;
    const cta: Rect = { x: contentX, y: bottom - ctaHeight, width: contentWidth, height: ctaHeight };
    const fullLog: Rect = {
      x: right - fullLogWidth,
      y: cta.y - 8 - hit.target,
      width: fullLogWidth,
      height: hit.target,
    };
    const toggle: Rect = { x: contentX, y: fullLog.y, width: contentWidth - fullLogWidth - 8, height: hit.target };
    const region: Rect = { x: contentX, y, width: contentWidth, height: Math.max(0, toggle.y - 10 - y) };
    return {
      panel,
      title,
      subtitle,
      hide,
      fullLog,
      tilesLabel: zero(contentX, y),
      tiles,
      regions: [region],
      stepRegion: [0, 0, 0, 0, 0],
      toggle,
      hint: zero(toggle.x, toggle.y),
      cta,
    };
  }

  if (tablet) {
    const railWidth = formFactor === "tabletPortrait" ? 220 : 270;
    const railX = right - railWidth;
    const mainWidth = railX - GAP - contentX;
    const cta: Rect = { x: railX, y: bottom - ctaHeight, width: railWidth, height: ctaHeight };
    const toggle: Rect = { x: railX, y: cta.y - 8 - hit.primary, width: railWidth, height: hit.primary };
    const tilesLabel: Rect = { x: railX, y, width: railWidth, height: 18 };
    const tilesTop = y + tilesLabel.height + 4;
    const tilesRoom = toggle.y - 12 - tilesTop;
    const tileGap = 8;
    const tileHeight =
      tileCount === 0 ? 0 : Math.max(36, Math.min(62, (tilesRoom - tileGap * (tileCount - 1)) / tileCount));
    const tiles = Array.from({ length: tileCount }, (_, i): Rect => {
      return { x: railX, y: tilesTop + i * (tileHeight + tileGap), width: railWidth, height: tileHeight };
    });
    const regionHeight = Math.max(0, bottom - y);
    const regions: Rect[] =
      formFactor === "tabletPortrait"
        ? [{ x: contentX, y, width: mainWidth, height: regionHeight }]
        : [
            { x: contentX, y, width: (mainWidth - GAP) / 2, height: regionHeight },
            { x: contentX + (mainWidth - GAP) / 2 + GAP, y, width: (mainWidth - GAP) / 2, height: regionHeight },
          ];
    return {
      panel,
      title,
      subtitle,
      hide,
      fullLog: tabletFullLog,
      tilesLabel,
      tiles,
      regions,
      stepRegion: regions.length === 1 ? [0, 0, 0, 0, 0] : [0, 0, 1, 1, 1],
      toggle,
      hint: zero(toggle.x, toggle.y),
      cta,
    };
  }

  // Desktop.
  const tileGap = GAP;
  const tileHeight = 76;
  const tileWidth = tileCount === 0 ? 0 : (contentWidth - tileGap * (tileCount - 1)) / tileCount;
  const tiles = Array.from({ length: tileCount }, (_, i): Rect => {
    return { x: contentX + i * (tileWidth + tileGap), y, width: tileWidth, height: tileHeight };
  });
  y += tileHeight + 14;
  const cta: Rect = { x: right - 300, y: bottom - ctaHeight, width: 300, height: ctaHeight };
  const fullLog: Rect = { x: cta.x - 12 - fullLogWidth, y: cta.y, width: fullLogWidth, height: ctaHeight };
  const toggle: Rect = { x: contentX, y: cta.y, width: 290, height: ctaHeight };
  const hint: Rect = {
    x: toggle.x + toggle.width + 16,
    y: cta.y,
    width: Math.max(0, fullLog.x - 16 - (toggle.x + toggle.width + 16)),
    height: ctaHeight,
  };
  const regionTop = y;
  const regionHeight = Math.max(0, cta.y - 14 - regionTop);
  const total = COLUMN_WEIGHTS.reduce((a, b) => a + b, 0);
  const unit = (contentWidth - GAP * (COLUMN_WEIGHTS.length - 1)) / total;
  let x = contentX;
  const regions = COLUMN_WEIGHTS.map((weight): Rect => {
    const rect: Rect = { x, y: regionTop, width: unit * weight, height: regionHeight };
    x += unit * weight + GAP;
    return rect;
  });
  return {
    panel,
    title,
    subtitle,
    hide,
    fullLog,
    tilesLabel: zero(contentX, y),
    tiles,
    regions,
    stepRegion: [0, 1, 2, 3, 4],
    toggle,
    hint,
    cta,
  };
}

/**
 * The recap docked beside the table (B2 desktop, TB2 tablet landscape): "the step-by-step strip". The panel is the
 * dock's, which flexes with the window (about 440 to 1100 wide on desktop), so nothing here assumes a width. Header
 * (title, subtitle, FULL LOG and EXPAND at the right), the "what changed" tiles in one row, then
 * steps 1, 3 and 5 stacked compact in a left column with step 2's activations in a right column, step 4's reveals
 * across the bottom, and the footer: the auto-advance toggle and START PLAYER PHASE.
 *
 * `hide` is EXPAND's rectangle here. Phones and tablets in portrait dock into the tab panel with the ordinary
 * `villainRecapLayout` over the panel's bounds.
 */
export function villainDockedRecapLayout(panel: Rect, kind: "rail" | "band", tileCount: number): VillainRecapLayout {
  const band = kind === "band";
  const pad = band ? 16 : 20;
  const x = panel.x + pad;
  const width = Math.max(0, panel.width - pad * 2);
  const right = x + width;
  const bottom = panel.y + panel.height - pad;
  const top = panel.y + pad;

  const expand: Rect = { x: right - 116, y: top, width: 116, height: hit.target };
  const fullLogWidth = 130;
  const headerFullLog: Rect = { x: expand.x - 10 - fullLogWidth, y: top, width: fullLogWidth, height: hit.target };
  const titleRight = headerFullLog.x;
  const title: Rect = { x, y: top, width: Math.max(0, titleRight - 12 - x), height: 36 };
  const subtitle: Rect = { x, y: top + 44, width: Math.max(0, titleRight - 12 - x), height: 18 };

  const tilesTop = top + 70;
  const tileGap = band ? 10 : 12;
  const tileHeight = band ? 52 : 64;
  const tileWidth = tileCount === 0 ? 0 : (width - tileGap * (tileCount - 1)) / tileCount;
  const tiles = Array.from({ length: tileCount }, (_, i): Rect => {
    return { x: x + i * (tileWidth + tileGap), y: tilesTop, width: tileWidth, height: tileHeight };
  });

  const ctaHeight = hit.primary;
  const ctaWidth = Math.min(300, Math.round(width * 0.42));
  const cta: Rect = { x: right - ctaWidth, y: bottom - ctaHeight, width: ctaWidth, height: ctaHeight };
  const fullLog = headerFullLog;
  const toggleRight = cta.x;
  const toggle: Rect = {
    x,
    y: cta.y,
    width: Math.max(0, Math.min(290, toggleRight - 12 - x)),
    height: ctaHeight,
  };

  const areaTop = tilesTop + (tileCount > 0 ? tileHeight + 12 : 0);
  const areaHeight = Math.max(0, cta.y - 12 - areaTop);
  if (band) {
    // TB2: steps 1, 3 and 5 stacked on the left, step 2 in the middle, step 4 on the right, each the area's full height.
    const colGap = 16;
    const colWidth = (width - colGap * 2) / 3;
    const columns = [0, 1, 2].map((i): Rect => {
      return { x: x + i * (colWidth + colGap), y: areaTop, width: colWidth, height: areaHeight };
    });
    return {
      panel,
      title,
      subtitle,
      hide: expand,
      fullLog,
      tilesLabel: zero(x, areaTop),
      tiles,
      regions: columns,
      stepRegion: [0, 1, 0, 2, 0],
      toggle,
      hint: zero(toggle.x, toggle.y),
      cta,
      regionAcross: [1, 1, 1],
    };
  }
  const bottomHeight = Math.min(areaHeight, Math.max(120, Math.round(areaHeight * 0.34)));
  const upperHeight = Math.max(0, areaHeight - bottomHeight - 12);
  const leftWidth = Math.round((width - 16) * 0.38);
  const left: Rect = { x, y: areaTop, width: leftWidth, height: upperHeight };
  const middle: Rect = {
    x: x + leftWidth + 16,
    y: areaTop,
    width: Math.max(0, width - leftWidth - 16),
    height: upperHeight,
  };
  const across = Math.max(1, Math.min(3, Math.floor((width + 12) / (260 + 12))));
  const lower: Rect = { x, y: areaTop + upperHeight + 12, width, height: bottomHeight };

  return {
    panel,
    title,
    subtitle,
    hide: expand,
    fullLog,
    tilesLabel: zero(x, areaTop),
    tiles,
    regions: [left, middle, lower],
    stepRegion: [0, 1, 0, 2, 0],
    toggle,
    hint: zero(toggle.x, toggle.y),
    cta,
    regionAcross: [1, 1, across],
  };
}

/** The inner padding of one recap entry, on every side: text never touches the entry's edge. */
export const RECAP_ENTRY_PAD = 12;

/**
 * Where a step-4 entry's card name goes against its seat chip: beside it when both fit on one line, under it when the
 * chip would squeeze the name (a long hero name in a narrow column). Pure over the measured widths.
 */
export function recapNamePlacement(
  chipWidth: number,
  nameWidth: number,
  available: number,
  gap = 8,
): "inline" | "below" {
  return chipWidth + gap + nameWidth <= available ? "inline" : "below";
}
