/**
 * The controller picker that sits over the hand while a "play under any
 * player's control" card waits for a seat (Heroic Intuition, Tenacity, …).
 */

import { accent, status, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";
import type { ControllerChoiceView, PlayConfirmationView, SourceChoiceView } from "./controller.js";

/** The source bar is a button row plus one line of consequence under each button. */
export const SOURCE_BAR_NOTE = 18;

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
 * stray tap resolved it. "Play it" is the bar's one forward action; tapping the card again deselects it, the same as Decline.
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

/**
 * "Attack with — Spider-Man · Black Cat — Cancel", over the hand, when more than one character could make the
 * basic attack (or thwart) the player just pressed.
 *
 * Each button names the character and its stat, and the line under it says what going costs: an ally's
 * consequential damage, or — hatched in the status's hue, the way the action bar's own Attack button is — that a
 * stun cancels the attack and only spends itself. Each attack is its own action, so picking one, then pressing
 * Attack again for the next, is choosing the order their effects happen in. The same characters wear the
 * selection ring on the table and a tap on one picks it too.
 */
export function drawSourceBar(ctx: BoardDrawContext, rect: Rect, choice: SourceChoiceView): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  const buttonHeight = rect.height - SOURCE_BAR_NOTE - 8;
  // A phone has no room for the title column, and needs none: the action bar's own Attack button is lit beneath.
  const narrow = rect.width < 640;
  const titleWidth = narrow ? 10 : Math.min(200, rect.width * 0.22);
  if (!narrow) {
    const title = scene.add
      .text(
        rect.x + 12,
        rect.y + 4 + buttonHeight / 2,
        `${choice.power === "attack" ? "Attack" : "Thwart"} with`,
        textStyle(typeRole.barTitle, surface.paper.hex),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(1);
    fitText(title, titleWidth - 16, typeRole.barTitle.size);
  }

  const cancelWidth = Math.max(64, Math.min(110, rect.width * 0.12));
  const gap = 6;
  const left = rect.x + titleWidth;
  const right = rect.x + rect.width - cancelWidth - 10 - gap;
  const count = Math.max(1, choice.sources.length);
  const width = Math.max(48, (right - left - gap * (count - 1)) / count);

  choice.sources.forEach((source, index) => {
    const x = left + index * (width + gap);
    const hatch = source.cancelledBy ? status[source.cancelledBy].hex : undefined;
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: source.name,
        // On a phone the stat moves into the note, or it runs into a centred name.
        ...(narrow ? {} : { value: source.stat }),
        type: typeRole.label,
        rect: { x, y: rect.y + 4, width, height: buttonHeight },
        ...(hatch !== undefined ? { hatch } : {}),
        onClick: () => controller.chooseSource(source.instanceId),
      }),
    );
    const note = scene.add
      .text(
        x + 2,
        rect.y + 4 + buttonHeight + 2,
        narrow ? `${source.stat} · ${source.shortNote}` : source.note,
        textStyle(typeRole.body, surface.paper.hex),
      )
      .setOrigin(0, 0);
    fitText(note, width - 4, typeRole.body.size);
  });
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: { x: rect.x + rect.width - cancelWidth - 10, y: rect.y + 4, width: cancelWidth, height: buttonHeight },
      onClick: () => controller.cancel(),
    }),
  );
}
