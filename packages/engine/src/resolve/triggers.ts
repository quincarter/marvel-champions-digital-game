/** Trigger matching: which abilities (in play or in hand) an event makes available in a timing window. */

import type { EngineDeps, EventPattern } from "../abilities.js";
import { defaultInPlayPicks, isPriceFault, planCost, playRestrictionFault } from "../actions.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf, getPlayer, playerOrder } from "../query.js";
import {
  activeAbilityRefs,
  cardsInPlay,
  controllerOf,
  type EffectContext,
  matchesQuery,
  uncontrolledYouOf,
} from "../select.js";
import type { TargetQuery } from "../spec.js";
import { candidateOf, type TriggerCandidate, type WindowTiming } from "../stack.js";
import type { LastingEffect } from "../lasting.js";
import type { Form, GameState } from "../state.js";
import { eventSubjects, type TriggerEvent } from "../trigger-events.js";
import { limitReached } from "./ability.js";

function matchesPattern(
  state: GameState,
  pattern: EventPattern,
  event: TriggerEvent,
  selfId: InstanceId,
  deps: EngineDeps,
  /** Who controls `selfId` when that is not `controllerOf` (a spent card out of play, `spentCardCandidates`). */
  controllerOverride?: PlayerId,
): boolean {
  const kinds: readonly TriggerEvent["kind"][] = typeof pattern.on === "string" ? [pattern.on] : pattern.on;
  if (!kinds.includes(event.kind)) return false;
  // The same attack resolved against another player doesn't re-trigger the attacker's own "when it attacks".
  if (event.kind === "enemyAttack" && event.additionalResolution && event.enemyInstanceId === selfId) return false;
  const subjects = eventSubjects(event);
  if (pattern.selfIs === "source" && !subjects.sources.includes(selfId)) return false;
  if (pattern.selfIs === "target" && !subjects.targets.includes(selfId)) return false;
  if (pattern.selfIs === "either" && !subjects.sources.includes(selfId) && !subjects.targets.includes(selfId)) {
    return false;
  }
  const controller = controllerOverride ?? controllerOf(state, selfId);
  if (pattern.playerIs === "controller") {
    // An encounter card has no controller: its "you" is the player the event is about — unless the rules name its
    // "you" (an attachment on a player card, an obligation: `uncontrolledYouOf`), when the event must be about them.
    if (!controller) {
      const acting = actingPlayerOf(event, pattern);
      if (acting === null) return false;
      const named = uncontrolledYouOf(state, selfId);
      if (named !== null && acting !== named) return false;
      return matchesRest(state, pattern, event, selfId, null, deps);
    }
    // RRG p.9: "after [enemy] attacks you" resolves for the attacked player, not the defender.
    const attackedPlayer = pattern.usesAttackedPlayer && event.kind === "enemyAttack" ? event.attackedPlayerId : null;
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
    // Damage from an attack, or a defeat by attack damage ("defeated by an enemy attack"; docs/phase7-wave3.md §3.45).
    const fromAttack =
      event.kind === "dealDamage"
        ? event.fromAttack
        : event.kind === "characterDefeated"
          ? event.fromAttack === true
          : undefined;
    if (fromAttack !== pattern.fromAttack) return false;
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
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      // A cost reduction is used while paying, not offered in the play's window (docs/phase7-wave3.md §3.20).
      if (definition.playCostReduction) continue;
      const controllerId = controllerOf(state, id);
      // "First Player Interrupt/Response": the first player is the one offered it and resolving it (§3.13).
      if (trigger.firstPlayerOnly === true && controllerId !== null && controllerId !== state.firstPlayerId) continue;
      if (!formSatisfied(state, controllerId, trigger.form)) continue;
      const limitPlayer =
        controllerId ?? (trigger.firstPlayerOnly === true ? state.firstPlayerId : actingPlayerOf(event, trigger.on));
      if (limitReached(state, id, ref.id, definition, event, limitPlayer)) continue;
      if (!matchesPattern(state, trigger.on, event, id, deps)) continue;
      // RRG "Cost": an ability whose cost can't be paid can't be triggered. A pick of cards in play the player makes
      // later (`costPick`, docs/phase7-wave4.md §3.17) is judged by the default picks.
      if (
        definition.cost &&
        controllerId &&
        isPriceFault(
          planCost(
            state,
            deps,
            id,
            controllerId,
            definition.cost,
            defaultInPlayPicks(state, deps, id, controllerId, definition.cost),
            new Set(),
          ),
        )
      ) {
        continue;
      }
      const acting =
        controllerId ?? (trigger.firstPlayerOnly === true ? state.firstPlayerId : actingPlayerOf(event, trigger.on));
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId: acting, definition }, forced));
    }
  }
  found.push(...spentCardCandidates(state, deps, event, timing, forced));
  if (!forced) found.push(...inHandCandidates(state, deps, event, timing));
  return found;
}

