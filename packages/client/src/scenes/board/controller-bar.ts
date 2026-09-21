/**
 * The controller picker that sits over the hand while a "play under any
 * player's control" card waits for a seat (Heroic Intuition, Tenacity, …).
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";
import type { ControllerChoiceView, PlayConfirmationView } from "./controller.js";

/**
 * Framed exactly like the payment bar — Hero Red, over the hand — because it is
 * the same kind of moment: a card is half-played and waiting on one more pick.
 * One button per seat the engine allows, named "Hero / Alter-ego", then Cancel.
 */
export function drawControllerBar(ctx: BoardDrawContext, rect: Rect, choice: ControllerChoiceView): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  const titleWidth = Math.min(280, rect.width * 0.3);
  const title = scene.add
    .text(
      rect.x + 12,
      rect.y + rect.height / 2,
      `Play ${choice.subject} under`,
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, titleWidth - 16, typeRole.barTitle.size);

  const cancelWidth = Math.max(64, Math.min(110, rect.width * 0.12));
  const gap = 6;
  const left = rect.x + titleWidth;
  const right = rect.x + rect.width - cancelWidth - 10 - gap;
  const count = Math.max(1, choice.options.length);
  const width = Math.max(48, (right - left - gap * (count - 1)) / count);

  choice.options.forEach((option, index) => {
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: option.label,
        type: typeRole.label,
        rect: { x: left + index * (width + gap), y: rect.y + 4, width, height: rect.height - 8 },
        onClick: () => void controller.chooseController(option.playerId),
      }),
    );
  });
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: { x: rect.x + rect.width - cancelWidth - 10, y: rect.y + 4, width: cancelWidth, height: rect.height - 8 },
      onClick: () => controller.cancel(),
    }),
  );
}

/**
 * "Play Spiritual Meditation? — Play it / Decline", over the hand, for a card that costs nothing.
 *
 * The same red bar as payment and the controller picker, for the same reason: a card is half-played and waiting on
 * one more answer. A free card used to skip this entirely — it was the one play with no mode to back out of — so a
 * stray tap resolved it. "Play it" is the bar's one forward action; tapping the card again says the same thing.
 */
export function drawPlayConfirmBar(ctx: BoardDrawContext, rect: Rect, confirmation: PlayConfirmationView): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  const gap = 6;
  const buttonWidth = Math.max(72, Math.min(130, rect.width * 0.24));
  const declineX = rect.x + rect.width - buttonWidth - 10;
  const playX = declineX - gap - buttonWidth;

  const title = scene.add
    .text(
      rect.x + 12,
      rect.y + rect.height / 2,
      `Play ${confirmation.subject}? · Free`,
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, playX - gap - (rect.x + 12), typeRole.barTitle.size);

  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: "Play it",
      type: typeRole.label,
      rect: { x: playX, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
      onClick: () => void controller.confirmPlay(),
    }),
    new McButton(scene, {
      kind: "quiet",
      label: "Decline",
      type: typeRole.label,
      rect: { x: declineX, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
      onClick: () => controller.cancel(),
    }),
  );
}
