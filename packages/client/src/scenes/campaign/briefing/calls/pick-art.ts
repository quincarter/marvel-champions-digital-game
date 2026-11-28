/**
 * One card as a picture a call shows: the scan (a parchment frame with its name while it loads or when there is none), an ink
 * frame and a magnifier badge. A press or a hold on it opens the card in Inspect and answers nothing, so reading a card can
 * never record the choice; on desktop it opens the card hover popover. Role-building's list, the side-scheme rows and a
 * card-option cell all draw their pictures through this.
 */
import { artFor } from "../../../../art/art-source.js";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { ink, signal, surface, typeRole } from "../../../../tokens.js";
import { bangers } from "../../../../ui/campaign-chrome.js";
import type { PickCard, PickRowLayout } from "../../../../view/campaign-briefing-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { BriefingCtx, Column } from "../context.js";
import type { PickArtCard } from "./calls.types.js";

/** The Inspect badge: a ring and a handle on the picture's top right, drawn so no font is needed. */
export function drawMagnifier(b: SheetBuilder, art: Rect, size = 22): void {
  const cx = art.x + art.width - size / 2 - 3;
  const cy = art.y + size / 2 + 3;
  const k = size / 26;
  b.box(
    { x: cx - size / 2, y: cy - size / 2, width: size, height: size },
    { fill: surface.ink.hex, alpha: 0.85, round: true },
  );
  const ring = 11 * k;
  b.box(
    { x: cx - 2 * k - ring / 2, y: cy - 2 * k - ring / 2, width: ring, height: ring },
    { stroke: surface.paper.hex, strokeWidth: 2.5 * k, round: true },
  );
  b.poly(
    [
      [cx + 2 * k, cy + 2 * k],
      [cx + 7 * k, cy + 7 * k],
    ],
    { stroke: surface.paper.hex, strokeWidth: 2.5 * k },
  );
}

/**
 * Draws `card` in `art` and wires its press (stop `key`, with Inspect on the stop and on a hold). `badge` is the magnifier's
 * size (0 for none). `onInspect` opens the card, by default in a plain Inspect.
 */
export function drawPickArt(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  art: Rect,
  card: PickArtCard,
  key: string,
  options: { readonly badge?: number; readonly onInspect?: (card: PickArtCard) => void } = {},
): void {
  const source = artFor(campaignCardsById().get(card.cardId as string), { kind: "front" });
  const held = ctx.leases.image(source);
  b.box(art, { fill: surface.parchment.hex });
  b.image(art, {
    src: held.src,
    fill: surface.parchment.hex,
    missing: card.name,
    color: surface.ink.hex,
    key: `art:${key}`,
    ...(held.retry !== undefined ? { retry: held.retry } : {}),
  });
  b.box(
    { x: art.x + 1, y: art.y + 1, width: art.width - 2, height: art.height - 2 },
    { stroke: surface.ink.hex, strokeWidth: 2 },
  );
  const badge = options.badge ?? 18;
  if (badge > 0) drawMagnifier(b, art, badge);
  b.tap(key, art, { inspect: true });
  registerPickStop(ctx, col, art, card, key, options.onInspect);
  col.hover(`pick:${key}`, card.cardId as string, art);
}

/**
 * A picture's press without its parts: the stop (so a pad can walk to it and scroll it into view) and its hold. A windowed list
 * does this for the rows it does not draw, so the route still reaches every card.
 */
export function registerPickStop(
  ctx: BriefingCtx,
  col: Column,
  art: Rect,
  card: PickArtCard,
  key: string,
  onInspect?: (card: PickArtCard) => void,
): void {
  const open = (): void => (onInspect ?? ((c) => ctx.inspectCard(c.cardId as string)))(card);
  ctx.inspects.set(key, open);
  col.control(key, art, open, { inspect: open });
}

/** A caption's tone: the earned side reads green, as on the campaign sheet; the rest are quiet labels. */
const captionTone = (card: PickCard): { readonly color: number; readonly alpha: number } =>
  card.key === "environment" ? { color: signal.heal.hex, alpha: 1 } : { color: surface.ink.hex, alpha: ink.label };

/** What a card is to its option, in the player's language ("Scheme", "Earns", "Brings"); any other caption as given. */
export function pickCaptionIn(card: PickCard): string {
  if (card.key === "scheme") return t("briefing.call.scheme.scheme");
  if (card.key === "environment") return t("briefing.call.scheme.earns");
  if (card.key === "encounter") return t("briefing.call.scheme.brings");
  return card.caption;
}

/**
 * A pick row's pictures and captions at (`x`, `y`), by `layout`. On a wide row the card's name sits beside its picture in the
 * display face; on a stacked row it is one small line under it. Each picture's stop key is `<keyBase>:<card.key>`.
 */
export function drawPickCards(
  ctx: BriefingCtx,
  b: SheetBuilder,
  col: Column,
  at: { readonly x: number; readonly y: number },
  cards: readonly PickCard[],
  layout: PickRowLayout,
  keyBase: string,
): void {
  cards.forEach((card, index) => {
    const cell = layout.cards[index];
    if (!cell) return;
    const art: Rect = { ...cell.art, x: at.x + cell.art.x, y: at.y + cell.art.y };
    drawPickArt(ctx, b, col, art, card, `${keyBase}:${card.key}`);
    const tone = captionTone(card);
    const cx = at.x + cell.caption.x;
    const cy = at.y + cell.caption.y;
    const word = pickCaptionIn(card);
    if (layout.wide) {
      const label = b.text(cx, cy + 4, word.toLocaleUpperCase(), typeRole.label, { size: 10, ...tone });
      b.text(cx, cy + 4 + label.height + 2, card.name.toLocaleUpperCase(), bangers(17), {
        color: surface.ink.hex,
        wrapWidth: cell.caption.width,
        maxLines: 2,
      });
    } else {
      const label = b.text(cx, cy, word.toLocaleUpperCase(), typeRole.label, { size: 9, ...tone });
      b.text(cx, cy + label.height + 1, card.name, typeRole.rowTitle, {
        size: 11,
        color: surface.ink.hex,
        fitWidth: cell.caption.width,
      });
    }
  });
}
