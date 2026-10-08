/**
 * Your own deck and discard, drawn as the piles they are.
 *
 * They were a count in the hand's caption ("deck 28 · discard 3"), which left a
 * drawn card nowhere to fly from and a discarded one nowhere to land — both just
 * appeared (`view/travel.ts`). Each pile now registers its rect in the frame's
 * `pileRects`, which is what `motion.ts#pileAnchor` resolves a deck or discard
 * move to.
 *
 * The deck shows the player card back: it is a facedown stack, and its count is
 * all anyone may know about it. The discard is open information, so it shows its
 * top card faceup, and a tap opens that card with ◂ ▸ through the rest of the pile.
 */

import type { ResourceIconType } from "@mc/content";
import type { ArtSource } from "../../art/art-source.js";
import { CARD_BACKS } from "../../art/art-source.js";
import { drawArt } from "../../art/card-art.js";
import { ink, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel, DeckTopView } from "../../view/board-model.js";
import type { HandRowLayout } from "../../view/hand-row.js";
import type { Rect } from "../../view/layout.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { addTapTarget } from "./tap-target.js";

/** Draws both piles. */
export function drawMyPiles(ctx: BoardDrawContext, row: HandRowLayout, model: BoardModel): void {
  const { scene } = ctx;
  const narrow = row.deck.width < 64;
  const shown = model.myDeckTop;
  if (shown) drawDeckTop(ctx, row.deck, model.myPiles.deck, shown, narrow);
  else drawPile(ctx, row.deck, "deck", model.myPiles.deck, CARD_BACKS.player);
  drawPile(ctx, row.discard, narrow ? "disc." : "discard", model.myPiles.discard, model.myDiscardTop);

  ctx.frame.pileRects.set(pileKey("deck", model.perspectiveId), row.deck);
  ctx.frame.pileRects.set(pileKey("discard", model.perspectiveId), row.discard);

  const top = model.myDiscard[0];
  if (top) {
    const open = (): void => ctx.inspect(top, model.myDiscard);
    addTapTarget(scene, row.discard, { onTap: open, onInspect: open });
  }
}

/** The type of a resource as a word and a glyph, so a 12px icon on a scan never carries the type by color alone. */
const ICON_WORD: Readonly<Record<ResourceIconType, { readonly word: string; readonly glyph: string }>> = {
  physical: { word: "physical", glyph: "P" },
  mental: { word: "mental", glyph: "M" },
  energy: { word: "energy", glyph: "E" },
  wild: { word: "wild", glyph: "*" },
};

/**
 * The deck while the engine shows its top card (Magik, 45030a): the stack with that card's face, labeled "top card",
 * the count kept, and the card's resource icons spelled out in words (her upgrades and spells read them). Tapping plays
 * it as a hand card is played when the engine says it can be; otherwise it opens Inspect, which carries the reason.
 */
function drawDeckTop(ctx: BoardDrawContext, box: Rect, count: number, shown: DeckTopView, narrow: boolean): void {
  const { scene } = ctx;
  const { card } = shown;
  drawPile(ctx, box, narrow ? "top" : "top card", count, card.art);

  const icons = card.resourceIcons.map((icon) => (narrow ? ICON_WORD[icon].glyph : ICON_WORD[icon].word));
  const band = 16;
  const chipHeight = Math.min(22, Math.max(16, Math.round(box.height * 0.22)));
  let bottom = box.y + box.height - 3 - chipHeight;
  const strip = (text: string, ground: number, fg: number, y: number): void => {
    const g = scene.add.graphics();
    g.fillStyle(ground, 0.92).fillRect(box.x + 3, y, box.width - 6, band);
    fitText(
      label(scene, box.x + box.width / 2, y + band / 2, text.toUpperCase(), typeRole.label, fg, 1).setOrigin(0.5),
      box.width - 10,
      typeRole.label.size,
    );
  };
  if (icons.length > 0) {
    bottom -= band;
    strip(icons.join(" "), surface.ink.hex, surface.paper.hex, bottom);
  }
  // What the engine charges from the top, in numbers: "1→0" in the heal green, or the reason in two words.
  if (shown.playable) {
    const price = card.currentCost === null ? "play" : `play ${card.currentCost}`;
    bottom -= band;
    strip(price, signal.heal.hex, surface.paper.hex, bottom);
  } else if (shown.tag) {
    bottom -= band;
    strip(shown.tag, surface.ink.hex, signal.caution.hex, bottom);
  }

  const id = card.instanceId;
  ctx.frame.hitRects.set(id, box);
  const open = (): void => ctx.inspect(id, [id]);
  ctx.makeTapTarget(box, id, shown.playable ? () => ctx.controller.tapHandCard(id) : open);
}

/**
 * One pile box: a facedown stack (no `art`, or a card back) or a faceup top
 * card, a name label, and a count chip. Shared with `zones.ts`'s separate-deck
 * piles (Doctor Strange's Invocation deck), which are drawn the same way —
 * a stack with a count, whether its top card happens to be visible or not.
 */
export function drawPile(ctx: BoardDrawContext, box: Rect, name: string, count: number, art: ArtSource | null): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  if (count === 0) {
    // An empty pile keeps its place, as a faint outline on the ink ground.
    g.lineStyle(2, surface.paper.hex, 0.3).strokeRect(box.x, box.y, box.width, box.height);
  } else {
    paintPanel(g, box, "card", "rest");
  }

  const inner: Rect = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
  const drawn = count > 0 && drawArt(scene, ctx.art.request(scene, art), inner, { fit: "cover" }) !== null;
  // Paper on the ink ground or over art (on an ink chip); ink on the paper frame a missing scan leaves.
  const onPaper = count > 0 && !drawn;
  const color = onPaper ? surface.ink.hex : surface.paper.hex;

  // A card-sized pile (the hand row's) has room for a name bigger than the 9px caption size.
  const nameRole = box.height >= 90 && box.width >= 64 ? { ...typeRole.label, size: 11 } : typeRole.label;
  const title = label(
    scene,
    box.x + box.width / 2,
    box.y + 6,
    name,
    nameRole,
    color,
    count === 0 ? ink.meta : 1,
  ).setOrigin(0.5, 0);
  if (drawn) title.setPadding(4, 2, 4, 2).setBackgroundColor(cssOf(surface.ink.hex, 0.85));
  fitText(title, box.width - 8, nameRole.size);

  const chipHeight = Math.min(22, Math.max(16, Math.round(box.height * 0.22)));
  const chip: Rect = { x: box.x + 3, y: box.y + box.height - 3 - chipHeight, width: box.width - 6, height: chipHeight };
  if (drawn) {
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 0.8).fillRect(chip.x, chip.y, chip.width, chip.height);
  }
  const number = scene.add
    .text(
      chip.x + chip.width / 2,
      chip.y + chip.height / 2,
      String(count),
      textStyle(chipHeight < 20 ? typeRole.statSmall : typeRole.stat, color, count === 0 ? ink.meta : 1),
    )
    .setOrigin(0.5);
  fitText(number, chip.width - 4, chipHeight < 20 ? typeRole.statSmall.size : typeRole.stat.size);
}
