/** Trigger matching: which abilities (in play or in hand) an event makes available in a timing window. */

import type { EngineDeps, EventPattern } from "../abilities.js";
import { isPriceFault, planCost, playRestrictionFault } from "../actions.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf, getPlayer, playerOrder } from "../query.js";
import { activeAbilityRefs, cardsInPlay, controllerOf, type EffectContext, matchesQuery } from "../select.js";
import type { TargetQuery } from "../spec.js";
import { candidateOf, type TriggerCandidate, type WindowTiming } from "../stack.js";
import type { Form, GameState } from "../state.js";
import { eventSubjects, type TriggerEvent } from "../trigger-events.js";
import { limitReached } from "./ability.js";

function matchesPattern(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  deps: EngineDeps,
): boolean {
  const kinds: readonly TriggerEvent["kind"][] = typeof pattern.on === "string" ? [pattern.on] : pattern.on;
  if (!kinds.includes(event.kind)) return false;
  // The same attack resolved against another player doesn't re-trigger the attacker's own "when it attacks".
  if (event.kind === "enemyAttack" && event.additionalResolution && event.enemyInstanceId === selfId) return false;
  const subjects = eventSubjects(event);
  if (pattern.selfIs === "source" && !subjects.sources.includes(selfId)) return false;
  if (pattern.selfIs === "target" && !subjects.targets.includes(selfId)) return false;
  if (
    pattern.selfIs === "either" &&
    !subjects.sources.includes(selfId) &&
    !subjects.targets.includes(selfId)
  ) {
    return false;
  }
  const controller = controllerOf(state, selfId);
  if (pattern.playerIs === "controller") {
    // An encounter card has no controller: its "you" is the player the event is about.
    if (!controller) return actingPlayerOf(event, pattern) !== null && matchesRest(state, pattern, event, selfId, null, deps);
    // RRG p.9: "after [enemy] attacks you" resolves for the attacked player, not the defender.
    const attackedPlayer =
      pattern.usesAttackedPlayer && event.kind === "enemyAttack" ? event.attackedPlayerId : null;
    if (attackedPlayer !== null) {
      if (controller !== attackedPlayer) return false;
    } else if (!subjects.players.includes(controller)) {
      return false;
    }
  }
  return matchesRest(state, pattern, event, selfId, controller, deps);
}

/** Pattern checks that don't depend on who "you" is. */
function matchesRest(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  controller: PlayerId | null,
  deps: EngineDeps,
): boolean {
  const subjects = eventSubjects(event);
  if (pattern.fromAttack !== undefined) {
    if (event.kind !== "dealDamage" || event.fromAttack !== pattern.fromAttack) return false;
  }
  const context: EffectContext = { selfInstanceId: selfId, controllerId: controller, event, bindings: {}, deps };
  if (pattern.targetIs) {
    const query: TargetQuery = pattern.targetIs;
    if (!subjects.targets.some((target) => matchesQuery(state, target, query, context))) return false;
  }
  if (pattern.sourceIs) {
    const query: TargetQuery = pattern.sourceIs;
    if (!subjects.sources.some((source) => matchesQuery(state, source, query, context))) return false;
  }
  if (pattern.requireResults) {
    for (const [key, amount] of Object.entries(pattern.requireResults)) {
      if ((event.results?.[key] ?? 0) < amount) return false;
    }
  }
  // "…and take no damage" (`{ damage: 0 }`): a result the event must not exceed. A result the event never recorded
  // reads as 0, so it satisfies any non-negative bound.
  if (pattern.resultsAtMost) {
    for (const [key, amount] of Object.entries(pattern.resultsAtMost)) {
      if ((event.results?.[key] ?? 0) > amount) return false;
    }
  }
  if (pattern.activation && (!("activation" in event) || event.activation !== pattern.activation)) return false;
  if (pattern.eventAtLeast) {
    const carried = event as unknown as Readonly<Record<string, unknown>>;
    for (const [key, amount] of Object.entries(pattern.eventAtLeast)) {
      const value = carried[key];
      if (typeof value !== "number" || value < amount) return false;
    }
  }
  if (pattern.eventIs) {
    const carried = event as unknown as Readonly<Record<string, unknown>>;
    for (const [key, expected] of Object.entries(pattern.eventIs)) {
      if (carried[key] !== expected) return false;
    }
  }
  if (pattern.attackKind) {
    if (event.kind !== "attack" && event.kind !== "thwart") return false;
    if ((pattern.attackKind === "basic") !== (event.basic === true)) return false;
  }
  return true;
}

