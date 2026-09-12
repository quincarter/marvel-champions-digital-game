/**
 * The payment bar that sits over the hand while a card is being paid for.
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { PaymentView } from "../../view/payment-model.js";
import type { BoardDrawContext } from "./context.js";

/**
 * "PAYING 1 / 3 — Photon Blast → Klaw. Tap cards to spend." on Hero Red, with
 * Pay and Cancel, exactly as `Board - Phone` frames the mode.
 *
 * The mock's bar carries only Cancel, and commits the moment the count fills.
 * This one has an explicit Pay because a payment can legitimately exceed the
 * printed cost — "spend X [energy]" counts every resource beyond the fixed
 * cost, so auto-committing at the first sufficient selection would take that
 * choice away (docs/phase2-core-set.md §3, "Spend X").
 */
export function drawPaymentBar(ctx: BoardDrawContext, rect: Rect, payment: PaymentView): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  scene.add
    .text(rect.x + 12, rect.y + rect.height / 2, `PAYING ${payment.paid} / ${payment.required}`, textStyle(typeRole.barTitle, surface.paper.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);

  const buttonWidth = Math.max(64, Math.min(120, rect.width * 0.16));
  const buttonsLeft = rect.x + rect.width - buttonWidth * 2 - 18;

  // The line of prose is the first thing to go when the bar is narrow: the
  // card being paid for already wears a "paying for" tag, so the sentence is
  // repeating itself, and a sentence running under the Pay button is worse
  // than no sentence.
  const headlineLeft = rect.x + 170;
  const headlineRoom = buttonsLeft - headlineLeft - 12;
  if (headlineRoom > 90) {
    const outstanding = payment.outstanding.length > 0 ? ` Still needs ${payment.outstanding.join(", ")}.` : "";
    scene.add
      .text(headlineLeft, rect.y + rect.height / 2, `${payment.headline}. Tap cards to spend.${outstanding}`, textStyle(typeRole.emphasis, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(headlineRoom)
      .setMaxLines(1);
  }
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: "Pay",
      type: typeRole.label,
      rect: { x: buttonsLeft, y: rect.y + 4, width: buttonWidth, height: rect.height - 8 },
      enabled: payment.command !== null,
      ...(payment.blockedBy ? { reason: payment.blockedBy } : {}),
      onClick: () => void controller.commitPayment(),
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
