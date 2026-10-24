/**
 * The numbered ability slots: the 1-4 keys (7-0 under the right hand) and the pad's RT layer (A / X / Y / B) both
 * mean "the Nth usable ability on your cards in play", so one helper orders them and the two cannot disagree.
 *
 * The order is the focus route's (`view/focus.ts#focusOrder`): its cards, in route order, each contributing every
 * ability the engine lists for it right now (`legalActions` through `abilitiesFor`). Hand cards list none (a card in
 * the hand is played, not used), so they drop out without a second rule here. Paging is `abilityPageOf`
 * (`view/pad-layers.ts`), four a page; the keys take page 0, the pad's LB / RB page on.
 */

import type { InstanceId } from "@mc/engine";
import type { FocusTarget } from "./focus.js";
import { abilityPageOf } from "./pad-layers.js";

/** Every usable ability on the route's cards, flattened in route order. A card named twice on the route counts once. */
export function abilitySlotsOf<T>(
  route: readonly FocusTarget[],
  abilitiesFor: (instanceId: InstanceId) => readonly T[],
): readonly T[] {
  const seen = new Set<InstanceId>();
  const out: T[] = [];
  for (const stop of route) {
    if (stop.kind !== "card" || seen.has(stop.instanceId)) continue;
    seen.add(stop.instanceId);
    out.push(...abilitiesFor(stop.instanceId));
  }
  return out;
}

/** The ability a numbered slot (0-3) holds on `page` (0-based), or undefined when that slot is empty. */
export function abilityInSlot<T>(slots: readonly T[], slot: number, page = 0): T | undefined {
  return abilityPageOf(slots, page)[slot];
}
