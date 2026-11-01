/**
 * The Matchups tab's list rows (`view/matchup-grid.ts` lays them out): the Shelves view's villain rows, the Focus view's
 * tiles and side list, and the key every view shares. Each draws at the rect it is given and returns its objects, for
 * `McVirtualList` to hold.
 */
import type Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import type { LegendLayout, MatchupTile, ShelfView, WinTier } from "../view/matchup-grid.js";
import { renderArtThumb } from "../scenes/roster-panel.js";
import { bangers } from "./campaign-chrome.js";
import { textStyle } from "./theme.js";
import { fitText, fitWrapped } from "./widgets.js";

/** Green for Standard and purple for Expert, as the issue asked; a paler green for a Skirmish, shades of red for Heroic. */
export const TIER_COLORS: Readonly<Record<WinTier, number>> = {
  skirmish: 0x9ccc9c,
  standard: 0x2e8b57,
  expert: 0x6b3fa0,
  extreme: 0x1f6fb5,
  heroic1: 0xf08a7c,
  heroic2: 0xe05241,
  heroic3: 0xbf1e2e,
  heroic4: 0x7a0f1c,
};
/** The tiers bright enough to take ink; the rest take paper. Both are tokens no color scheme changes. */
const LIGHT_TIERS: ReadonlySet<WinTier> = new Set(["skirmish", "heroic1", "heroic2"]);
export const onTierColor = (tier: WinTier): number =>
  LIGHT_TIERS.has(tier) ? surface.inkOnHue.hex : surface.paperOnInk.hex;

const LEGEND_SWATCH = 14;
/** A shelf's pips, across and down, on a screen wide enough to show them. */
const PIP = 12;
const PIP_GAP = 3;
const SHELF_PICTURE = 64;
const SHELF_NAMES = 230;
const BADGE_WIDTH = 92;

/** The key: a swatch and a word for each look on show. */
export function drawLegend(
  scene: Phaser.Scene,
  layout: LegendLayout,
  x: number,
  y: number,
): Phaser.GameObjects.GameObject[] {
  const g = scene.add.graphics();
  const objects: Phaser.GameObjects.GameObject[] = [g];
  for (const placed of layout.entries) {
    const left = x + placed.x;
    const top = y + placed.y + 2;
    const { entry } = placed;
    if (entry.kind === "tier")
      g.fillStyle(TIER_COLORS[entry.tier], 1).fillRect(left, top, LEGEND_SWATCH, LEGEND_SWATCH);
    else if (entry.kind === "unplayed")
      g.fillStyle(surface.parchment.hex, 1).fillRect(left, top, LEGEND_SWATCH, LEGEND_SWATCH);
    else g.lineStyle(2, surface.ink.hex, 1).strokeRect(left + 1, top + 1, LEGEND_SWATCH - 2, LEGEND_SWATCH - 2);
    const text = scene.add
      .text(left + LEGEND_SWATCH + 6, top - 1, entry.label, textStyle(typeRole.body, surface.ink.hex, 0.85))
      .setFontSize(12);
    objects.push(text);
  }
  return objects;
}

