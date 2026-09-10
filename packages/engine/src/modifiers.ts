import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, evaluate, matchesQuery, type EffectContext } from "./select.js";
import type { StatName } from "./spec.js";
import type { GameState } from "./state.js";

export type ModifiedStat = StatName | "hp" | "handSize";

export interface ActiveModifier {
  readonly sourceInstanceId: InstanceId;
  readonly stat: ModifiedStat;
  readonly amount: number;
}

/**
 * Constant abilities are never "applied" to state — they are recomputed on
 * every read (RRG "Modifiers": the game recalculates a modified quantity from
 * the base value and all active modifiers each time it is checked).
 */
export function modifiersFor(state: GameState, deps: EngineDeps, targetId: InstanceId): readonly ActiveModifier[] {
  const found: ActiveModifier[] = [];
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId)) {
      const definition = deps.abilities[ref.id];
      if (!definition || definition.trigger.kind !== "constant") continue;
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: controllerOf(state, sourceId),
        event: null,
        bindings: {},
      };
      for (const modifier of definition.trigger.modifiers) {
        if (modifier.while && !evaluate(state, modifier.while, context)) continue;
        if (!matchesQuery(state, targetId, modifier.target, context)) continue;
        found.push({ sourceInstanceId: sourceId, stat: modifier.stat, amount: modifier.amount });
      }
    }
  }
  return found;
}

export function statBonus(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  stat: ModifiedStat,
): number {
  return modifiersFor(state, deps, targetId)
    .filter((modifier) => modifier.stat === stat)
    .reduce((sum, modifier) => sum + modifier.amount, 0);
}
