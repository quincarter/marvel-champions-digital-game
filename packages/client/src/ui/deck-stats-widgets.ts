/**
 * The pieces of a deck's stats a screen actually draws, factored out once
 * three screens needed them (W1's Deck check and the builder's stats panel,
 * W9's Decks & Collection stats pane, docs/phase4-screen-gaps.md §3) rather
 * than copied a third time. Every number these functions draw is
 * `view/deck-stats.ts`'s own (`CostCurveBar`, `CompositionTile`,
 * `DeckListGroup`) — nothing here computes a stat, only lays it out.
 *
 * **What's shared and what isn't.** The three screens draw a cost-curve chart
 * with different surrounding chrome (Deck check boxes it with a heading
 * inside; the builder just puts a label above it; D14's sidebar sits it on an
 * ink ground) — that chrome is real per-screen design, not accidental
 * duplication, so it stays in each scene. What actually was byte-for-byte
 * duplicated is the bar-drawing math itself (bar width, fill colour, the axis
 * label under each bar) and the tile-row/grouped-list layout math — that's
 * what moved here.
 */
import type Phaser from "phaser";
import type { CompositionTile, CostCurveBar, DeckListEntry, DeckListGroup, PlayerCardType } from "../view/deck-stats.js";
import { CHIP_GAP, wrapChipsToRows } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { fitText, label, paintPanel } from "./widgets.js";
import { textStyle } from "./theme.js";

/**
 * The colored cost badge a card pool/list row draws (the board's own hand and
 * play-area cards, and D04/P04's card rows): a card's printed cost on a
 * hue that reads its broad type at a glance. `resource` is blue (the same
 * hue `signal.cost` already gives every resource pip elsewhere), `event` is
 * Hero Red (most player events on the table are attack actions; the schema
 * has no attack/defense subtype to key a second hue off, so this is a
 * deliberate one-color simplification of the canvases' own richer coding —
 * see the fidelity report), and everything else (ally/upgrade/support/side
 * scheme) is ink, matching the dark badge the board renders draw for those.
 */
export function cardTypeBadgeColor(type: PlayerCardType): number {
  switch (type) {
    case "resource":
      return signal.cost.hex;
    case "event":
      return accent.heroRed.hex;
    default:
      return surface.ink.hex;
  }
}

/**
 * The bars themselves plus their axis labels, inside `rect` (bar area only —
 * no heading, no border; the caller draws those). `onDark` swaps the axis
 * label's ink for the stats pane's dark ground (D14's sidebar).
 */
export function drawCostCurveBars(scene: Phaser.Scene, rect: Rect, bars: readonly CostCurveBar[], onDark = false): void {
  const gap = 6;
  const barWidth = (rect.width - gap * (bars.length - 1)) / bars.length;
  const maxCount = Math.max(1, ...bars.map((bar) => bar.count));
  const axisColor = onDark ? surface.paper.hex : surface.ink.hex;
  bars.forEach((bar, index) => {
    const barHeight = Math.max(2, Math.round((bar.count / maxCount) * (rect.height - 18)));
    const x = rect.x + index * (barWidth + gap);
    const g = scene.add.graphics();
    g.fillStyle(index === bars.length - 1 ? signal.spent.hex : signal.cost.hex, 1);
    g.fillRect(x, rect.y + (rect.height - 18 - barHeight), barWidth, barHeight);
    if (!onDark) g.lineStyle(2, surface.ink.hex, 1).strokeRect(x, rect.y + (rect.height - 18 - barHeight), barWidth, barHeight);
    label(scene, x + barWidth / 2, rect.y + rect.height - 10, bar.label, typeRole.label, axisColor, ink.label).setOrigin(0.5, 0);
  });
}

/** A wrapped row of label+count tiles (composition by type or by aspect) — `wrapChipsToRows` (S8) reused for the wrap math. `onDark` matches `drawCostCurveBars`. */
export function drawCompositionTiles(scene: Phaser.Scene, rect: Rect, tiles: readonly { readonly id: string; readonly text: string }[], onDark = false): number {
  const rows = wrapChipsToRows(tiles, rect.width);
  let y = rect.y;
  for (const row of rows) {
    const cellWidth = (rect.width - (row.length - 1) * CHIP_GAP) / Math.max(1, row.length);
    row.forEach((tile, index) => {
      const tileRect: Rect = { x: rect.x + index * (cellWidth + CHIP_GAP), y, width: cellWidth, height: hit.target };
      const g = scene.add.graphics();
      paintPanel(g, tileRect, onDark ? "onInk" : "card", "rest");
      label(scene, tileRect.x + tileRect.width / 2, tileRect.y + tileRect.height / 2, tile.text, typeRole.rowTitle, onDark ? surface.paper.hex : surface.ink.hex, ink.body).setOrigin(0.5);
    });
    y += hit.target + CHIP_GAP;
  }
  return y;
}

/** `compositionTilesOf`'s tiles, worded as `"<label> <count>"` — the exact text every caller drew inline before this moved here. */
export function compositionTileDefs(tiles: readonly CompositionTile[]): readonly { readonly id: string; readonly text: string }[] {
  return tiles.map((tile) => ({ id: tile.id, text: `${tile.label} ${tile.count}` }));
}

/**
 * The grouped deck list (Hero / aspect / Basic) with a "+ N more" overflow
 * once `entryCap` entry lines have been drawn — the builder's D04 stats
 * panel. Returns the next free `y`.
 */
export function drawGroupedCardList(scene: Phaser.Scene, left: number, top: number, column: number, groups: readonly DeckListGroup[], entryCap: number, onDark = false): number {
  const bodyColor = onDark ? surface.paper.hex : surface.ink.hex;
  let y = top;
  let shown = 0;
  let overflow = 0;
  for (const group of groups) {
    const remainingRoom = entryCap - shown;
    if (remainingRoom <= 0) {
      overflow += group.entries.length;
      continue;
    }
    const visible: readonly DeckListEntry[] = group.entries.slice(0, remainingRoom);
    overflow += group.entries.length - visible.length;
    shown += visible.length;
    if (visible.length === 0) continue;
    label(scene, left, y, `${group.label} · ${group.count}`, typeRole.label, bodyColor, ink.meta);
    y += 14;
    for (const entry of visible) {
      const line = scene.add.text(left, y, entry.name, textStyle(typeRole.body, bodyColor));
      fitText(line, column - 40);
      label(scene, left + column - 4, y, String(entry.quantity), typeRole.label, bodyColor, ink.secondary).setOrigin(1, 0);
      y += 16;
    }
    y += 4;
  }
  if (overflow > 0) {
    scene.add.text(left, y, `+ ${overflow} more`, textStyle(typeRole.body, bodyColor, ink.meta));
    y += 18;
  }
  return y + 8;
}
