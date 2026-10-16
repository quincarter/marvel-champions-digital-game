/**
 * How many cards a scenario area may hold before the scheme's own text acts, so the table reads "3/5" against the
 * goal instead of a bare count (The Grand Collection 1B: "If there are at least 5[per_hero] cards in The Collection,
 * the players lose the game"). Read from the main schemes' `stateCheck` abilities on the face in play, the way
 * `counter-goal.ts` reads a counter goal: display only, the ability still decides when anything happens.
 */
import { activeAbilityRefs, resolveValue, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";

/** Area name to the count the schemes' own state checks wait for; empty when none reads a scenario area. */
export function scenarioAreaLimitsOf(
  state: GameState,
  schemeIds: readonly InstanceId[],
  deps: EngineDeps,
): Readonly<Record<string, number>> {
  const limits: Record<string, number> = {};
  for (const id of schemeIds) {
    if (!state.instances[id]) continue;
    const context = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "stateCheck") continue;
      const when = trigger.when;
      // An unfiltered count only: "at least 5 cards in The Collection", not "at least 2 allies in it".
      if (when.kind !== "compare" || when.op !== "atLeast" || when.left.kind !== "scenarioAreaCount") continue;
      if (when.left.filter) continue;
      const limit = resolveValue(state, when.right, context, deps);
      const known = limits[when.left.name];
      limits[when.left.name] = known === undefined ? limit : Math.min(known, limit);
    }
  }
  return limits;
}
