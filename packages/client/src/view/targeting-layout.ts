/**
 * The targeting panel's layout (design canvases D09 "Targeting", L06 "Inspect & target").
 *
 * Composition, read off the rendered canvases (docs/design-reference.md): a full-width Hero Red title bar —
 * "CHOOSE A TARGET" plus the source and its effect, "CANCEL · ESC" pinned to the right — over a paper ground; below
 * it a "N LEGAL TARGETS" rule, then the legal targets as a row of full card tiles (art, name, outcome). Desktop
 * (D09) gives the "Why not the others?" reasoning its own boxed column beside that row, sized to whatever width the
 * targets don't need. Tablet landscape (L06) spends that same width on the inspector rail instead — the source
 * card's full text beside the target list, "replacing the phone sheet" (its own caption) — so the "why not"
 * reasoning moves under the target row there, in the exact spot L06 draws its own per-target rationale strip.
 * Anything narrower than that (tablet portrait, phone) has room for one column only: target tiles stacked above the
 * "why not" reasoning, no rail — the source card is still one tap away through the ordinary Inspect overlay, the
 * same as everywhere else on the table.
 *
 * Pure function of `bounds` (and, at the boundary, a target count for the row's own tile width) — no text
 * measurement, no Phaser, so it is testable and stays in step with `boardLayout`'s own breakpoints (`layout.ts`'s
 * `formFactorFor`) rather than inventing a second set.
 */

import { CARD_ASPECT, formFactorFor, type FormFactor, type Rect } from "./layout.js";

const MARGIN = { phone: 10, phoneLandscape: 10, tabletPortrait: 14, tabletLandscape: 16, desktop: 20 } as const;
/** The phone's bar holds a title that wraps to two lines (a long "Energy Transfer: choose a target" no longer clips). */
const TITLE_BAR_HEIGHT = {
  phone: 80,
  phoneLandscape: 44,
  tabletPortrait: 52,
  tabletLandscape: 56,
  desktop: 56,
} as const;
/** Narrower on phone: a 128px CTA plus "CHOOSE A TARGET" and the source line left no room for the source at all at 390px wide. */
const CANCEL_WIDTH = {
  phone: 84,
  phoneLandscape: 84,
  tabletPortrait: 112,
  tabletLandscape: 128,
  desktop: 128,
} as const;
const HEADING_HEIGHT = 20;
/** The gap between tiles in a row/stack, and between the target list and its side column. Exported so the scene draws tiles at the same spacing the layout reserved room for. */
export const TARGETING_GAP = 12;
const GAP = TARGETING_GAP;

export interface TargetingLayout {
  readonly formFactor: FormFactor;
  /** The Hero Red bar: title, source line, and where "Cancel · Esc" sits. */
  readonly titleBar: Rect;
  readonly cancelButton: Rect;
  /** "N legal targets" rule, above the row. */
  readonly heading: Rect;
  /** The legal-target tiles: a row on a wide layout, a stacked list otherwise (the caller decides which from `formFactor`). */
  readonly targets: Rect;
  /** One target tile's size within `targets`, at `targetCount` tiles — a row of that many on a wide layout, one full-width row per tile otherwise. */
  readonly tileSize: Rect;
  /** How tall the tile's art band is: part of what the tile's height was sized from, so the drawing and the layout agree. */
  readonly artHeight: number;
  /** "Why not the others?" — a side column on desktop, the strip under the target row on tablet landscape (L06's own rationale-strip position), and the block under the list everywhere narrower. Never zero height: there is always somewhere to say "nothing was excluded" too. */
  readonly excluded: Rect;
  /** The source card's full text beside the target list — tablet landscape only (L06's inspector rail); null everywhere else. */
  readonly inspectorRail: Rect | null;
  /**
   * Where each tile is drawn, one per target in order, with the list at its top (scroll 0). A wide layout lays them in
   * a row that wraps onto more rows once a tile would be narrower than `MIN_ROW_TILE_WIDTH`; a narrow one stacks them.
   */
  readonly tiles: readonly Rect[];
  /**
   * The tiles run past the bottom of `targets` (seven Tech upgrades for Repurpose on a phone): they scroll inside it
   * rather than running off the screen, and leave `SCROLLBAR_ROOM` on the right for the scrollbar.
   */
  readonly scrolls: boolean;
  /** One entry per line of tiles, for the scroll math (`VariableListScroll`): the line's height and the gap under it. */
  readonly lineHeights: readonly number[];
  /** Which line of tiles each tile sits on, to bring a focused tile into view. */
  readonly lineOf: readonly number[];
}