/**
 * "After you spend this card" (docs/phase7-wave2.md §12): while a `resourcesSpent` event resolves, each card it spent
 * offers its own abilities on that event, although the card is already in its owner's discard pile. RRG 1.8 "Resource
 * Card" (p. 37): "Some resource cards have card text that is active while using the card to generate resources", and a
 * spent resource "is also considered to be spent by that player's identity", so the spender controls the ability.
 *
 * Only abilities that trigger on `resourcesSpent` with the card itself as the spent card (`selfIs: "source"`) come
 * alive this way — nothing else on a card in the discard pile does, so a spent card's other text stays inactive.
 */
function spentCardCandidates(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
  timing: WindowTiming,
  forced: boolean,
): readonly TriggerCandidate[] {
  if (event.kind !== "resourcesSpent") return [];
  const controllerId = event.playerId;
  const inPlay = new Set(cardsInPlay(state));
  const found: TriggerCandidate[] = [];
  for (const id of event.cardInstanceIds) {
    // A card that is somehow in play already had its abilities scanned above; never offer one twice.
    if (inPlay.has(id)) continue;
    for (const ref of activeAbilityRefs(state, id, deps)) {
      const definition = deps.abilities[ref.id];
      if (!definition) continue;
      const trigger = definition.trigger;
      if (trigger.kind !== timing || trigger.forced !== forced) continue;
      if (trigger.on.selfIs !== "source") continue;
      const kinds: readonly TriggerEvent["kind"][] =
        typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
      if (!kinds.includes("resourcesSpent")) continue;
      if (!formSatisfied(state, controllerId, trigger.form)) continue;
      if (limitReached(state, id, ref.id, definition, event, controllerId)) continue;
      if (!matchesPattern(state, trigger.on, event, id, deps, controllerId)) continue;
      if (
        definition.cost &&
        isPriceFault(
          planCost(
            state,
            deps,
            id,
            controllerId,
            definition.cost,
            defaultInPlayPicks(state, deps, id, controllerId, definition.cost),
            new Set(),
          ),
        )
      )
        continue;
      found.push(candidateOf({ instanceId: id, abilityId: ref.id, controllerId, definition }, forced));
    }
  }
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
      if (playRestrictionFault(state, deps, player.playerId, card, id)) continue;
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
  hasCandidates(state, deps, event, "interrupt") ||
  hasCandidates(state, deps, event, "response") ||
  eachTimeEffectsFor(state, deps, event).length > 0;

/**
 * The lasting "each time …" effects this event sets off (`LastingEffectBody eachTime`, docs/phase7-wave3.md §3.17), in
 * the order they were created. Each is matched with its scope's card as "self" and its controller as "you", which is
 * what an event card in its discard pile needs (Schadenfreude).
 */
export function eachTimeEffectsFor(
  state: GameState,
  deps: EngineDeps,
  event: TriggerEvent,
): readonly Extract<LastingEffect, { kind: "eachTime" }>[] {
  return state.lastingEffects.filter(
    (effect): effect is Extract<LastingEffect, { kind: "eachTime" }> =>
      effect.kind === "eachTime" &&
      effect.scope.selfInstanceId !== null &&
      matchesPattern(
        state,
        effect.on,
        event,
        effect.scope.selfInstanceId,
        deps,
        effect.scope.controllerId ?? undefined,
      ),
  );
}

export const hasCandidates = (state: GameState, deps: EngineDeps, event: TriggerEvent, timing: WindowTiming): boolean =>
  candidatesFor(state, deps, event, timing, true).length > 0 ||
  candidatesFor(state, deps, event, timing, false).length > 0;
