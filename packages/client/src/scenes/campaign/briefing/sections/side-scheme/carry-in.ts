/**
 * One fact the side-scheme section carries in from the campaign log: its few words, a detail line and each card it names as an
 * Inspect chip (a repeat reads "×2"). Framed, with no fill, so the page shows through.
 */
import { hit, ink, surface, typeRole } from "../../../../../tokens.js";
import type { SchemeCardRef } from "../../../../../view/campaign-side-scheme-model.js";
import { drawInspectChip } from "../parts/inspect-chip.js";
import { sectionTextIn } from "../section-text.js";
import type { CarryInInput, SideSchemeEvents } from "./side-scheme.types.js";

const PAD = 12;
const CHIP_GAP = 6;

/** Each distinct card once, in the order named, with how many times. */
function countedOf(cards: readonly SchemeCardRef[]): readonly { card: SchemeCardRef; count: number }[] {
  const counts = new Map<string, { card: SchemeCardRef; count: number }>();
  for (const card of cards) {
    const seen = counts.get(card.cardId as string);
    if (seen) seen.count += 1;
    else counts.set(card.cardId as string, { card, count: 1 });
  }
  return [...counts.values()];
}

/** Draws the fact from `top`; returns its bottom. */
export function drawCarryIn({ ctx, b, col, top, carry }: CarryInInput, events: SideSchemeEvents): number {
  const text = sectionTextIn();
  const inner = col.width - PAD * 2;
  const title = b.text(col.x + PAD, top + 8, text.carryTitle(carry.title), typeRole.rowTitle, {
    size: 14,
    color: surface.ink.hex,
    wrapWidth: inner,
  });
  let y = top + 8 + title.height;
  if (carry.detail) {
    y +=
      2 +
      b.text(col.x + PAD, y + 2, text.carryDetail(carry.detail), typeRole.body, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: inner,
      }).height;
  }
  y += 6;
  const counted = countedOf(carry.cards);
  if (counted.length > 0) {
    const chipWidth = Math.min(160, inner);
    const perLine = Math.max(1, Math.floor((inner + CHIP_GAP) / (chipWidth + CHIP_GAP)));
    counted.forEach(({ card, count }, index) => {
      const rect = {
        x: col.x + PAD + (index % perLine) * (chipWidth + CHIP_GAP),
        y: y + Math.floor(index / perLine) * (hit.target + CHIP_GAP),
        width: chipWidth,
        height: hit.target,
      };
      const open = (): void => events.inspect(card);
      drawInspectChip(
        ctx,
        b,
        col,
        rect,
        count > 1 ? `${card.name} ×${count}` : card.name,
        `carry:${carry.key}:${card.cardId as string}`,
        open,
      );
    });
    y += Math.ceil(counted.length / perLine) * (hit.target + CHIP_GAP);
  }
  y += 6;
  b.box({ x: col.x, y: top, width: col.width, height: y - top }, { stroke: surface.ink.hex, strokeWidth: 2 });
  return y;
}