/** Room kept beside scrolling tiles for the scrollbar (`McScrollRegion` draws it inside the region's right edge). */
export const SCROLLBAR_ROOM = 12;
/** Below this a row of tiles wraps onto another row: a narrower tile cannot hold a card's name and art. */
export const MIN_ROW_TILE_WIDTH = 150;

/** Whether this layout has the horizontal room for a side column at all (the "why not" panel on desktop, the inspector rail on tablet landscape). */
const hasSideColumn = (formFactor: FormFactor): boolean => formFactor === "desktop" || formFactor === "tabletLandscape";

/**
 * What the scene measured of the tiles' text, so tiles can size to it instead of to a card's aspect ratio (a two-seat
 * "Whose play area?" tile used to be a 360 px card with a few words in it, and a phone row clipped its caption).
 * `textHeight` is the tallest tile's name and outcome lines wrapped at the tile's width; `confirmReserve` is the
 * line that appears on the active tile (0 for a multi-pick panel, which has none).
 */
export interface TileText {
  readonly textHeight: number;
  readonly confirmReserve: number;
}

const TILE_PAD = 8;
const PHONE_ART = 56;
const MIN_TILE_HEIGHT = 72;

/**
 * `top` is how far down `bounds` the panel itself starts: over the table it is the bottom of the top bar, which the
 * chrome buttons stay drawn on (#515). The form factor still comes from the whole of `bounds`. `hideExcluded`: the
 * panel draws no "why not the others?" box (a pick of cards to pay a cost), so the tiles take its room too.
 */
