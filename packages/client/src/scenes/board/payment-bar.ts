/**
 * The payment bar that sits over the hand while a card is being paid for.
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, fitWrapped, McButton } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import { BAR_ROW, paymentBarLayout } from "../../view/payment-bar-layout.js";
import type { PaymentView } from "../../view/payment-model.js";
import type { BoardDrawContext } from "./context.js";
import { focusKey } from "./selection.js";

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
/** The bar's lines start here and shrink only as far as they must to fit their rect. */
const WORDS_SIZE = 13;

export function drawPaymentBar(ctx: BoardDrawContext, rect: Rect, payment: PaymentView): void {
  const { scene, controller } = ctx;
  // Where each part sits is `view/payment-bar-layout.ts`'s decision. The bar's bottom row stays where the one-row bar
  // sits; a bar with more rows (a phone's X stepper, the lock note) grows upward over the table above the hand.
  const reductions = payment.costReductionOptions;
  const picker = payment.xPicker;
  // The order note is the touch path to what a hover shows on a mouse: the tabbed (phone) board has no hover.
  const orderNote = ctx.tabbed ? payment.orderNote : null;
  const layout = paymentBarLayout(rect.width, {
    stepper: picker !== null,
    reductions: reductions.length,
    payLabel: payment.payLabel !== null,
    overpaid: payment.overpaidNote !== null,
    lock: payment.lockedNote !== null,
    helperLines: payment.helperLines.length,
    orderNote: orderNote !== null,
  });
  const originX = rect.x;
  const originY = rect.y + BAR_ROW - layout.height;
  const at = (r: Rect): Rect => ({ x: originX + r.x, y: originY + r.y, width: r.width, height: r.height });
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(originX, originY, rect.width, layout.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(originX, originY, rect.width, 3);

  const count = at(layout.count);
  fitText(
    scene.add
      .text(
        count.x,
        count.y + count.height / 2,
        `PAYING ${payment.paid} / ${payment.requiredLabel}`,
        textStyle(typeRole.barTitle, surface.paper.hex),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(1),
    count.width,
    typeRole.barTitle.size,
  );

  // A line of the bar's words in its own rect, shrunk to fit and never past `lines` lines.
  const words = (r: Rect, text: string, lines: number): void => {
    const box = at(r);
    const t = scene.add
      .text(box.x, box.y + box.height / 2, text, textStyle(typeRole.emphasis, surface.paper.hex))
      .setOrigin(0, 0.5);
    fitWrapped(t, box.width, lines, WORDS_SIZE);
  };

  // A `playCostReduction` ability (docs/phase7-wave3.md §3.20; Star-Lord's "What could go wrong?") is never
  // guessed for the player — it costs its own price (dealing yourself a facedown encounter card, here), so it
  // sits beside Pay/Cancel as its own toggle, not folded into "tap cards to spend" the way an ordinary source is.
  reductions.forEach((option, index) => {
    const chip = layout.reductions[index];
    if (!chip) return;
    const active = payment.reductions.some(
      (r) => r.instanceId === option.instanceId && r.abilityId === option.abilityId,
    );
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: active ? "primary" : "secondary",
        label: active ? `Using ${option.label}` : `Use ${option.label}`,
        type: typeRole.label,
        rect: at(chip),
        onClick: () => controller.toggleCostReduction(option),
      }),
    );
  });

  // The X picker (a card printed with an X cost): minus, "X 2", plus.
  if (picker && layout.stepper) {
    const lessRect = at(layout.stepper.less);
    const moreRect = at(layout.stepper.more);
    const labelRect = at(layout.stepper.label);
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: "-",
        type: typeRole.label,
        rect: lessRect,
        enabled: picker.value > picker.min,
        reason: `X is at least ${picker.min}`,
        onClick: () => controller.stepX(-1),
      }),
      new McButton(scene, {
        kind: "secondary",
        label: "+",
        type: typeRole.label,
        rect: moreRect,
        enabled: picker.value < picker.max,
        reason: `You cannot pay for more than X = ${picker.max}`,
        onClick: () => controller.stepX(1),
      }),
    );
    fitText(
      scene.add
        .text(
          labelRect.x + labelRect.width / 2,
          labelRect.y + labelRect.height / 2,
          `X ${picker.value}`,
          textStyle(typeRole.barTitle, surface.paper.hex),
        )
        .setOrigin(0.5, 0.5),
      labelRect.width - 4,
      typeRole.barTitle.size,
    );
    ctx.frame.focusRects.set(focusKey({ kind: "xLess" }), lessRect);
    ctx.frame.focusRects.set(focusKey({ kind: "xMore" }), moreRect);
  }

  const outstanding = payment.outstanding.length > 0 ? ` Still needs ${payment.outstanding.join(", ")}.` : "";
  // The price note comes before the instruction: a denominator that isn't the number printed on the card is
  // the first thing a player will question, and "tap cards to spend" can wait behind the answer.
  const note = payment.priceNote ? ` ${payment.priceNote}.` : "";
  // What the picks add beyond the cost, and who helped pay: counted from the engine's own query, never worked out here.
  const over = payment.overpaidNote ? ` ${payment.overpaidNote}.` : "";
  const held = payment.lockedNote ? ` ${payment.lockedNote}.` : "";
  const helped = payment.helperLines.map((line) => ` ${line}.`).join("");
  const prose = `${payment.headline}.${note} Tap cards to spend.${outstanding}`;
  words(layout.prose, layout.inlineNotes ? `${prose}${over}${held}${helped}` : prose, 2);
  if (layout.over && payment.overpaidNote) words(layout.over, `${payment.overpaidNote}.`, 1);
  if (layout.lock && payment.lockedNote) words(layout.lock, `${payment.lockedNote}.`, 2);
  layout.helpers.forEach((row, index) => words(row, `${payment.helperLines[index] ?? ""}.`, 1));
  if (layout.order && orderNote) words(layout.order, orderNote, 3);

  const payRect = at(layout.pay);
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "secondary",
      label: payment.payLabel ?? "Pay",
      type: typeRole.label,
      rect: payRect,
      enabled: payment.payReady,
      ...(payment.blockedBy ? { reason: payment.blockedBy } : {}),
      onClick: () => void controller.commitPayment(),
    }),
  );
  const cancelRect = at(layout.cancel);
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: cancelRect,
      onClick: () => controller.cancel(),
    }),
  );
  // Not keyboard-focusable rects (Pay/Cancel aren't in this bar's own Tab order today) — registered here purely
  // so a headless click-through can find a real screen coordinate (`scenes/board.ts`'s own `__mcBoardDebug`)
  // instead of a hardcoded pixel guess, the same reason `guide/tutorial-lessons.ts`'s own anchors exist.
  ctx.frame.focusRects.set("payment:pay", payRect);
  ctx.frame.focusRects.set("payment:cancel", cancelRect);
}