/** One line of a shelf's stacked bar: each tier's share of the whole axis, the rest left empty. */
function drawShelfBar(g: Phaser.GameObjects.Graphics, shelf: ShelfView, bar: Rect): void {
  g.fillStyle(surface.paper.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
  let x = bar.x;
  for (const part of shelf.bar) {
    const width = (bar.width * part.count) / Math.max(1, shelf.total);
    g.fillStyle(TIER_COLORS[part.tier], 1).fillRect(x, bar.y, width, bar.height);
    x += width;
  }
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(bar.x, bar.y, bar.width, bar.height);
}

/** A villain's shelf: its picture and record, a bar of its wins by tier, and one pip per hero, wins first. */
export function renderShelf(
  scene: Phaser.Scene,
  shelf: ShelfView,
  rect: Rect,
  picture: string | null,
  phone: boolean,
): Phaser.GameObjects.GameObject[] {
  const box: Rect = { x: rect.x, y: rect.y + 3, width: rect.width, height: rect.height - 6 };
  const g = scene.add.graphics();
  g.fillStyle(surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
  const objects: Phaser.GameObjects.GameObject[] = [g];
  const size = phone ? box.height - 12 : SHELF_PICTURE;
  const thumb: Rect = { x: box.x + 6, y: box.y + (box.height - size) / 2, width: size, height: size };
  objects.push(renderArtThumb(scene, thumb, picture));
  const left = thumb.x + size + 10;
  const right = box.x + box.width - 10;
  const name = scene.add
    .text(left, box.y + 8, shelf.name.toUpperCase(), textStyle(bangers(phone ? 18 : 22), surface.ink.hex))
    .setLetterSpacing(0.5);
  fitText(name, (phone ? right - left : SHELF_NAMES) - 4, phone ? 18 : 22);
  const summary = scene.add
    .text(
      left,
      box.y + (phone ? 32 : 38),
      phone ? shelf.short : shelf.summary,
      textStyle(typeRole.body, surface.ink.hex, 0.85),
    )
    .setFontSize(12);
  fitText(summary, (phone ? right - left : SHELF_NAMES) - 4, 12);
  objects.push(name, summary);
  if (phone) {
    drawShelfBar(g, shelf, { x: left, y: box.y + box.height - 18, width: right - left, height: 10 });
    return objects;
  }
  const barLeft = left + SHELF_NAMES;
  const barRight = right - BADGE_WIDTH - 12;
  drawShelfBar(g, shelf, { x: barLeft, y: box.y + 10, width: barRight - barLeft, height: 12 });
  let x = barLeft;
  let y = box.y + 28;
  for (const pip of shelf.pips) {
    if (x + PIP > barRight) {
      x = barLeft;
      y += PIP + PIP_GAP;
    }
    if (y + PIP > box.y + box.height - 2) break;
    if (pip === "unplayed") g.fillStyle(surface.paper.hex, 1).fillRect(x, y, PIP, PIP);
    else if (pip === "played") g.lineStyle(2, surface.ink.hex, 1).strokeRect(x + 1, y + 1, PIP - 2, PIP - 2);
    else g.fillStyle(TIER_COLORS[pip], 1).fillRect(x, y, PIP, PIP);
    x += PIP + PIP_GAP;
  }
  if (shelf.best) {
    const badge: Rect = { x: right - BADGE_WIDTH, y: box.y + (box.height - 32) / 2, width: BADGE_WIDTH, height: 32 };
    g.fillStyle(TIER_COLORS[shelf.best], 1).fillRect(badge.x, badge.y, badge.width, badge.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(badge.x, badge.y, badge.width, badge.height);
    const word = scene.add
      .text(badge.x + badge.width / 2, badge.y + badge.height / 2, shelf.bestLabel, {
        ...textStyle({ ...typeRole.label, size: 12 }, onTierColor(shelf.best), 1),
      })
      .setOrigin(0.5);
    fitText(word, badge.width - 8, 12);
    objects.push(word);
  }
  return objects;
}

/** A hero's tile in the Focus view: its picture, a ribbon saying what you did, its name. */
export function renderTile(
  scene: Phaser.Scene,
  tile: MatchupTile,
  box: Rect,
  picture: string | null,
  phone: boolean,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics();
  const won = tile.look.kind === "won";
  const played = tile.look.kind === "played";
  g.fillStyle(surface.parchment.hex, 1).fillRect(box.x, box.y, box.width, box.height);
  objects.push(g);
  const ribbonHeight = 20;
  const nameHeight = phone ? 26 : 30;
  const art: Rect = {
    x: box.x + 2,
    y: box.y + 2,
    width: box.width - 4,
    height: box.height - ribbonHeight - nameHeight - 4,
  };
  const thumb = renderArtThumb(scene, art, picture);
  // Pairings not beaten stay in view but stand back, so the wins read first.
  if (!won) (thumb as Phaser.GameObjects.Image).setAlpha(played ? 0.75 : 0.35);
  objects.push(thumb);
  const ribbon: Rect = { x: box.x, y: art.y + art.height, width: box.width, height: ribbonHeight };
  const over = scene.add.graphics();
  objects.push(over);
  if (tile.look.kind === "won")
    over.fillStyle(TIER_COLORS[tile.look.tier], 1).fillRect(ribbon.x, ribbon.y, ribbon.width, ribbon.height);
  else if (played)
    over.lineStyle(2, surface.ink.hex, 1).strokeRect(ribbon.x + 1, ribbon.y + 1, ribbon.width - 2, ribbon.height - 2);
  const color = tile.look.kind === "won" ? onTierColor(tile.look.tier) : surface.ink.hex;
  const word = scene.add
    .text(ribbon.x + ribbon.width / 2, ribbon.y + ribbon.height / 2, tile.ribbon.toUpperCase(), {
      ...textStyle({ ...typeRole.label, size: 11 }, color, won || played ? 1 : 0.7),
    })
    .setOrigin(0.5);
  fitText(word, ribbon.width - 6, 11);
  const name = scene.add
    .text(box.x + box.width / 2, ribbon.y + ribbon.height + 3, tile.name, textStyle(typeRole.body, surface.ink.hex, 1))
    .setOrigin(0.5, 0)
    .setAlign("center")
    .setFontSize(11);
  fitWrapped(name, box.width - 6, 2, 11);
  objects.push(word, name);
  // A dashed edge would be drawn segment by segment for nothing: an unplayed tile just has no ink edge.
  if (won || played)
    over.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
  return objects;
}

/** One row of the Focus view's side list: the name, how many it has beaten, filled while it is the one shown. */
export function renderSideRow(
  scene: Phaser.Scene,
  name: string,
  count: string,
  rect: Rect,
  selected: boolean,
  fill: number,
): Phaser.GameObjects.GameObject[] {
  const box: Rect = { x: rect.x, y: rect.y + 2, width: rect.width - 10, height: rect.height - 4 };
  const fg = selected ? surface.paperOnInk.hex : surface.ink.hex;
  const g = scene.add.graphics();
  g.fillStyle(selected ? fill : surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
  const score = scene.add
    .text(box.x + box.width - 10, box.y + box.height / 2, count, textStyle({ ...typeRole.label, size: 12 }, fg, 1))
    .setOrigin(1, 0.5);
  const label = scene.add
    .text(box.x + 10, box.y + box.height / 2, name, textStyle({ ...typeRole.rowTitle, size: 13 }, fg, 1))
    .setOrigin(0, 0.5);
  fitText(label, box.width - 28 - score.width, 13);
  return [g, score, label];
}
