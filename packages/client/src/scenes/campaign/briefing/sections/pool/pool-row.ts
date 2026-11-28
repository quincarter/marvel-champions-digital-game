/**
 * One flat row of "From the pool": a stripe (green when the card helps, red when it is against the team), the card's picture,
 * its name, where this issue's setup puts it, and a mark at the right. The mark is a check or a cross as well as a colour, so
 * helps and against never read by colour alone.
 */
import { accent, signal, surface, typeRole } from "../../../../../tokens.js";
import { bangers } from "../../../../../ui/campaign-chrome.js";
import { cardOfName } from "../../names.js";
import { drawCardThumb } from "../parts/card-thumb.js";
import { drawFramedRow } from "../parts/kicker.js";
import { sectionTextIn } from "../section-text.js";
import type { PoolEvents, PoolRowInput } from "./pool.types.js";

const THUMB = 44;
const MIN_HEIGHT = 54;
/** The room a row's stripe, gap and picture take on the left, and its mark on the right. */
const LEFT = 6 + 8 + THUMB + 10;
const RIGHT = 36;
const GAP = 10;

/** Draws the row at `col.x` from `top`; returns its bottom with the gap that separates rows. */
export function drawPoolRow({ ctx, b, col, top, row }: PoolRowInput, events: PoolEvents): number {
  const x = col.x;
  const textWidth = col.width - LEFT - RIGHT;
  const destination = sectionTextIn().poolDestination(row.destination);
  const name = b.measure(row.name.toLocaleUpperCase(), bangers(15), { fitWidth: textWidth });
  const detail = b.measure(destination, typeRole.body, { size: 11, wrapWidth: textWidth });
  const height = Math.max(MIN_HEIGHT, 8 + name.height + 4 + detail.height + 8);
  const tone = row.helps ? signal.heal.hex : accent.heroRed.hex;
  drawFramedRow(b, { x, y: top, width: col.width, height }, { stripe: tone });
  const card = cardOfName(row.name);
  drawCardThumb(
    ctx,
    b,
    col,
    { x: x + 6 + 8, y: top + (height - THUMB) / 2, width: THUMB, height: THUMB },
    { cardId: card?.id ?? null, name: row.name },
    `pool-card:${row.fieldId}`,
    events.inspect,
  );
  b.text(x + LEFT, top + 8, row.name.toLocaleUpperCase(), bangers(15), { color: surface.ink.hex, fitWidth: textWidth });
  b.text(x + LEFT, top + 8 + name.height + 4, destination, typeRole.body, {
    size: 11,
    color: surface.ink.hex,
    alpha: 0.7,
    wrapWidth: textWidth,
  });
  b.text(x + col.width - 24, top + height / 2, row.helps ? "✓" : "✗", typeRole.rowTitle, {
    size: 16,
    color: tone,
    origin: [0.5, 0.5],
  });
  return top + height + GAP;
}
