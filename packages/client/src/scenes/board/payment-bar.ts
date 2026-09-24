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
    .text(
      rect.x + 12,
      rect.y + rect.height / 2,
      `PAYING ${payment.paid} / ${payment.required}`,
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);

  const buttonWidth = Math.max(64, Math.min(120, rect.width * 0.16));
  const payCancelLeft = rect.x + rect.width - buttonWidth * 2 - 18;

  // A `playCostReduction` ability (docs/phase7-wave3.md §3.20; Star-Lord's "What could go wrong?") is never
  // guessed for the player — it costs its own price (dealing yourself a facedown encounter card, here), so it
  // sits beside Pay/Cancel as its own toggle, not folded into "tap cards to spend" the way an ordinary source is.
  const reductions = payment.costReductionOptions;
  const reductionWidth = reductions.length > 0 ? Math.max(90, Math.min(160, rect.width * 0.22)) : 0;
  const reductionsLeft = reductionWidth > 0 ? payCancelLeft - reductionWidth - 8 : payCancelLeft;
  const buttonsLeft = reductionsLeft;

  if (reductions.length > 0) {
    const chipWidth = Math.max(56, reductionWidth / reductions.length - (reductions.length > 1 ? 4 : 0));
    reductions.forEach((option, index) => {
      const active = payment.reductions.some(
        (r) => r.instanceId === option.instanceId && r.abilityId === option.abilityId,
      );
      ctx.frame.buttons.push(
        new McButton(scene, {
          kind: active ? "primary" : "secondary",
          label: active ? `Using ${option.label}` : `Use ${option.label}`,
          type: typeRole.label,
          rect: {
            x: reductionsLeft + index * (chipWidth + 4),
            y: rect.y + 4,
            width: chipWidth,
            height: rect.height - 8,
          },
          onClick: () => controller.toggleCostReduction(option),
        }),
      );
    });
  }

  // The line of prose is the first thing to go when the bar is narrow: the
  // card being paid for already wears a "paying for" tag, so the sentence is
  // repeating itself, and a sentence running under the Pay button is worse
  // than no sentence.
  const headlineLeft = rect.x + 170;
  const headlineRoom = buttonsLeft - headlineLeft - 12;
  if (headlineRoom > 90) {
    const outstanding = payment.outstanding.length > 0 ? ` Still needs ${payment.outstanding.join(", ")}.` : "";
    // The price note comes before the instruction: a denominator that isn't the number printed on the card is
    // the first thing a player will question, and "tap cards to spend" can wait behind the answer.
    const note = payment.priceNote ? ` ${payment.priceNote}.` : "";
    scene.add
      .text(
        headlineLeft,
        rect.y + rect.height / 2,
        `${payment.headline}.${note} Tap cards to spend.${outstanding}`,
        textStyle(typeRole.emphasis, surface.paper.hex),
      )
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
