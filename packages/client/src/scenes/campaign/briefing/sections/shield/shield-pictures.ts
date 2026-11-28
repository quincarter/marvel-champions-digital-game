/**
 * A wrapped row of card pictures with a few words under each (the evidence the players hold, the Executive Board). Every
 * picture opens Inspect and is its own focus stop, and on desktop opens the card hover popover; the words are text, never
 * colour alone ("3 secrets", "ATTACHMENT"). A single long word steps its type down until it fits under its picture rather than
 * being cut with an ellipsis.
 */
import { ink, surface, typeRole } from "../../../../../tokens.js";
import type { Rect } from "../../../../../view/layout.js";
import { drawPickArt } from "../../calls/pick-art.js";
import type { ShieldEvents, ShieldPicturesInput } from "./shield.types.js";

const GAP = 8;
const CAPTION_ROOM = 34;

/** Draws the pictures from `top`; returns the bottom. */
export function drawShieldPictures(input: ShieldPicturesInput, events: ShieldEvents): number {
  const { ctx, b, col, top, cards, keyBase } = input;
  const width = col.phone ? 78 : 104;
  const height = Math.round(width * 1.4);
  const perRow = Math.max(1, Math.floor((col.width + GAP) / (width + GAP)));
  let bottom = top;
  cards.forEach((card, index) => {
    const x = col.x + (index % perRow) * (width + GAP);
    const y = top + Math.floor(index / perRow) * (height + CAPTION_ROOM + GAP);
    const art: Rect = { x, y, width, height };
    drawPickArt(ctx, b, col, art, card, `${keyBase}-${index}`, {
      onInspect: (open) => events.inspect({ cardId: open.cardId, name: open.name }),
    });
    const caption = b.text(x, y + height + 3, card.caption.toLocaleUpperCase(), typeRole.label, {
      size: 10,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: width,
      fitWidth: width,
    });
    bottom = Math.max(bottom, y + height + 3 + caption.height);
  });
  return bottom;
}
