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

import type { ArtSource } from "../../art/art-source.js";
import { CARD_BACKS } from "../../art/art-source.js";
import { drawArt } from "../../art/card-art.js";
import { ink, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import type { HandRowLayout } from "../../view/hand-row.js";
import type { Rect } from "../../view/layout.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { addTapTarget } from "./tap-target.js";

/**
 * Draws both piles. `backing` is ink painted behind the pile column first, so a
 * scrolled hand slides under the piles instead of across them.
 */
export function drawMyPiles(ctx: BoardDrawContext, row: HandRowLayout, model: BoardModel, backing: Rect | null): void {
  const { scene } = ctx;
  if (backing) {
    const g = scene.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(backing.x, backing.y, backing.width, backing.height);
  }
  const narrow = row.deck.width < 64;
  drawPile(ctx, row.deck, "deck", model.myPiles.deck, CARD_BACKS.player);
  drawPile(ctx, row.discard, narrow ? "disc." : "discard", model.myPiles.discard, model.myDiscardTop);

  ctx.frame.pileRects.set(pileKey("deck", model.perspectiveId), row.deck);
  ctx.frame.pileRects.set(pileKey("discard", model.perspectiveId), row.discard);

  const top = model.myDiscard[0];
  if (top) {
    const open = (): void => ctx.inspect(top, model.myDiscard);
    addTapTarget(scene, row.discard, { onTap: open, onInspect: open });
  }
}

function drawPile(ctx: BoardDrawContext, box: Rect, name: string, count: number, art: ArtSource | null): void {
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

  const title = label(scene, box.x + box.width / 2, box.y + 5, name, typeRole.label, color, count === 0 ? ink.meta : 1).setOrigin(0.5, 0);
  if (drawn) title.setPadding(3, 1, 3, 1).setBackgroundColor(cssOf(surface.ink.hex, 0.8));
  fitText(title, box.width - 6, typeRole.label.size);

  const chipHeight = Math.min(22, Math.max(16, Math.round(box.height * 0.22)));
  const chip: Rect = { x: box.x + 3, y: box.y + box.height - 3 - chipHeight, width: box.width - 6, height: chipHeight };
  if (drawn) {
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 0.8).fillRect(chip.x, chip.y, chip.width, chip.height);
  }
  const number = scene.add
    .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(count), textStyle(chipHeight < 20 ? typeRole.statSmall : typeRole.stat, color, count === 0 ? ink.meta : 1))
    .setOrigin(0.5);
  fitText(number, chip.width - 4, chipHeight < 20 ? typeRole.statSmall.size : typeRole.stat.size);
}
