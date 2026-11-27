/**
 * The Matchups tab's list rows as `mc-sheet` parts (`scenes/player-stats.ts`): the key, a villain's shelf and a hero's
 * Focus tile, drawn where `ui/matchup-rows.ts` drew them in Phaser, with the same sizes and colors. `view/matchup-grid.ts`
 * lays them out.
 */
import { surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import {
  TILE_RIBBON_HEIGHT,
  designerLines,
  shelfPictureRect,
  tilePictureRect,
  type LegendLayout,
  type MatchupTile,
  type ShelfView,
} from "../view/matchup-grid.js";
import { TIER_COLORS, onTierColor } from "../ui/matchup-rows.js";
import { bangers } from "../ui/campaign-chrome.js";
import type { SheetBuilder } from "./sheet-builder.js";

const LEGEND_SWATCH = 14;
/** A shelf's pips, across and down, on a screen wide enough to show them. */
const PIP = 12;
const PIP_GAP = 3;
const SHELF_NAMES = 230;
const BADGE_WIDTH = 92;

interface CreditedOptions {
  readonly size: number;
  readonly color: number;
  readonly letterSpacing?: number;
  /** The most lines the name may take (a credited name keeps its credit on its own last line). */
  readonly maxLines: number;
  /** Several lines wrap; one line is cut. */
  readonly wrap: boolean;
  /** Centered on `x + width / 2` instead of starting at `x`. */
  readonly center?: boolean;
}

/**
 * A Match-ups name in `width`, keeping a custom pack's designer credit in sight (issue #937, as `fitCredited` does in
 * Phaser): a name with no credit fits as the view always did; a credited name that does not fit one line whole keeps its
 * credit apart from the name, which is the part that wraps or is cut (on its own last line with two or more lines, else
 * after the cut name on the one line). Returns how tall it came out.
 */
export function creditedName(
  b: SheetBuilder,
  label: string,
  x: number,
  y: number,
  width: number,
  spec: TypeSpec,
  options: CreditedOptions,
): number {
  const origin: [number, number] = options.center ? [0.5, 0] : [0, 0];
  const at = options.center ? x + width / 2 : x;
  const base = {
    size: options.size,
    color: options.color,
    origin,
    ...(options.letterSpacing !== undefined ? { letterSpacing: options.letterSpacing } : {}),
    ...(options.center ? { align: "center" as const } : {}),
  };
  const plain = (text: string, lines: number, atY: number): number => {
    const wrapped = options.wrap && lines > 1;
    const extra = wrapped ? { wrapWidth: width, maxLines: lines } : { fitWidth: width };
    return b.text(at, atY, text, spec, { ...base, ...extra }).height;
  };
  const parts = designerLines(label);
  if (!parts) return plain(label, options.maxLines, y);
  if (b.measure(label, spec, { size: options.size }).width <= width) return plain(label, 1, y);
  const [title, credit] = parts;
  if (options.maxLines <= 1) {
    const creditWidth = b.measure(credit, spec, { size: options.size }).width;
    const room = Math.max(0, width - creditWidth - 4);
    const titleWidth = Math.min(room, b.measure(title, spec, { size: options.size }).width);
    const height = b.text(options.center ? x : x, y, title, spec, {
      ...base,
      origin: [0, 0],
      fitWidth: Math.max(10, room),
    }).height;
    b.text(x + titleWidth + 4, y, credit, spec, { ...base, origin: [0, 0] });
    return height;
  }
  const height = options.maxLines > 2 ? plain(title, options.maxLines - 1, y) : plain(title, 1, y);
  b.text(at, y + height, credit, spec, { ...base, fitWidth: width });
  return height * 2;
}

/** The key: a swatch and a word for each look on show. */
export function drawLegendNodes(b: SheetBuilder, layout: LegendLayout, x: number, y: number): void {
  for (const placed of layout.entries) {
    const left = x + placed.x;
    const top = y + placed.y + 2;
    const { entry } = placed;
    const swatch: Rect = { x: left, y: top, width: LEGEND_SWATCH, height: LEGEND_SWATCH };
    if (entry.kind === "tier") b.box(swatch, { fill: TIER_COLORS[entry.tier] });
    else if (entry.kind === "unplayed") b.box(swatch, { fill: surface.parchment.hex });
    else b.box(swatch, { stroke: surface.ink.hex, strokeWidth: 2 });
    b.text(left + LEGEND_SWATCH + 6, top - 1, entry.label, typeRole.body, {
      size: 12,
      color: surface.ink.hex,
      alpha: 0.85,
    });
  }
}

/** One line of a shelf's stacked bar: each tier's share of the whole axis, the rest left empty. */
function drawShelfBar(b: SheetBuilder, shelf: ShelfView, bar: Rect): void {
  b.box(bar, { fill: surface.paper.hex });
  let x = bar.x;
  for (const part of shelf.bar) {
    const width = (bar.width * part.count) / Math.max(1, shelf.total);
    b.box({ x, y: bar.y, width, height: bar.height }, { fill: TIER_COLORS[part.tier] });
    x += width;
  }
  b.box(bar, { stroke: surface.ink.hex, strokeWidth: 2 });
}

/** A villain's shelf: its picture and record, a bar of its wins by tier, and one pip per hero, wins first. */
export function drawShelfNodes(
  b: SheetBuilder,
  shelf: ShelfView,
  rect: Rect,
  picture: string | null,
  phone: boolean,
): void {
  const box: Rect = { x: rect.x, y: rect.y + 3, width: rect.width, height: rect.height - 6 };
  b.box(box, { fill: surface.parchment.hex });
  b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
  const thumb = shelfPictureRect(rect, phone);
  b.image(thumb, { src: picture, fill: surface.parchment.hex, cover: { x: 0.5, y: 0.2 } });
  const left = thumb.x + thumb.width + 10;
  const right = box.x + box.width - 10;
  const nameSize = phone ? 18 : 22;
  creditedName(
    b,
    shelf.name.toUpperCase(),
    left,
    box.y + 8,
    (phone ? right - left : SHELF_NAMES) - 4,
    bangers(nameSize),
    {
      size: nameSize,
      color: surface.ink.hex,
      letterSpacing: 0.5,
      maxLines: 1,
      wrap: false,
    },
  );
  b.text(left, box.y + (phone ? 32 : 38), phone ? shelf.short : shelf.summary, typeRole.body, {
    size: 12,
    color: surface.ink.hex,
    alpha: 0.85,
    fitWidth: (phone ? right - left : SHELF_NAMES) - 4,
  });
  if (phone) {
    drawShelfBar(b, shelf, { x: left, y: box.y + box.height - 18, width: right - left, height: 10 });
    return;
  }
  const barLeft = left + SHELF_NAMES;
  const barRight = right - BADGE_WIDTH - 12;
  drawShelfBar(b, shelf, { x: barLeft, y: box.y + 10, width: barRight - barLeft, height: 12 });
  let x = barLeft;
  let y = box.y + 28;
  for (const pip of shelf.pips) {
    if (x + PIP > barRight) {
      x = barLeft;
      y += PIP + PIP_GAP;
    }
    if (y + PIP > box.y + box.height - 2) break;
    const cell: Rect = { x, y, width: PIP, height: PIP };
    if (pip === "unplayed") b.box(cell, { fill: surface.paper.hex });
    else if (pip === "played") b.box(cell, { stroke: surface.ink.hex, strokeWidth: 2 });
    else b.box(cell, { fill: TIER_COLORS[pip] });
    x += PIP + PIP_GAP;
  }
  if (shelf.best) {
    const badge: Rect = { x: right - BADGE_WIDTH, y: box.y + (box.height - 32) / 2, width: BADGE_WIDTH, height: 32 };
    b.box(badge, { fill: TIER_COLORS[shelf.best], stroke: surface.ink.hex, strokeWidth: 2 });
    b.text(
      badge.x + badge.width / 2,
      badge.y + badge.height / 2,
      shelf.bestLabel,
      { ...typeRole.label, size: 12 },
      {
        size: 12,
        color: onTierColor(shelf.best),
        origin: [0.5, 0.5],
        fitWidth: badge.width - 8,
      },
    );
  }
}

/** A hero's tile in the Focus view: its picture, a ribbon saying what you did, its name. */
export function drawTileNodes(
  b: SheetBuilder,
  tile: MatchupTile,
  box: Rect,
  picture: string | null,
  phone: boolean,
): void {
  const won = tile.look.kind === "won";
  const played = tile.look.kind === "played";
  b.box(box, { fill: surface.parchment.hex });
  const art = tilePictureRect(box, phone);
  b.image(art, { src: picture, fill: surface.parchment.hex, cover: { x: 0.5, y: 0.2 } });
  // Pairings not beaten stay in view but stand back, so the wins read first.
  if (!won) b.box(art, { fill: surface.parchment.hex, fillAlpha: played ? 0.25 : 0.65 });
  const ribbon: Rect = { x: box.x, y: art.y + art.height, width: box.width, height: TILE_RIBBON_HEIGHT };
  if (tile.look.kind === "won") b.box(ribbon, { fill: TIER_COLORS[tile.look.tier] });
  else if (played) b.box(ribbon, { stroke: surface.ink.hex, strokeWidth: 2 });
  const color = tile.look.kind === "won" ? onTierColor(tile.look.tier) : surface.ink.hex;
  b.text(
    ribbon.x + ribbon.width / 2,
    ribbon.y + ribbon.height / 2,
    tile.ribbon.toUpperCase(),
    { ...typeRole.label, size: 11 },
    {
      size: 11,
      color,
      alpha: won || played ? 1 : 0.7,
      origin: [0.5, 0.5],
      fitWidth: ribbon.width - 6,
    },
  );
  creditedName(b, tile.name, box.x + 3, ribbon.y + ribbon.height + 3, box.width - 6, typeRole.body, {
    size: 11,
    color: surface.ink.hex,
    maxLines: 2,
    wrap: true,
    center: true,
  });
  // A dashed edge would be drawn segment by segment for nothing: an unplayed tile just has no ink edge.
  if (won || played) b.box(box, { stroke: surface.ink.hex, strokeWidth: 2 });
}
