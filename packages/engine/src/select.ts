import type { AbilityReference, AnyCard, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  cardOf,
  characterProfile,
  getInstance,
  getPlayer,
  mainSchemeStage,
  playerOrder,
  villainStage,
} from "./query.js";
import type { Bindings } from "./stack.js";
import type { PlayerRef, Predicate, TargetCategory, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";
import { eventSubjects } from "./trigger-events.js";

/** Everything an effect needs to turn authoring-time refs into concrete ids. */
export interface EffectContext {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly event: TriggerEvent | null;
  readonly bindings: Bindings;
}

export function categoriesOf(state: GameState, id: InstanceId): readonly TargetCategory[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card) return [];
  const player = state.players.find((p) => p.identity.instanceId === id);
  if (card.type === "hero_identity" && player) {
    return player.identity.form === "hero"
      ? ["identity", "hero", "character"]
      : ["identity", "alterEgo", "character"];
  }
  switch (card.type) {
    case "ally":
      return ["ally", "character"];
    case "minion":
      return ["minion", "enemy", "character"];
    case "villain":
      return ["villain", "enemy", "character"];
    case "main_scheme":
      return ["mainScheme", "scheme"];
    case "side_scheme":
    case "player_side_scheme":
      return ["sideScheme", "scheme"];
    case "upgrade":
      return ["upgrade"];
    case "support":
      return ["support"];
    case "attachment":
      return ["attachment"];
    default:
      return [];
  }
}

function traitsOf(state: GameState, id: InstanceId): readonly Trait[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return player.identity.form === "hero" ? card.hero.traits : card.alterEgo.traits;
  }
  if (card.type === "villain") return villainStage(state).traits;
  if (card.type === "main_scheme") return mainSchemeStage(state).traits;
  return "traits" in card ? card.traits : [];
}

/** Every card instance that is in play, in a stable order (RRG "In Play and Out of Play"). */
export function cardsInPlay(state: GameState): readonly InstanceId[] {
  const ids: InstanceId[] = [state.villain.instanceId, state.mainScheme.instanceId];
  const withAttachments = (id: InstanceId): void => {
    ids.push(id);
    for (const attachment of getInstance(state, id)?.attachments ?? []) ids.push(attachment);
  };
  for (const attachment of getInstance(state, state.villain.instanceId)?.attachments ?? []) {
    ids.push(attachment);
  }
  for (const attachment of getInstance(state, state.mainScheme.instanceId)?.attachments ?? []) {
    ids.push(attachment);
  }
  for (const player of playerOrder(state)) {
    withAttachments(player.identity.instanceId);
    for (const id of player.playArea) withAttachments(id);
  }
  for (const id of state.villainArea) withAttachments(id);
  return ids;
}

export function matchesQuery(
  state: GameState,
  id: InstanceId,
  query: TargetQuery,
  context: EffectContext,
): boolean {
  const instance = getInstance(state, id);
  if (!instance) return false;
  if (query.self !== undefined) {
    const isSelf = context.selfInstanceId === id;
    if (query.self !== isSelf) return false;
  }
  if (query.categories) {
    const categories = categoriesOf(state, id);
    if (!query.categories.some((category) => categories.includes(category))) return false;
  }
  if (query.controller) {
    const controller = controllerOf(state, id);
    if (query.controller === "encounter" && controller !== null) return false;
    if (query.controller === "you" && controller !== context.controllerId) return false;
    if (query.controller === "other" && (controller === null || controller === context.controllerId)) {
      return false;
    }
  }
  if (query.engagedWith === "you" && instance.engagedWith !== context.controllerId) return false;
  if (query.engagedWith === "any" && instance.engagedWith === null) return false;
  if (query.trait && !traitsOf(state, id).includes(query.trait)) return false;
  if (query.exhausted !== undefined && instance.exhausted !== query.exhausted) return false;
  if (query.hasThreat !== undefined && instance.threat > 0 !== query.hasThreat) return false;
  if (query.damaged !== undefined && instance.damage > 0 !== query.damaged) return false;
  if (query.hasStatus && instance.statuses[query.hasStatus] <= 0) return false;
  if (query.maxPrintedHp !== undefined) {
    const card = cardOf(state, id);
    const hp = card && "hp" in card ? (card.hp as number) : undefined;
    if (hp === undefined || hp > query.maxPrintedHp) return false;
  }
  if (query.attackableBy) {
    const [attacker] = resolveRef(state, query.attackableBy, context);
    if (!attacker || !canAttack(state, attacker, id)) return false;
  }
  return true;
}

const guardEngagedWith = (state: GameState, playerId: PlayerId): boolean =>
  cardsInPlay(state).some(
    (id) =>
      cardOf(state, id)?.type === "minion" &&
      getInstance(state, id)?.engagedWith === playerId &&
      hasKeyword(state, id, "guard"),
  );

/**
 * RRG "Guard": while a minion with guard is engaged with a player, that player
 * cannot use cards they control to attack a villain without this keyword. It
 * restricts the *controller*, so it blocks that player's allies too, and it
 * only ever protects villains — other minions stay attackable. Ranged does not
 * bypass guard (RRG "Ranged" only ignores retaliate).
 */
