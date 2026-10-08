/**
 * The Briefing's easier-start toggle (Age of Apocalypse issue #3, `view/campaign-easier-start-model.ts`), drawn: a
 * heading and one card that is the whole button, in the style of the setup screen's option card (white ground, a red frame
 * while on, a name and one short line of state). Plain drawing over `EasierStartBriefing`; the scene owns the toggle.
 */
import { accent, ink, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText } from "../../ui/widgets.js";
import type { EasierStartBriefing } from "../../view/campaign-easier-start-model.js";
import type { SideSchemeDrawContext } from "./briefing-side-scheme.js";

/** A full 44px touch target with 8px around the two lines. */
export const EASIER_START_CARD_HEIGHT = 64;

/** Draws the section below `top` and returns its bottom edge. */
export function drawEasierStart(
  ctx: SideSchemeDrawContext,
  top: number,
  brief: EasierStartBriefing,
  toggle: () => void,
): number {
  const { scene, rect, phone } = ctx;
  const y = ruleHeading(scene, rect.x, top, rect.width, "Setup option", surface.ink.hex, 20) + 2;
  const card = { x: rect.x, y, width: rect.width, height: EASIER_START_CARD_HEIGHT };
  // The whole card is the button, made before the frame so its hover ground never covers the border.
  ctx.buttons.push(
    new McButton(scene, { kind: "quiet", label: "", type: typeRole.label, rect: card, onClick: toggle }),
  );
  ctx.stops.set("easier-start", { rect: card, activate: toggle });
  const g = scene.add.graphics();
  g.fillStyle(surface.card.hex, 1).fillRect(card.x, card.y, card.width, card.height);
  if (brief.on)
    g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(card.x + 2, card.y + 2, card.width - 4, card.height - 4);
  else
    g.lineStyle(1.5, surface.ink.hex, ink.disabled).strokeRect(
      card.x + 0.75,
      card.y + 0.75,
      card.width - 1.5,
      card.height - 1.5,
    );
  const size = phone ? 16 : 18;
  const name = scene.add
    .text(
      card.x + 12,
      card.y + 10,
      brief.name.toUpperCase(),
      textStyle(bangers(size), surface.ink.hex, brief.on ? 1 : ink.secondary),
    )
    .setOrigin(0, 0);
  fitText(name, card.width - 24, size);
  scene.add
    .text(
      card.x + 12,
      card.y + 10 + name.height + 4,
      brief.meta,
      textStyle(typeRole.body, surface.ink.hex, brief.on ? ink.secondary : ink.disabled),
    )
    .setOrigin(0, 0);
  return card.y + card.height;
}
