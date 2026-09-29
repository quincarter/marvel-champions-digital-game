/**
 * The pure decision behind `scenes/board/guide-mount.ts#syncPayingOverride` (guided mode G10d fix,
 * `docs/guided-mode.md` §4): any card-play step whose own data names a single-card `payWith`
 * (`LessonStepCopy.payWith`) really has three targets the player has to hit in sequence — the signature card
 * itself, then its payer, then Pay — driven by the live payment bar, which is client-side UI state
 * `LessonObservation` never carries. Split out so the walk-the-payment-bar logic is testable without a Phaser
 * scene (the same "pure model, thin Phaser adapter" split every other guide module uses); the mount is left with
 * only gathering the live game/payment state and calling `GuideController#setOverride`.
 *
 * A step with no `payWith` (e.g. Daredevil, whose cost needs two cards played together) always resolves to
 * `null` — its own `doThis`/`doThisTabbed` keeps showing as-is, same as before this fix existed.
 */
import type { GuideStepOverride } from "../guide/guide-controller.js";
import type { LessonStep } from "./lesson-model.js";

/** `payment:pay`'s own `focusRects` key (`scenes/board/payment-bar.ts`). */
const PAY_CONTROL_ID = "payment:pay";

/** The live payment bar's own state, trimmed to what this decision reads (`view/payment-model.ts#PaymentView`). */
export interface PayingOverrideSnapshot {
  readonly subject: string | null;
  readonly paid: number;
}

/**
 * `null` whenever `step` isn't a single-card-payer step at all (no `payWith`, no anchor, or a non-card anchor) —
 * the caller should treat that the same as "nothing to override" and leave the step's own copy alone. Otherwise
 * walks the same three targets the tutorial's Black Cat → Energy → Pay always has:
 *
 * 1. Before the signature card is the open payment's subject: no override on desktop; `doThisTabbed`
 *    (when the step has one) on a tabbed layout, where tapping the card opens Inspect first.
 * 2. The signature card is the subject, nothing paid yet: ring `payWith`'s own card (`null` when it isn't
 *    resolvable in this game — `payerInstanceId` is `null` — leaving the step's own copy alone rather than
 *    naming a card that isn't on the table).
 * 3. Something's already been paid: ring the Pay button.
 */
export function payingOverrideFor(
  step: LessonStep | null,
  subjectInstanceId: string | null,
  payerInstanceId: string | null,
  payment: PayingOverrideSnapshot | null,
  tabbed: boolean,
): GuideStepOverride | null {
  const anchor = step?.anchor;
  const payWith = step?.copy.payWith;
  if (!step || !anchor || anchor.kind !== "card" || !payWith) return null;

  if (!payment || payment.subject === null || payment.subject !== subjectInstanceId) {
    const doThisTabbed = tabbed ? step.copy.doThisTabbed : undefined;
    return doThisTabbed ? { doThis: doThisTabbed } : null;
  }

  if (payment.paid > 0) {
    return { anchor: { kind: "control", id: PAY_CONTROL_ID }, doThis: "Tap Pay" };
  }

  if (payerInstanceId === null) return null;
  return {
    anchor: { kind: "card", code: payWith },
    ...(step.copy.payWithDoThis !== undefined ? { doThis: step.copy.payWithDoThis } : {}),
  };
}
