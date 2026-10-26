/**
 * The card pictures beside a Briefing "Your call" option (`view/campaign-briefing-model.ts`'s `PickCard`): a small
 * scan with a magnifier badge that opens the card in Inspect, and the few words that say what the card is to the
 * option. Plain drawing; the scene owns the Inspect launch and redraws when a scan arrives.
 */
import Phaser from "phaser";
import { artFor } from "../../art/art-source.js";
import { cardArt, drawArt } from "../../art/card-art.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import { ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers } from "../../ui/campaign-chrome.js";
import { onTap } from "../../ui/tap.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, label } from "../../ui/widgets.js";
import type { PickCard, PickRowLayout } from "../../view/campaign-briefing-model.js";
import type { Rect } from "../../view/layout.js";
import type { FocusStop } from "../focus-route.js";

/** The Inspect affordance on a picture: a small magnifier badge, drawn rather than glyphed so no font is needed. */
export function drawMagnifier(scene: Phaser.Scene, art: Rect, size = 22): Phaser.GameObjects.Graphics {
  const cx = art.x + art.width - size / 2 - 3;
  const cy = art.y + size / 2 + 3;
  const scale = size / 26;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 0.85).fillCircle(cx, cy, size / 2);
  g.lineStyle(2.5 * scale, surface.paper.hex, 1).strokeCircle(cx - 2 * scale, cy - 2 * scale, 5.5 * scale);
  g.lineBetween(cx + 2 * scale, cy + 2 * scale, cx + 7 * scale, cy + 7 * scale);
  return g;
}

/**
 * One card as a tappable picture at `art`: the scan (or a parchment frame with the name while it loads or when
 * there is none), an ink frame, and the magnifier. A tap or the stop's activation calls `inspect`.
 */
export function drawPickCardArt(
  scene: Phaser.Scene,
  art: Rect,
  card: PickCard,
  stopKey: string,
  stops: Map<string, FocusStop>,
  inspect: (card: PickCard) => void,
): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
  const source = artFor(CARDS_BY_ID.get(card.cardId as string), { kind: "front" });
  const key = cardArt(scene).request(scene, source);
  if (!drawArt(scene, key, art, { fit: "cover" })) {
    scene.add
      .text(art.x + art.width / 2, art.y + art.height / 2, card.name, {
        ...textStyle(typeRole.label, surface.ink.hex, ink.secondary),
        fontSize: "9px",
        align: "center",
      })
      .setOrigin(0.5)
      .setWordWrapWidth(art.width - 8);
  }
  scene.add
    .graphics()
    .lineStyle(2, surface.ink.hex, 1)
    .strokeRect(art.x + 1, art.y + 1, art.width - 2, art.height - 2);
  drawMagnifier(scene, art, 18);
  const open = (): void => inspect(card);
  const zone = scene.add
    .zone(art.x, art.y, art.width, art.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  onTap(zone, open, `pick-card:${stopKey}`);
  stops.set(stopKey, { rect: art, activate: open, inspect: open });
}

/** A caption's tone: the earned side reads green, as on the campaign sheet; the rest are quiet labels. */
const captionColor = (card: PickCard): { readonly hex: number; readonly alpha: number } =>
  card.key === "environment" ? { hex: signal.heal.hex, alpha: 1 } : { hex: surface.ink.hex, alpha: ink.label };

/**
 * A pick row's pictures and captions at (`x`, `y`), by `layout`. On a wide row the card's name sits beside its
 * picture in the display face; on a stacked row it is one small line under it.
 */
export function drawPickCards(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cards: readonly PickCard[],
  layout: PickRowLayout,
  keyBase: string,
  stops: Map<string, FocusStop>,
  inspect: (card: PickCard) => void,
): void {
  cards.forEach((card, index) => {
    const cell = layout.cards[index];
    if (!cell) return;
    const art: Rect = { ...cell.art, x: x + cell.art.x, y: y + cell.art.y };
    drawPickCardArt(scene, art, card, `${keyBase}:${card.key}`, stops, inspect);
    const tone = captionColor(card);
    const cx = x + cell.caption.x;
    const cy = y + cell.caption.y;
    if (layout.wide) {
      const word = label(scene, cx, cy + 4, card.caption, { ...typeRole.label, size: 10 }, tone.hex, tone.alpha);
      const name = scene.add
        .text(cx, cy + 4 + word.height + 2, card.name.toUpperCase(), textStyle(bangers(18), surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(cell.caption.width);
      // Two lines at most: a longer name shrinks rather than running under the row.
      for (let size = 17; name.height > cell.caption.height - word.height - 8 && size >= 12; size--) {
        name.setFontSize(size);
      }
    } else {
      const word = label(scene, cx, cy, card.caption, { ...typeRole.label, size: 9 }, tone.hex, tone.alpha);
      const name = scene.add
        .text(cx, cy + word.height + 1, card.name, textStyle({ ...typeRole.rowTitle, size: 11 }, surface.ink.hex))
        .setOrigin(0, 0);
      fitText(name, cell.caption.width, 11);
    }
  });
}
