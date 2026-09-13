/**
 * What keyboard focus moves through on the board, and in what order.
 *
 * A canvas has no focus order of its own — there is no DOM to tab through — so
 * the order is stated here rather than emerging from the draw calls. Keeping it
 * a pure function means the order is testable, and that it cannot quietly
 * change because someone reordered two `#draw` calls (PLAN.md Phase 4,
 * accessibility: "full keyboard and gamepad navigation with a visible focus
 * ring").
 *
 * The order follows the table, bottom-up, because that is the order a player
 * thinks in: the cards in your hand, then the actions you could take with them,
 * then the one control that ends your turn.
 */

import type { InstanceId } from "@mc/engine";
import type { BasicAction, Highlights } from "./highlights.js";

export type FocusTarget =
  | { readonly kind: "card"; readonly instanceId: InstanceId }
  | { readonly kind: "basic"; readonly action: BasicAction };

/** What the board is currently asking for, which changes what is worth focusing. */
export type FocusMode =
  | { readonly kind: "idle"; readonly hand: readonly InstanceId[] }
  /** Only the legal targets are worth stepping through. */
  | { readonly kind: "targeting"; readonly targets: readonly InstanceId[] }
  /** Only the things that can pay are worth stepping through. */
  | { readonly kind: "paying"; readonly sources: readonly InstanceId[] };

const BASICS: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm", "endTurn"];

/**
 * The focus ring's route.
 *
 * While a decision is open the route narrows to the answers: stepping through
 * an action bar you cannot use, to reach the one target you can, is the kind of
 * keyboard support that is worse than none.
 */
export function focusOrder(mode: FocusMode, marks: Highlights | null): readonly FocusTarget[] {
  if (mode.kind === "targeting") {
    return mode.targets.map((instanceId) => ({ kind: "card", instanceId }));
  }
  if (mode.kind === "paying") {
    return mode.sources.map((instanceId) => ({ kind: "card", instanceId }));
  }

  const cards: FocusTarget[] = mode.hand.map((instanceId) => ({ kind: "card", instanceId }));
  // Cards in play with a usable ability — the villain, an ally, your own
  // identity — sit between the hand and the action bar: they're something you
  // could still act on this turn, same as the hand is, but they aren't a
  // *basic* action and they aren't in your hand either. `usableAbilities`
  // already excludes anything not currently legal, so nothing here decides
  // that itself (PLAN.md Phase 4, "abilities on cards in play are not
  // reachable from the UI").
  const abilityCards: FocusTarget[] = marks
    ? [...marks.usableAbilities].filter((id) => !mode.hand.includes(id)).map((instanceId) => ({ kind: "card", instanceId }))
    : [];
  // An unusable control still takes focus: "why can't I attack?" is a question
  // the player has to be able to reach the answer to, and the reason lives on
  // the button. Only controls the engine never offers at all are skipped.
  const basics: FocusTarget[] = BASICS.filter((action) => marks?.basics.some((basic) => basic.action === action) ?? false).map(
    (action) => ({ kind: "basic", action }),
  );
  return [...cards, ...abilityCards, ...basics];
}

/** Moves focus by `delta`, wrapping. Returns the new index, or -1 when there is nothing to focus. */
export function stepFocus<T>(order: readonly T[], current: number, delta: number): number {
  if (order.length === 0) return -1;
  const from = current < 0 ? (delta > 0 ? -1 : 0) : current;
  return (((from + delta) % order.length) + order.length) % order.length;
}

/**
 * `stepFocus` over a route of plain string keys, for the screens whose stops
 * are just their controls (Title, the villain-phase walkthrough, Game Over).
 * A key no longer on the route counts as no focus. Null when the route is empty.
 */
export function stepKey(order: readonly string[], current: string | null, delta: number): string | null {
  const next = stepFocus(order, current === null ? -1 : order.indexOf(current), delta);
  return next >= 0 ? (order[next] ?? null) : null;
}

/** True when two focus targets name the same thing, so focus survives a redraw. */
export function sameTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "card" && b.kind === "card" ? a.instanceId === b.instanceId : a.kind === "basic" && b.kind === "basic" && a.action === b.action;
}