/** Who "you" is when an encounter card's ability triggers on an event. */
function actingPlayerOf(event: TriggerEvent, pattern: EventPattern): PlayerId | null {
  if (pattern.usesAttackedPlayer && event.kind === "enemyAttack") return event.attackedPlayerId;
  return eventSubjects(event).players[0] ?? null;
}


/** RRG "Hero Interrupt"/"Alter-Ego Response": the gate is on the controller's current form. */
const formSatisfied = (state: GameState, controllerId: PlayerId | null, form: Form | undefined): boolean => {
  if (!form) return true;
  if (!controllerId) return false;
  return getPlayer(state, controllerId)?.identity.form === form;
};

export function candidatesFor(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const id of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, id)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      const controllerId = controllerOf(state, id);
      if (!formSatisfied(state, controllerId, trigger.form)) continue;
      if (limitReached(state, id, ref.id, definition, event)) continue;
      if (!matchesPattern(state, trigger.on, event, id, deps)) continue;
      // RRG "Cost": an ability whose cost can't be paid can't be triggered.
      if (definition.cost && controllerId && isPriceFault(planCost(state, deps, id, controllerId, definition.cost, {}, new Set()))) {
        continue;
      }
      const acting = controllerId ?? actingPlayerOf(event, trigger.on);
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId: acting, definition }, forced));
    }
  }
  if (!forced) found.push(...inHandCandidates(state, deps, event, timing));
  return found;
}

/**
 * RRG "Event" + "Interrupt"/"Response": an event whose ability is an interrupt
 * or a response is played from hand *inside* the matching timing window, so the
 * window has to offer each player their matching in-hand events alongside the
 * optional abilities already in play. Playing one is never forced, so these only
 * ever appear in the optional tier.
 */
function inHandCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
): readonly TriggerCandidate[] {
  const found: TriggerCandidate[] = [];
  for (const player of playerOrder(state)) {
    for (const id of player.hand) {
      const card = cardOf(state, id);
      if (card?.type !== "event") continue;
      // "Max 1 per round", "Play only if …": a window never offers a card its restrictions forbid.
      if (playRestrictionFault(state, deps, player.playerId, card)) continue;
      for (const ref of card.abilities) {
        const definition = deps.abilities[ref.id];
        if (!definition) continue;
        const trigger = definition.trigger;
        if (trigger.kind !== timing || trigger.forced) continue;
        if (!formSatisfied(state, player.playerId, trigger.form)) continue;
        if (!matchesPattern(state, trigger.on, event, id, deps)) continue;
        found.push({
          instanceId: id,
          abilityId: ref.id,
          controllerId: player.playerId,
          forced: false,
          fromHand: true,
        });
      }
    }
  }
  return found;
}

/**
 * Whether any ability could react to this event right now, in either window. Events on paths every game takes (a turn
 * ending, surge, an ability resolving, a minion engaging) go on the stack only when one could, so a game with nothing
 * listening resolves exactly as it did before those events existed.
 */
export const heard = (state: GameState, deps: EngineDeps, event: TriggerEvent): boolean =>
  hasCandidates(state, deps, event, "interrupt") || hasCandidates(state, deps, event, "response");

export const hasCandidates = (state: GameState, deps: EngineDeps, event: TriggerEvent, timing: WindowTiming): boolean =>
  candidatesFor(state, deps, event, timing, true).length > 0 ||
  candidatesFor(state, deps, event, timing, false).length > 0;
