/**
 * The facedown encounter cards dealt to a player and not yet revealed (issue #287): a small pile of encounter card backs
 * tucked in the corner of that player's identity card (or on their team row), with a "×N" chip when there are several.
 * Geometry is `view/dealt-pile.ts`'s; this draws it, registers its rect for the deal flight (`motion.ts#pileAnchor`) and
 * for the hover popover, and makes a tap or hold open the first card's Inspect (which shows a card back, never a face).
 *
 * Drawn after the identity's own tap target so the pile, not the panel under it, takes the pointer.
 */

import type { InstanceId, PlayerId } from "@mc/engine";
import { CARD_BACKS } from "../../art/art-source.js";
import { drawArt } from "../../art/card-art.js";
import { surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText } from "../../ui/widgets.js";
import { dealtChipText, dealtPileParts, type DealtPileKind } from "../../view/dealt-pile.js";
import type { Rect } from "../../view/layout.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { addTapTarget } from "./tap-target.js";

/** The hover key of a player's pile: never an instance id. */
export const facedownHoverKey = (playerId: PlayerId): string => `facedown:${playerId}`;

export function drawDealtPile(
  ctx: BoardDrawContext,
  anchor: Rect,
  kind: DealtPileKind,
  playerId: PlayerId,
  ids: readonly InstanceId[],
  oneLine = false,
): void {
  const parts = ids.length > 0 ? dealtPileParts(anchor, kind, oneLine) : null;
  if (!parts) return;
  const { scene } = ctx;
  const key = ctx.art.request(scene, CARD_BACKS.encounter);
  const drawBack = (rect: Rect): void => {
    const g = scene.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    drawArt(scene, key, rect, { fit: "cover" });
    g.lineStyle(1, surface.paper.hex, 0.9).strokeRect(rect.x - 0.5, rect.y - 0.5, rect.width + 1, rect.height + 1);
  };
  if (ids.length > 1) drawBack(parts.rear);
  drawBack(parts.front);
  const chipText = dealtChipText(ids.length);
  if (chipText) {
    const { chip } = parts;
    const g = scene.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    g.lineStyle(1, surface.paper.hex, 0.9).strokeRect(chip.x + 0.5, chip.y + 0.5, chip.width - 1, chip.height - 1);
    const text = scene.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, chipText, textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(0.5);
    fitText(text, chip.width - 4, typeRole.label.size);
  }
  ctx.frame.pileRects.set(pileKey("dealt", playerId), parts.rect);
  ctx.frame.facedownHovers.push({
    key: facedownHoverKey(playerId),
    rect: parts.rect,
    caption: ctx.dealtCaptionOf(ids),
  });
  const first = ids[0]!;
  const open = (): void => ctx.inspect(first, ids);
  addTapTarget(scene, parts.rect, { onTap: open, onInspect: open });
}