export function canAttack(state: GameState, attackerId: InstanceId, targetId: InstanceId): boolean {
  const controller = controllerOf(state, attackerId);
  if (controller === null) return true;
  if (targetId !== state.villain.instanceId) return true;
  if (hasKeyword(state, targetId, "guard")) return true;
  return !guardEngagedWith(state, controller);
}

/** A minion's controller is null (it belongs to the encounter side) even while engaged. */
export function controllerOf(state: GameState, id: InstanceId): PlayerId | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const player = state.players.find((p) => p.identity.instanceId === id);
  if (player) return player.playerId;
  return instance.controllerId;
}

export const selectTargets = (
  state: GameState,
  query: TargetQuery,
  context: EffectContext,
): readonly InstanceId[] => cardsInPlay(state).filter((id) => matchesQuery(state, id, query, context));

export function resolvePlayers(
  state: GameState,
  ref: PlayerRef,
  context: EffectContext,
): readonly PlayerId[] {
  switch (ref.kind) {
    case "controller":
      return context.controllerId ? [context.controllerId] : [];
    case "eventPlayer": {
      const players = context.event ? eventSubjects(context.event).players : [];
      return players.slice(0, 1);
    }
    case "firstPlayer":
      return [state.firstPlayerId];
    case "each":
      return playerOrder(state).map((p) => p.playerId);
    case "id":
      return getPlayer(state, ref.playerId) ? [ref.playerId] : [];
  }
}

export function resolveRef(
  state: GameState,
  ref: TargetRef,
  context: EffectContext,
): readonly InstanceId[] {
  switch (ref.kind) {
    case "self":
      return context.selfInstanceId ? [context.selfInstanceId] : [];
    case "slot":
      return context.bindings[ref.slot] ?? [];
    case "eventSource":
      return context.event ? eventSubjects(context.event).sources : [];
    case "eventTarget":
      return context.event ? eventSubjects(context.event).targets : [];
    case "villain":
      return [state.villain.instanceId];
    case "mainScheme":
      return [state.mainScheme.instanceId];
    case "identityOf":
      return resolvePlayers(state, ref.player, context)
        .map((id) => getPlayer(state, id)?.identity.instanceId)
        .filter((id): id is InstanceId => id !== undefined);
  }
}

function eventAmount(event: TriggerEvent | null): number {
  if (!event) return 0;
  return "amount" in event ? event.amount : 0;
}

export function resolveValue(state: GameState, value: ValueSpec, context: EffectContext): number {
  switch (value.kind) {
    case "const":
      return value.value;
    case "perPlayer":
      return value.base + value.perPlayer * state.startingPlayerCount;
    case "stat": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      const profile = characterProfile(state, id);
      return profile ? profile[value.stat] : 0;
    }
    case "counters": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      return getInstance(state, id)?.counters[value.counterType] ?? 0;
    }
    case "eventAmount":
      return eventAmount(context.event);
  }
}

export function evaluate(state: GameState, predicate: Predicate, context: EffectContext): boolean {
  switch (predicate.kind) {
    case "form": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      const player = playerId ? getPlayer(state, playerId) : undefined;
      return player?.identity.form === predicate.form;
    }
    case "hasStatus": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? (getInstance(state, id)?.statuses[predicate.status] ?? 0) > 0 : false;
    }
    case "exists":
      return selectTargets(state, predicate.query, context).length > 0;
    case "counterAtLeast": {
      const [id] = resolveRef(state, predicate.of, context);
      const counters = id ? (getInstance(state, id)?.counters[predicate.counterType] ?? 0) : 0;
      return counters >= predicate.amount;
    }
    case "damagedAtLeast": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? (getInstance(state, id)?.damage ?? 0) >= predicate.amount : false;
    }
    case "not":
      return !evaluate(state, predicate.of, context);
  }
}

/** The ability slots that are live on a card right now (active identity face, current stage). */
export function activeAbilityRefs(state: GameState, id: InstanceId): readonly AbilityReference[] {
  const card = cardOf(state, id);
  if (!card) return [];
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return player.identity.form === "hero" ? card.hero.abilities : card.alterEgo.abilities;
  }
  if (card.type === "villain") {
    return id === state.villain.instanceId ? villainStage(state).abilities : [];
  }
  if (card.type === "main_scheme") {
    return id === state.mainScheme.instanceId ? mainSchemeStage(state).abilities : [];
  }
  return "abilities" in card ? card.abilities : [];
}

/** Ability slots printed on a card regardless of where the card is (for reveal/boost). */
export function printedAbilityRefs(card: AnyCard): readonly AbilityReference[] {
  if (card.type === "hero_identity") return [...card.hero.abilities, ...card.alterEgo.abilities];
  if (card.type === "villain") return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities));
  if (card.type === "main_scheme") return card.stages.flatMap((stage) => stage.abilities);
  return "abilities" in card ? card.abilities : [];
}

/** RRG "Restricted": the limit is two per *player*, across every card they control. */
export const restrictedCardsOf = (state: GameState, playerId: PlayerId): readonly InstanceId[] =>
  cardsInPlay(state).filter(
    (id) => controllerOf(state, id) === playerId && hasKeyword(state, id, "restricted"),
  );
