/**
 * The mini identity panel of the tall villain band's player row (TB1, `BoardLayout.compactPlayerRow`): a thumbnail,
 * the hero's name, the villain phase's status tag (DEFENDING) and the HP bar with the projected range. The full panel's
 * numbers, attachments and rules text are one tap away (the whole panel is the card's tap target).
 */
import { drawArt } from "../../art/card-art.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, hatchRect, paintPanel } from "../../ui/widgets.js";
import type { CharacterPanel } from "../../view/board-model.js";
import { CARD_ASPECT, type Rect } from "../../view/layout.js";
import { hpProjectionText, type VillainSeatNote } from "../../view/villain-seat-note.js";
import type { BoardDrawContext } from "./context.js";

export function drawCompactIdentity(
  ctx: BoardDrawContext,
  rect: Rect,
  panel: CharacterPanel,
  note: VillainSeatNote | null,
): void {
  const { scene, controller } = ctx;
  ctx.frame.hitRects.set(panel.instanceId, rect);
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", "rest");
  // The defending seat is the one the phase is about: a hero-red frame, over the plain one.
  if (note) g.lineStyle(3, accent.heroRed.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

  const thumb: Rect = {
    x: rect.x + 6,
    y: rect.y + 5,
    width: Math.round((rect.height - 10) * CARD_ASPECT),
    height: rect.height - 10,
  };
  g.fillStyle(surface.parchment.hex, 1).fillRect(thumb.x, thumb.y, thumb.width, thumb.height);
  drawArt(scene, ctx.art.request(scene, panel.art), thumb, { fit: "contain", alpha: 1 });
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(thumb.x, thumb.y, thumb.width, thumb.height);

  const left = thumb.x + thumb.width + 10;
  const right = rect.x + rect.width - 8;
  const nameRow = rect.y + Math.round(rect.height * 0.3);
  let nameRight = right;
  if (note) {
    const tag = scene.add
      .text(0, 0, note.tag, textStyle({ ...typeRole.label, size: 11 }, surface.paper.hex))
      .setOrigin(0, 0.5);
    const w = Math.min(tag.width + 14, Math.max(0, right - left) * 0.5);
    fitText(tag, w - 10, 11);
    tag.setPosition(right - w + 7, nameRow);
    g.fillStyle(surface.ink.hex, 1).fillRect(right - w, nameRow - 10, w, 20);
    nameRight = right - w - 6;
  }
  const name = scene.add
    .text(left, nameRow, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex))
    .setOrigin(0, 0.5);
  fitText(name, Math.max(30, nameRight - left), typeRole.rowTitle.size);

  if (panel.hp) {
    const barY = rect.y + Math.round(rect.height * 0.62);
    const barHeight = 10;
    const text = scene.add
      .text(
        right,
        barY + barHeight / 2,
        hpProjectionText(panel.hp, note),
        textStyle(typeRole.statSmall, surface.ink.hex),
      )
      .setOrigin(1, 0.5);
    const barWidth = Math.max(30, text.x - text.width - 8 - left);
    if (text.x - text.width - 8 - left < 30) fitText(text, Math.max(20, right - left - 38), typeRole.statSmall.size);
    const bar: Rect = { x: left, y: barY, width: barWidth, height: barHeight };
    const ratio = Math.max(0, Math.min(1, panel.hp.current / Math.max(1, panel.hp.max)));
    g.fillStyle(surface.parchment.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
    g.fillStyle(signal.heal.hex, 1).fillRect(bar.x, bar.y, Math.round(bar.width * ratio), bar.height);
    const low = note?.hpAfter?.low;
    if (low !== undefined && low < panel.hp.current) {
      // The part the attack might take: hatched in the hero red, so it reads without the colour.
      const from = Math.round(bar.width * (Math.max(0, low) / Math.max(1, panel.hp.max)));
      const to = Math.round(bar.width * ratio);
      hatchRect(g, { x: bar.x + from, y: bar.y, width: to - from, height: bar.height }, accent.heroRed.hex, 1, 5, 2);
    }
    g.lineStyle(2, surface.ink.hex, ink.body).strokeRect(bar.x, bar.y, bar.width, bar.height);
  }
  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
}
