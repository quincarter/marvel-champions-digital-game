/**
 * Condition-triggered forced abilities (`AbilityTriggerSpec` `stateCheck`): "If there are no madness counters here,
 * flip Green Goblin and State of Madness." (docs/phase7-wave1.md §3.4).
 *
 * `runFlow` calls `checkStateTriggers` between every two frames, the way RRG 1.8 "Uses" (p. 46) discards a card the
 * moment its last counter goes, so the ability resolves before anything else continues (FAQ "Green Goblin (#1B)",
 * p. 59: the flip happens in the middle of an attack). The last observed value of each condition lives in
 * `GameState.stateChecks`, so the check is plain state: a replay re-derives it and a save carries it.
 */

import type { AbilityId } from "@mc/content";
import type { AbilityRegistry } from "../abilities.js";
import { type Ctx, pushFrames } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, evaluate } from "../select.js";
import type { StackFrame } from "../stack.js";
import { limitReached } from "./ability.js";
import { abilityFrame } from "./frames.js";

const registriesWithChecks = new WeakMap<AbilityRegistry, boolean>();

/** Whether any ability in the registry is a state check; games without one skip the scan entirely. */
function hasStateChecks(registry: AbilityRegistry): boolean {
  let known = registriesWithChecks.get(registry);
  if (known === undefined) {
    known = Object.values(registry).some((definition) => definition.trigger.kind === "stateCheck");
    registriesWithChecks.set(registry, known);
  }
  return known;
}

/**
 * Observes every live state-check ability on a card in play. One whose condition changed from false to true is put
 * on the stack, in play-area order; the rest only have their value recorded. Returns true when it pushed a frame.
 */
export function checkStateTriggers(ctx: Ctx): boolean {
  if (!hasStateChecks(ctx.deps.abilities)) return false;
  const observed: Record<string, boolean> = {};
  const firing: { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] = [];
  for (const instanceId of cardsInPlay(ctx.state)) {
    for (const ref of activeAbilityRefs(ctx.state, instanceId)) {
      const definition = ctx.deps.abilities[ref.id];
      if (definition?.trigger.kind !== "stateCheck") continue;
      const key = `${instanceId}:${ref.id}`;
      const now = evaluate(ctx.state, definition.trigger.when, {
        selfInstanceId: instanceId,
        controllerId: controllerOf(ctx.state, instanceId),
        event: null,
        bindings: {},
        deps: ctx.deps,
      });
      observed[key] = now;
      // First observation records only; a change from false to true fires.
      if (now && ctx.state.stateChecks[key] === false && !limitReached(ctx.state, instanceId, ref.id, definition)) {
        firing.push({ instanceId, abilityId: ref.id });
      }
    }
  }
  if (!sameValues(observed, ctx.state.stateChecks)) ctx.state = { ...ctx.state, stateChecks: observed };
  if (firing.length === 0) return false;
  const frames: StackFrame[] = firing.map(({ instanceId, abilityId }) =>
    abilityFrame(
      ctx,
      {
        instanceId,
        abilityId,
        // A card nobody controls acts for the first player, as scheme and villain abilities do.
        controllerId: controllerOf(ctx.state, instanceId) ?? ctx.state.firstPlayerId,
        forced: true,
        fromHand: false,
      },
      null,
      null,
    ),
  );
  pushFrames(ctx, frames);
  return true;
}

function sameValues(a: Readonly<Record<string, boolean>>, b: Readonly<Record<string, boolean>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => b[key] === a[key]);
}
