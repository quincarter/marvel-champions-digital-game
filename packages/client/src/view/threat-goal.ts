/**
 * The threat a non-scheme card's own text waits for, so the table reads "3/4 threat" against the line instead of
 * nothing (Alert Level, `aos` 50090a/b: "If there is at least 4[per_hero] threat here, remove all threat from here and
 * flip this card" on its Low side, "...the players lose the game" on its High side; issue 182). Read from the card's
 * `stateCheck` abilities on the face in play, the way `counter-goal.ts` reads a counter goal: display only, the
 * ability still decides when anything happens.
 *
 * Engine ask: expose a card's own threat thresholds beside `selfDamageThreshold`, and this module can go.
 */
import { activeAbilityRefs, resolveValue, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";

export interface ThreatGoal {
  /** The threat the state check waits for, at the current player count. */
  readonly goal: number;
  /** What reaching it does: the players lose (Alert Level's High side), the card flips (its Low side), or else. */
  readonly outcome: "loss" | "flip" | "other";
}

/** The first threat state check on the face in play of `id`, or null for a card that waits for none. */
export function threatGoalOf(state: GameState, id: InstanceId, deps: EngineDeps): ThreatGoal | null {
  const context = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
  for (const ref of activeAbilityRefs(state, id, deps)) {
    const ability = deps.abilities[ref.id];
    if (!ability) continue;
    const trigger = ability.trigger;
    if (trigger?.kind !== "stateCheck") continue;
    const when = trigger.when;
    if (
      when.kind === "compare" &&
      when.op === "atLeast" &&
      when.left.kind === "threat" &&
      when.left.of.kind === "self"
    ) {
      return { goal: resolveValue(state, when.right, context, deps), outcome: outcomeOf(ability.effects) };
    }
  }
  return null;
}

/** A loss anywhere in the effects (nested branches included) wins over a flip; else "other". */
function outcomeOf(effects: unknown): ThreatGoal["outcome"] {
  const text = JSON.stringify(effects);
  if (/"kind":"endGame","result":"loss"/.test(text)) return "loss";
  return text.includes('"kind":"flipCard"') ? "flip" : "other";
}