export function targetingLayout(
  bounds: Rect,
  targetCount: number,
  text?: TileText,
  top = 0,
  hideExcluded = false,
): TargetingLayout {
  const formFactor = formFactorFor(bounds.width, bounds.height);
  const margin = MARGIN[formFactor];
  const titleBarHeight = TITLE_BAR_HEIGHT[formFactor];

  const cancelWidth = CANCEL_WIDTH[formFactor];
  const titleBar: Rect = { x: bounds.x, y: bounds.y + top, width: bounds.width, height: titleBarHeight };
  const cancelButton: Rect = {
    x: titleBar.x + titleBar.width - cancelWidth - margin,
    y: titleBar.y + (titleBarHeight - 36) / 2,
    width: cancelWidth,
    height: 36,
  };

  const heading: Rect = {
    x: bounds.x + margin,
    y: titleBar.y + titleBar.height + margin,
    width: bounds.width - margin * 2,
    height: HEADING_HEIGHT,
  };

  const contentTop = heading.y + heading.height + margin * 0.6;
  const contentBottom = bounds.y + bounds.height - margin;
  const contentHeight = Math.max(0, contentBottom - contentTop);
  const contentWidth = bounds.width - margin * 2;

  if (formFactor === "desktop") {
    // The target row takes the whole width, and "why not the others?" sits under it. It used to be a column beside
    // the row, where it covered the second villain's rules text on a two-villain board (the lit board shows through).
    const area: Rect = { x: bounds.x + margin, y: contentTop, width: contentWidth, height: contentHeight };
    const sized = rowTileSize(area, targetCount, text);
    // The box keeps at least 64px under the rows; rows that need more scroll above it.
    const excludedTop = hideExcluded
      ? contentBottom + GAP
      : Math.min(contentBottom - 64, contentTop + gridHeight(targetCount, sized.tile) + GAP);
    const excluded: Rect = {
      x: bounds.x + margin,
      y: Math.min(excludedTop, contentBottom - 64),
      width: Math.min(contentWidth, 560),
      height: Math.max(64, contentBottom - excludedTop),
    };
    const targets: Rect = { ...area, height: Math.max(0, excludedTop - GAP - contentTop) };
    return {
      formFactor,
      titleBar,
      cancelButton,
      heading,
      targets,
      artHeight: sized.art,
      excluded,
      inspectorRail: null,
      ...gridOf(targets, targetCount, sized.tile),
    };
  }

  if (formFactor === "tabletLandscape") {
    // Target row beside the inspector rail (L06); "why not" moves to the strip under the row, matching L06's own
    // per-target rationale box.
    const railWidth = Math.min(340, contentWidth * 0.34);
    const columnWidth = Math.max(0, contentWidth - railWidth - GAP);
    const excludedHeight = Math.min(96, contentHeight * 0.28);
    const targetsHeight = hideExcluded ? contentHeight : Math.max(0, contentHeight - excludedHeight - GAP);
    const targets: Rect = { x: bounds.x + margin, y: contentTop, width: columnWidth, height: targetsHeight };
    const excluded: Rect = {
      x: bounds.x + margin,
      y: Math.min(targets.y + targets.height + GAP, contentBottom - excludedHeight),
      width: columnWidth,
      height: excludedHeight,
    };
    const sizedTablet = rowTileSize(targets, targetCount, text);
    const inspectorRail: Rect = {
      x: targets.x + targets.width + GAP,
      y: contentTop,
      width: railWidth,
      height: contentHeight,
    };
    return {
      formFactor,
      titleBar,
      cancelButton,
      heading,
      targets,
      artHeight: sizedTablet.art,
      excluded,
      inspectorRail,
      ...gridOf(targets, targetCount, sizedTablet.tile),
    };
  }

  // Phone and tablet portrait: one column, target list above "why not", no rail.
  const excludedHeight = Math.min(140, contentHeight * 0.32);
  const targetsHeight = hideExcluded ? contentHeight : Math.max(0, contentHeight - excludedHeight - GAP);
  const targets: Rect = { x: bounds.x + margin, y: contentTop, width: contentWidth, height: targetsHeight };
  const excluded: Rect = {
    x: bounds.x + margin,
    y: Math.min(targets.y + targets.height + GAP, contentBottom - excludedHeight),
    width: contentWidth,
    height: excludedHeight,
  };
  const stacked = stackedTileSize(targets, targetCount, text);
  const scrolls = targetCount * (stacked.tile.height + GAP) - GAP > targets.height + 0.5;
  // Scrolling rows leave the scrollbar its own strip on the right.
  const width = scrolls ? Math.max(0, targets.width - SCROLLBAR_ROOM) : targets.width;
  const tiles = Array.from({ length: targetCount }, (_, index): Rect => ({
    x: targets.x,
    y: targets.y + index * (stacked.tile.height + GAP),
    width,
    height: stacked.tile.height,
  }));
  return {
    formFactor,
    titleBar,
    cancelButton,
    heading,
    targets,
    tileSize: { ...stacked.tile, width },
    artHeight: stacked.art,
    excluded,
    inspectorRail: null,
    tiles,
    scrolls,
    lineHeights: tiles.map((tile, index) => tile.height + (index < targetCount - 1 ? GAP : 0)),
    lineOf: tiles.map((_, index) => index),
  };
}

/** A wide layout's tile size, and how many tiles share one row. */
type RowTile = Rect & { readonly columns: number };

/** The rows' total height: the tiles and the gaps between them. */
function gridHeight(count: number, tile: RowTile): number {
  if (count <= 0) return 0;
  return Math.ceil(count / tile.columns) * (tile.height + GAP) - GAP;
}

/** A wide layout's tiles in rows of `tile.columns`, scrolling inside `targets` when the rows are taller than it. */
function gridOf(
  targets: Rect,
  count: number,
  tile: RowTile,
): Pick<TargetingLayout, "tiles" | "tileSize" | "scrolls" | "lineHeights" | "lineOf"> {
  const { columns } = tile;
  const lines = count > 0 ? Math.ceil(count / columns) : 0;
  const scrolls = gridHeight(count, tile) > targets.height + 0.5;
  // A scrolling grid narrows its tiles a little when they would reach the scrollbar's strip.
  const width =
    scrolls && columns * (tile.width + GAP) - GAP > targets.width - SCROLLBAR_ROOM
      ? Math.max(0, (targets.width - SCROLLBAR_ROOM - (columns - 1) * GAP) / columns)
      : tile.width;
  const tiles = Array.from({ length: count }, (_, index): Rect => ({
    x: targets.x + (index % columns) * (width + GAP),
    y: targets.y + Math.floor(index / columns) * (tile.height + GAP),
    width,
    height: tile.height,
  }));
  return {
    tiles,
    tileSize: { x: tile.x, y: tile.y, width, height: tile.height },
    scrolls,
    lineHeights: Array.from({ length: lines }, (_, line) => tile.height + (line < lines - 1 ? GAP : 0)),
    lineOf: tiles.map((_, index) => Math.floor(index / columns)),
  };
}

