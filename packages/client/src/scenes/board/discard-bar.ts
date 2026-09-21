/**
 * The discard-choice bar that sits over the hand while an in-play cost's
 * "discard N cards from your hand" is being paid — Shield Toss (`03006`),
 * the card PLAN.md's Phase 7 bug list names.
 *
 * Mirrors `payment-bar.ts` on purpose: this is the same kind of decision
 * (what to spend), just spending a count of cards instead of a resource
 * pool, so it gets the same "mode over the hand, not a dialog" treatment
 * and the same explicit Confirm rather than committing the instant the
 * count reaches `min` — a card with no printed cap (Shield Toss again: X
 * enemies for X cards discarded) can legitimately want more than the floor.
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton } from "../../ui/widgets.js";
import type { DiscardChoiceView } from "../../view/discard-choice-model.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";

export function drawDiscardBar(ctx: BoardDrawContext, rect: Rect, discard: DiscardChoiceView): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  // "0–6" for Shield Toss's uncapped X, "1" for a fixed count where only *which* card is a decision.
  const range = discard.min === discard.max ? `${discard.min}` : `${discard.min}–${discard.max}`;
  scene.add
    .text(
      rect.x + 12,
      rect.y + rect.height / 2,
      `DISCARDING ${discard.picked.size} (${range})`,
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);

  const buttonWidth = Math.max(64, Math.min(120, rect.width * 0.16));
  const buttonsLeft = rect.x + rect.width - buttonWidth * 2 - 18;

  const headlineLeft = rect.x + 210;
  const headlineRoom = buttonsLeft - headlineLeft - 12;
  if (headlineRoom > 90) {
    scene.add
      .text(
        headlineLeft,
        rect.y + rect.height / 2,
        "Tap cards to choose how many to discard, then Confirm.",
        textStyle(typeRole.emphasis, surface.paper.hex),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(headlineRoom)
      .setMaxLines(1);
  }
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: "Confirm",
      type: typeRole.label,
      rect: { x: buttonsLeft, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
      enabled: discard.command !== null,
      ...(discard.blockedBy ? { reason: discard.blockedBy } : {}),
      onClick: () => void controller.commitDiscardChoice(),
    }),
  );
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: { x: rect.x + rect.width - buttonWidth - 10, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
      onClick: () => controller.cancel(),
    }),
  );
}
