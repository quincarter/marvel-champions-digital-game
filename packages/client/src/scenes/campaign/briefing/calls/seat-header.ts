/** The seat's hero above its prompt: the roster's own portrait (`art/heroes`), "SEAT 1 · COLOSSUS" and the deck's aspect chips. */
import { artLanguageNow } from "../../../../art/art-source.js";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import { CHIP_HEIGHT, drawChipRun } from "../../../../dom/aspect-chips.js";
import { heroPictureOf } from "../../../../dom/hero-picture.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { surface } from "../../../../tokens.js";
import { bangers } from "../../../../ui/campaign-chrome.js";
import { aspectStampOf } from "../../../../view/aspect-stamp.js";
import type { SeatHeaderView } from "../../../../view/campaign-role-call-model.js";
import type { BriefingCtx, Column } from "../context.js";

/** Draws the header at (`col.x`, `top`) and returns the y under it. */
export function drawSeatHeader(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  top: number,
  header: SeatHeaderView,
): number {
  const size = col.phone ? 56 : 64;
  const portrait = { x: col.x, y: top, width: size, height: size };
  b.box(portrait, { fill: surface.ink.hex });
  const hero = heroPictureOf(campaignCardsById().get(header.identityCardId as string), ctx.leases);
  if (hero.src) {
    b.image(portrait, {
      src: hero.src,
      cover: hero.cover,
      key: "seat-portrait",
      ...(hero.retry !== undefined ? { retry: hero.retry } : {}),
    });
  }
  b.box(portrait, { stroke: surface.ink.hex, strokeWidth: 3 });
  const textX = col.x + size + 14;
  const title = t("briefing.call.seatTitle", { number: header.seatNumber, hero: header.heroName }).toLocaleUpperCase();
  const stamps = header.deckAspects.map((stamp) => aspectStampOf(stamp.aspect, artLanguageNow()));
  const nameSize = col.phone ? 22 : 26;
  const room = col.width - size - 14;
  if (stamps.length === 0) {
    b.text(textX, top + size / 2, title, bangers(nameSize), {
      color: surface.ink.hex,
      origin: [0, 0.5],
      fitWidth: room,
    });
  } else {
    // The deck's aspect stamps sit under the name, the same chips the role tiles wear.
    const nameY = top + size / 2 - (CHIP_HEIGHT + 6) / 2;
    b.text(textX, nameY, title, bangers(nameSize), { color: surface.ink.hex, origin: [0, 0.5], fitWidth: room });
    drawChipRun(b, textX, nameY + nameSize / 2 + 6, stamps);
  }
  return top + size + 12;
}
