/**
 * The pure decision behind `scenes/board/guide-mount.ts#syncPayingOverride` (guided mode G10d fix, extended for
 * the owner's lesson-2 reorder, `docs/guided-mode.md` §4): any card-play step whose own data names an ordered
 * `payWith` (`LessonStepCopy.payWith`) really has N+2 targets the player has to hit in sequence — the signature
 * card itself, then each payer in order, then Pay — driven by the live payment bar, which is client-side UI state
 * `LessonObservation` never carries. Split out so the walk-the-payment-bar logic is testable without a Phaser
 * scene (the same "pure model, thin Phaser adapter" split every other guide module uses); the mount is left with
 * only gathering the live game/payment state and calling `GuideController#setOverride`.
 *
 * A step with no `payWith` (a card-play step whose cost has no single fixed set of payers to name)
 * always resolves to `null` — its own `doThis`/`doThisTabbed` keeps showing as-is, same as before this fix
 * existed.
 */
import type { GuideStepOverride } from "../guide/guide-controller.js";
import type { LessonAnchor, LessonPayer, LessonStep } from "./lesson-model.js";

/** `payment:pay`'s own `focusRects` key (`scenes/board/payment-bar.ts`). */
const PAY_CONTROL_ID = "payment:pay";

/** The live payment bar's own state, trimmed to what this decision reads (`view/payment-model.ts#PaymentView`).
 * `spentOptionIds` is `Array.from(PaymentView.spent.keys())` — the option ids already picked, in whatever order
 * the player picked them, which is enough to tell whether a given payer's own option id has been spent yet. */
export interface PayingOverrideSnapshot {
  readonly subject: string | null;
  readonly spentOptionIds: readonly string[];
}

/**
 * One `LessonPayer` resolved against the live game: `instanceId` is the card (`kind: "handCard"`) or the
 * perspective player's own identity card (`kind: "identityAbility"`) in this game, or `null` when it isn't
 * resolvable right now (not in hand/play, or no game running yet) — the same "leave the step's copy alone rather
 * than naming a card that isn't on the table" contract the single-payer version had.
 */
export interface ResolvedPayer {
  readonly payer: LessonPayer;
  readonly instanceId: string | null;
}

/** The payment bar's own option id for one payer once it's picked — `"hand:<id>"` for a hand card
 * (`packages/engine/src/actions.ts`'s `hand:${id}`), `"ability:<id>:<abilityId>"` for a resource ability
 * (`resourceAbilityOptionId`, same file) — computed here rather than carried on `ResolvedPayer`, since both only
 * ever depend on the payer's own kind and instance id. */
function optionIdFor(payer: LessonPayer, instanceId: string): string {
  return payer.kind === "handCard" ? `hand:${instanceId}` : `ability:${instanceId}:${payer.abilityId}`;
}

/** Where `TRY THIS` rings this payer once it's next in line: the card itself for a hand card, or the resource
 * ability's own table tile for an identity ability — drawn at `focusKey({ kind: "card", instanceId })`
 * (`scenes/board/hand.ts#drawPaymentTable`, `scenes/board/selection.ts#focusKey`), which is a `"control"` anchor
 * here since that tile is never registered in `cardRects` (see `guide-anchor.ts`'s own header on card vs. control
 * anchors). */
function anchorFor(payer: LessonPayer, instanceId: string): LessonAnchor {
  return payer.kind === "handCard" ? { kind: "card", code: payer.code } : { kind: "control", id: `card:${instanceId}` };
}

/**
 * `null` whenever `step` isn't a payer-walk step at all (no `payWith`, no anchor, or a non-card anchor) — the
 * caller should treat that the same as "nothing to override" and leave the step's own copy alone. Otherwise walks
 * the same targets the tutorial's Black Cat → Scientist → Interrogation Room → Pay (and every aspect try-it's
 * single-payer Energy/Genius/Ancestral Knowledge → Pay) always has:
 *
 * 1. Before the signature card is the open payment's subject: no override on desktop; `doThisTabbed`
 *    (when the step has one) on a tabbed layout, where tapping the card opens Inspect first.
 * 2. The signature card is the subject: ring the first `payers` entry whose own option id hasn't been spent yet.
 *    An entry that isn't resolvable in this game (`instanceId` is `null`) stops the walk there, leaving the
 *    step's own copy alone rather than naming a card that isn't on the table — the same fallback the single-payer
 *    version had.
 * 3. Every payer has been spent: ring the Pay button.
 */
export function payingOverrideFor(
  step: LessonStep | null,
  subjectInstanceId: string | null,
  payers: readonly ResolvedPayer[],
  payment: PayingOverrideSnapshot | null,
  tabbed: boolean,
): GuideStepOverride | null {
  const anchor = step?.anchor;
  if (!step || !anchor || anchor.kind !== "card" || payers.length === 0) return null;

  if (!payment || payment.subject === null || payment.subject !== subjectInstanceId) {
    const doThisTabbed = tabbed ? step.copy.doThisTabbed : undefined;
    return doThisTabbed ? { doThis: doThisTabbed } : null;
  }

  for (const { payer, instanceId } of payers) {
    if (instanceId !== null && payment.spentOptionIds.includes(optionIdFor(payer, instanceId))) continue;
    if (instanceId === null) return null;
    return { anchor: anchorFor(payer, instanceId), doThis: payer.doThis };
  }

  return { anchor: { kind: "control", id: PAY_CONTROL_ID }, doThis: "Tap Pay" };
}