/**
 * A target tile's own natural width (D09's own tiles read roughly card-shaped, not a portrait stretched to fill
 * whatever room the row has — the row sits near the top of its column and leaves the rest of it empty, exactly like
 * the mock's own target row does). Height still follows `CARD_ASPECT` from that width, so a tile is never anything
 * but card-shaped; only its width is ever capped, so two targets in a wide desktop column don't balloon into two
 * nearly-square giants stretched down the whole column.
 */
const MAX_TILE_WIDTH = 260;

/**
 * One tile's size in left-to-right rows filling `area`, capped at its own natural width. All `count` tiles share one row
 * while each keeps `MIN_ROW_TILE_WIDTH`; past that they wrap onto rows of as many as fit (`columns`), and the rows
 * scroll when they outgrow the area (`gridOf`).
 */
function rowTileSize(area: Rect, count: number, text?: TileText): { tile: RowTile; art: number } {
  if (count <= 0) return { tile: { x: area.x, y: area.y, width: 0, height: 0, columns: 1 }, art: 0 };
  const columns = Math.min(count, Math.max(1, Math.floor((area.width + GAP) / (MIN_ROW_TILE_WIDTH + GAP))));
  const gaps = (columns - 1) * GAP;
  const width = Math.min(MAX_TILE_WIDTH, Math.max(0, (area.width - gaps) / columns));
  // One row may take the area's whole height; a wrapped row is never taller than a card, so the next row shows.
  const cardHeight = columns < count ? width / CARD_ASPECT : Math.min(area.height, width / CARD_ASPECT);
  const art = Math.round(Math.min(cardHeight * 0.48, width * 1.05));
  if (!text) return { tile: { x: area.x, y: area.y, width, height: cardHeight, columns }, art };
  // Sized to its content: the art band, the measured text, the confirm line, and the padding around them.
  const wideArt = Math.round(width * 0.66);
  const needed = wideArt + 6 + text.textHeight + text.confirmReserve + TILE_PAD * 2;
  return {
    tile: { x: area.x, y: area.y, width, height: Math.min(cardHeight, Math.max(MIN_TILE_HEIGHT, needed)), columns },
    art: wideArt,
  };
}

/**
 * One row's size in a top-to-bottom stack of `count` rows filling `area` — a phone/tablet-portrait target is a full-width
 * row, not a portrait card. With measured text the row is as tall as its text needs (a short art band above it); when
 * the rows would not all fit, the art goes first, and when they still would not, they keep it and scroll.
 */
function stackedTileSize(area: Rect, count: number, text?: TileText): { tile: Rect; art: number } {
  if (count <= 0) return { tile: { x: area.x, y: area.y, width: area.width, height: 0 }, art: 0 };
  const gaps = (count - 1) * GAP;
  const share = Math.max(0, (area.height - gaps) / count);
  if (!text) {
    const height = Math.min(96, share);
    return { tile: { x: area.x, y: area.y, width: area.width, height }, art: Math.round(height * 0.48) };
  }
  const base = text.textHeight + text.confirmReserve + TILE_PAD * 2 + 6;
  const withArt = base + PHONE_ART;
  if (withArt <= share) return { tile: { x: area.x, y: area.y, width: area.width, height: withArt }, art: PHONE_ART };
  // The art goes first, so a few more rows still fit on the screen whole.
  if (Math.max(MIN_TILE_HEIGHT, base) <= share)
    return { tile: { x: area.x, y: area.y, width: area.width, height: Math.max(MIN_TILE_HEIGHT, base) }, art: 0 };
  // Even without it they don't: the rows keep their art and scroll (`targetingLayout`'s `scrolls`), never squeezed
  // past their text or run off the screen.
  return { tile: { x: area.x, y: area.y, width: area.width, height: withArt }, art: PHONE_ART };
}

export { hasSideColumn };
