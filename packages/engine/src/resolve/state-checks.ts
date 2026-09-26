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
import type { AbilityRegistry, RuleSpec } from "../abilities.js";
import { setActiveVillain } from "../effects.js";
import { currentName, mainSchemeStageOf, mainSchemeStateOf, undefeatedVillains } from "../query.js";
import { type Ctx, emit, moveCard, pushFrames, updateInstance } from "../ctx.js";
import { statusCapacity } from "../keywords.js";
import type { InstanceId } from "../ids.js";
import {
  activeAbilityRefs,
  activeRules,
  cardsInPlay,
  controllerOf,
  evaluate,
  focusedMainSchemeId,
  matchesQuery,
} from "../select.js";
import type { StackFrame } from "../stack.js";
import { limitReached } from "./ability.js";
import { checkAllyLimits } from "./enter-play.js";
import { abilityFrame } from "./frames.js";

const registriesWithChecks = new WeakMap<AbilityRegistry, boolean>();
const registriesWithRuleKind = new Map<RuleSpec["kind"], WeakMap<AbilityRegistry, boolean>>();

/**
 * Whether any printed constant in the registry declares a rule of `kind`. The continuous rules below are scanned between
 * frames, so a game whose registry has none skips them.
 */
/** A rule the scenario imposes without a card (§3.40 of wave 4) counts as present too. */
const scenarioHasRule = (ctx: Ctx, kind: RuleSpec["kind"]): boolean =>
  (ctx.state.scenarioRules.rules ?? []).some((rule) => rule.kind === kind);

function hasRuleKind(registry: AbilityRegistry, kind: RuleSpec["kind"]): boolean {
  let byRegistry = registriesWithRuleKind.get(kind);
  if (!byRegistry) {
    byRegistry = new WeakMap();
    registriesWithRuleKind.set(kind, byRegistry);
  }
  let known = byRegistry.get(registry);
  if (known === undefined) {
    known = Object.values(registry).some(
      (definition) =>
        definition.trigger.kind === "constant" && (definition.trigger.rules ?? []).some((rule) => rule.kind === kind),
    );
    byRegistry.set(registry, known);
  }
  return known;
}

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
  // A continuous rule rather than an ability, checked in the same place and for the same reason: RRG 1.8 "Ally
  // Limit" (p. 7) applies the moment a player "ever" controls too many allies. Asking for the discard is the result.
  if (checkAllyLimits(ctx)) return true;
  // The same kind of rule: a character that cannot have a status card sheds the ones it holds (stalwart; docs/phase7-
  // wave3.md §3.7). Nothing to put on the stack, so the flow carries on.
  clearForbiddenStatuses(ctx);
  // …and a card the first player controls follows the first player token (the Milano; §3.13).
  applyFirstPlayerControl(ctx);
  // …and the active villain is the villain of the main scheme Focused Defense is attached to (§3.2 of wave 4).
  applyFocusedActiveVillain(ctx);
  if (!hasStateChecks(ctx.deps.abilities)) return false;
  const observed: Record<string, boolean> = {};
  const firing: { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[] = [];
  for (const instanceId of cardsInPlay(ctx.state)) {
    for (const ref of activeAbilityRefs(ctx.state, instanceId, ctx.deps)) {
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

/**
 * RRG 1.8 "Stalwart" (p. 40): "If a character gains the stalwart keyword while they have a stunned and/or confused
 * status card, each stunned and/or confused status card is removed from that character." The same holds for a
 * `cannotHaveStatus` rule ("Ronan the Accuser cannot be stunned") that starts to apply. `statusCapacity` is what both
 * read, so a character holding more of a status than it may is trimmed to that. Only characters already holding a
 * status are looked at, so a board with none costs one pass over the instances in play.
 */
function clearForbiddenStatuses(ctx: Ctx): void {
  for (const id of cardsInPlay(ctx.state)) {
    const held = ctx.state.instances[id]?.statuses;
    if (!held || held.stunned + held.confused + held.tough === 0) continue;
    for (const status of ["stunned", "confused", "tough"] as const) {
      const allowed = statusCapacity(ctx.state, id, status, ctx.deps);
      if ((ctx.state.instances[id]?.statuses[status] ?? 0) <= allowed) continue;
      updateInstance(ctx, id, (i) => ({ ...i, statuses: { ...i.statuses, [status]: allowed } }));
      emit(ctx, { type: "statusRemoved", instanceId: id, status, reason: "cannotHave" });
    }
  }
}

/**
 * "The first player controls the Milano." (`controlledByFirstPlayer`; docs/phase7-wave3.md §3.13): a matching card in
 * play is moved to the first player's play area under their control whenever it is anywhere else — after the first
 * player token passes (RRG 1.8 "First Player", p. 19), after a first player is eliminated, and if it entered play under
 * someone else. Moving between play areas is not leaving play, so a permanent card moves too.
 */
function applyFirstPlayerControl(ctx: Ctx): void {
  if (!hasRuleKind(ctx.deps.abilities, "controlledByFirstPlayer") && !scenarioHasRule(ctx, "controlledByFirstPlayer"))
    return;
  const first = ctx.state.firstPlayerId;
  for (const { rule, context } of activeRules(ctx.state, ctx.deps, "controlledByFirstPlayer")) {
    for (const id of cardsInPlay(ctx.state)) {
      if (!matchesQuery(ctx.state, id, rule.target, context)) continue;
      const from = controllerOf(ctx.state, id);
      if (from === first) continue;
      const attached = ctx.state.instances[id]?.attachedTo ?? null;
      if (attached === null) moveCard(ctx, id, { kind: "playArea", playerId: first });
      updateInstance(ctx, id, (instance) => ({ ...instance, controllerId: first }));
      emit(ctx, { type: "controllerChanged", instanceId: id, from, to: first, reason: "firstPlayer" });
    }
  }
}

/**
 * Focused Defense (Tower Defense, `mts` 21101): "The villain who matches the attached scheme is the active villain."
 * (`RuleSpec focusedMainScheme`; docs/phase7-wave4.md §3.2.) The villain whose title the scheme's `villainOf` names, if
 * it is undefeated, takes the active counter the moment the attachment moves ("After the player phase ends, attach this
 * card to the other main scheme").
 */
function applyFocusedActiveVillain(ctx: Ctx): void {
  if (!hasRuleKind(ctx.deps.abilities, "focusedMainScheme") && !scenarioHasRule(ctx, "focusedMainScheme")) return;
  const schemeId = focusedMainSchemeId(ctx.state, ctx.deps);
  const scheme = schemeId ? mainSchemeStateOf(ctx.state, schemeId) : undefined;
  if (!scheme) return;
  const name = mainSchemeStageOf(ctx.state, scheme).villainOf;
  if (name === undefined) return;
  const villain = undefeatedVillains(ctx.state).find((v) => currentName(ctx.state, v.instanceId) === name);
  if (villain && villain.instanceId !== ctx.state.activeVillainId)
    setActiveVillain(ctx, villain.instanceId, "focusedScheme");
}

function sameValues(a: Readonly<Record<string, boolean>>, b: Readonly<Record<string, boolean>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => b[key] === a[key]);
}
