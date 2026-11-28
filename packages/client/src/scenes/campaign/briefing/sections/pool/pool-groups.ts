/**
 * The finale's groups of "From the pool" (design tiles 24 and 26): one group per destination. On a phone each is a header bar
 * over the same flat rows every other issue uses; on a wide column the groups are boxed, two to a row, each a header bar (its
 * title and caption) over small picture tiles with the card's name and its ALLY / ENEMY / HELPS / AGAINST word under each.
 */
import { accent, signal, surface, typeRole } from "../../../../../tokens.js";
import { bangers } from "../../../../../ui/campaign-chrome.js";
import type { BriefingPoolGroup, BriefingPoolRow } from "../../../../../view/campaign-pool-model.js";
import { cardOfName } from "../../names.js";
import { drawCardThumb } from "../parts/card-thumb.js";
import { drawKicker } from "../parts/kicker.js";
import { drawPoolRow } from "./pool-row.js";
import type { PoolEvents, PoolGroupsInput } from "./pool.types.js";
import { poolBadgeIn, poolGroupNoteIn, poolGroupTitleIn } from "./pool-text.js";

const TILE = 64;
/** Wider than the picture: a name wraps inside its own column, so neighbours never bleed into each other. */
const TILE_GAP = 18;
const COLUMN_GAP = 24;
const HEADER = 40;
const NAME_SIZE = 11;

/** A phone's stacked groups: a thin header bar, then the flat rows. Returns the bottom. */
export function drawPoolGroupsStacked(input: PoolGroupsInput, events: PoolEvents): number {
  const { b, col, groups } = input;
  let y = input.top;
  for (const group of groups) {
    b.box({ x: col.x, y, width: col.width, height: 22 }, { fill: surface.ink.hex, fillAlpha: 0.08 });
    drawKicker(b, col.x + 8, y + 4, poolGroupTitleIn(group.kind), surface.ink.hex, 10);
    y += 28;
    for (const row of group.rows) y = drawPoolRow({ ...input, top: y, row }, events);
    y += 6;
  }
  return y;
}

function drawTile(
  input: PoolGroupsInput,
  events: PoolEvents,
  row: BriefingPoolRow,
  at: { readonly x: number; readonly y: number },
  nameHeight: number,
): void {
  const { ctx, b, col } = input;
  const tone = row.helps ? signal.heal.hex : accent.heroRed.hex;
  const card = cardOfName(row.name);
  drawCardThumb(
    ctx,
    b,
    col,
    { x: at.x, y: at.y, width: TILE, height: TILE },
    { cardId: card?.id ?? null, name: row.name },
    `pool-card:${row.fieldId}`,
    events.inspect,
  );
  b.box({ x: at.x, y: at.y + TILE, width: TILE, height: 3 }, { fill: tone });
  b.text(at.x, at.y + TILE + 6, row.name.toLocaleUpperCase(), bangers(NAME_SIZE), {
    color: surface.ink.hex,
    wrapWidth: TILE,
  });
  b.text(at.x, at.y + TILE + 8 + nameHeight, poolBadgeIn(row).toLocaleUpperCase(), typeRole.label, {
    size: 9,
    color: tone,
  });
}

function drawGroupBox(
  input: PoolGroupsInput,
  events: PoolEvents,
  group: BriefingPoolGroup,
  at: { readonly x: number; readonly y: number; readonly width: number },
): number {
  const { b } = input;
  b.box({ x: at.x, y: at.y, width: at.width, height: HEADER }, { fill: surface.parchment.hex });
  b.text(at.x + 10, at.y + 4, poolGroupTitleIn(group.kind).toLocaleUpperCase(), typeRole.label, {
    size: 11,
    color: surface.ink.hex,
    alpha: 0.8,
  });
  b.text(at.x + 10, at.y + 20, poolGroupNoteIn(group.kind), typeRole.body, {
    size: 10,
    color: surface.ink.hex,
    alpha: 0.55,
    wrapWidth: at.width - 20,
  });
  // Measured once per group, from its longest name, so every tile reserves the same height and the badge line never guesses.
  const nameHeight = Math.max(
    ...group.rows.map((row) => b.measure(row.name.toLocaleUpperCase(), bangers(NAME_SIZE), { wrapWidth: TILE }).height),
  );
  const rowHeight = TILE + 10 + nameHeight + 16;
  let tileX = at.x + 10;
  let tileY = at.y + HEADER + 10;
  for (const row of group.rows) {
    if (tileX + TILE > at.x + at.width - 10) {
      tileX = at.x + 10;
      tileY += rowHeight;
    }
    drawTile(input, events, row, { x: tileX, y: tileY }, nameHeight);
    tileX += TILE + TILE_GAP;
  }
  const bottom = tileY + rowHeight + 6;
  b.box({ x: at.x, y: at.y, width: at.width, height: bottom - at.y }, { stroke: surface.ink.hex, strokeWidth: 2 });
  return bottom;
}

/** A wide column's grid of boxed groups, two to a row, each column running down on its own. Returns the bottom. */
export function drawPoolGroupsGrid(input: PoolGroupsInput, events: PoolEvents): number {
  const { col, groups } = input;
  const width = (col.width - COLUMN_GAP) / 2;
  let left = input.top;
  let right = input.top;
  groups.forEach((group, index) => {
    const onLeft = index % 2 === 0;
    const x = onLeft ? col.x : col.x + width + COLUMN_GAP;
    const bottom = drawGroupBox(input, events, group, { x, y: onLeft ? left : right, width });
    if (onLeft) left = bottom + 16;
    else right = bottom + 16;
  });
  return Math.max(left, right);
}
