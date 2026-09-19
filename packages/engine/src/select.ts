import type { AbilityReference, AnyCard, Trait } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  activeVillain,
  cardOf,
  characterProfile,
  currentName,
  encounterFace,
  getInstance,
  getPlayer,
  handSize,
  isMinion,
  isVillain,
  mainSchemeStage,
  maxHitPoints,
  playerOrder,
  printedHandSize,
  textBoxBlank,
  undefeatedVillains,
  villainOf,
  villainStageOf,
} from "./query.js";
import { printedResources } from "./resources.js";
import { currentActivationFrameId, type Bindings, type Vars } from "./stack.js";
import type { LastingReach, LastingScope } from "./lasting.js";
import type { PlayerRef, Predicate, TargetCategory, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import { STATUS_NAMES, type GameState } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";
import { eventSubjects } from "./trigger-events.js";

/** Everything an effect needs to turn authoring-time refs into concrete ids. */
export interface EffectContext {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly event: TriggerEvent | null;
  readonly bindings: Bindings;
  /** Numbers bound by the ability's cost and earlier effects (see `ValueSpec` `var`). */
  readonly vars?: Vars;
  /** The ability registry, so granted keywords/traits and modified stats are seen. */
  readonly deps?: EngineDeps;
  /** "That player" inside `forEachPlayer`. */
  readonly scopedPlayerId?: PlayerId | null;
}

/** The context a lasting effect evaluates in: the ability that created it. */
export const lastingContext = (scope: LastingScope, deps: EngineDeps): EffectContext => ({
  selfInstanceId: scope.selfInstanceId,
  controllerId: scope.controllerId,
  event: null,
  bindings: scope.bindings,
  vars: scope.vars,
  deps,
});

/** Whether a lasting effect touches this card right now (fixed targets, or a live query). */
export function lastingReaches(state: GameState, effect: LastingReach & { readonly scope: LastingScope }, id: InstanceId, deps: EngineDeps): boolean {
  if (effect.targets) return effect.targets.includes(id);
  return effect.affects ? matchesQuery(state, id, effect.affects, lastingContext(effect.scope, deps)) : false;
}

/** The `enemyAttack` event frame slot a defense records its defender in (`resolve/enemy-activation.ts` `setDefender`). */
export const DEFENDER_SLOT = "defender";

export function categoriesOf(state: GameState, id: InstanceId): readonly TargetCategory[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card) return [];
  if (instance.facedownAs?.kind === "minion") return ["minion", "enemy", "character"];
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
    case "event":
      return ["event"];
    case "resource":
      return ["resource"];
    case "treachery":
      return ["treachery"];
    case "obligation":
      return ["obligation"];
    case "environment":
      return ["environment"];
    default:
      return [];
  }
}

function printedTraitsOf(state: GameState, id: InstanceId): readonly Trait[] {
  const card = cardOf(state, id);
  if (!card) return [];
  const facedown = getInstance(state, id)?.facedownAs;
  if (facedown) return facedown.traits;
  const face = encounterFace(state, id);
  if (face) return face.traits;
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return player.identity.form === "hero" ? card.hero.traits : card.alterEgo.traits;
  }
  if (card.type === "villain") return isVillain(state, id) ? villainStageOf(state, id).traits : [];
  if (card.type === "main_scheme") return mainSchemeStage(state).traits;
  return "traits" in card ? card.traits : [];
}

/** Printed traits plus traits gained from constant abilities and lasting effects (RRG "Gains"). */
export function traitsOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): readonly Trait[] {
  const traits = [...printedTraitsOf(state, id)];
  for (const effect of state.lastingEffects) {
    if (effect.kind === "traitGrant" && lastingReaches(state, effect, id, deps)) traits.push(effect.trait);
  }
  if (Object.keys(deps.abilities).length > 0) {
    for (const sourceId of cardsInPlay(state)) {
      for (const ref of activeAbilityRefs(state, sourceId)) {
        const definition = deps.abilities[ref.id];
        if (definition?.trigger.kind !== "constant" || !definition.trigger.traitGrants) continue;
        const context: EffectContext = { selfInstanceId: sourceId, controllerId: controllerOf(state, sourceId), event: null, bindings: {}, deps };
        for (const grant of definition.trigger.traitGrants) {
          if (grant.while && !evaluate(state, grant.while, context)) continue;
          // Trait grants can't depend on traits being granted: every trait filter here only sees printed traits (reading
          // granted traits would recurse back into this function).
          const { trait: requiredTrait, withoutTrait, anyTrait, ...rest } = grant.target;
          const printed = printedTraitsOf(state, id);
          const traitsMatch =
            (!requiredTrait || printed.includes(requiredTrait)) &&
            (!withoutTrait || !printed.includes(withoutTrait)) &&
            (!anyTrait || anyTrait.some((wanted) => printed.includes(wanted)));
          if (matchesQuery(state, id, rest, context) && traitsMatch) {
            traits.push(grant.trait);
          }
        }
      }
    }
  }
  return traits;
}

/** Every card instance that is in play, in a stable order (RRG "In Play and Out of Play"). */
export function cardsInPlay(state: GameState): readonly InstanceId[] {
  // A defeated villain's last stage is removed from the game (RRG 1.8 "Villain Defeat", p. 47), so it is out of play.
  const villains = undefeatedVillains(state).map((villain) => villain.instanceId);
  const ids: InstanceId[] = [...villains, state.mainScheme.instanceId];
  const withAttachments = (id: InstanceId): void => {
    ids.push(id);
    for (const attachment of getInstance(state, id)?.attachments ?? []) ids.push(attachment);
  };
  for (const villainId of villains) {
    for (const attachment of getInstance(state, villainId)?.attachments ?? []) ids.push(attachment);
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

/**
 * Which clause of a `TargetQuery` rejected a card.
 *
 * These are clause names, not player-facing copy: the engine has no wording for them (unlike `EngineError.message`,
 * which is written for exactly that), so a client keeps its own code→wording table. They exist so "why isn't that a
 * legal target?" can be answered by the filter that actually ran, rather than by a second implementation of it.
 */
export type QueryExclusion =
  | "unknownCard"
  | "wrongSelf"
  | "wrongCategory"
  | "wrongController"
  | "notEngagedWithYou"
  | "notEngaged"
  | "missingTrait"
  | "hasExcludedTrait"
  | "wrongName"
  | "wrongFacedown"
  | "notHostOfSelf"
  | "notAttachedToHost"
  | "wrongOwner"
  | "missingPrintedResource"
  | "wrongAspect"
  | "exhausted"
  | "ready"
  | "noThreat"
  | "hasThreat"
  | "notDamaged"
  | "damaged"
  | "missingStatus"
  | "hasStatus"
  | "printedHpTooHigh"
  | "printedCostTooHigh"
  | "cannotBeAttacked"
  | "alreadyChosen"
  | "notInSlot"
  | "wrongSignatureSideScheme"
  | "notEngagedWithPlayer"
  | "wrongIdentitySet";

/**
 * The single implementation of "does this card match this query?", reported as *which clause said no*.
 *
 * `matchesQuery` is this function asked whether it found anything, so the filter that selects targets and the
 * explanation of why a card was not selected can never drift apart (see `why-not.ts`). Clauses are checked in the
 * order they are written; the first one that rejects is the one reported.
 */
export function explainQuery(
  state: GameState,
  id: InstanceId,
  query: TargetQuery,
  context: EffectContext,
): QueryExclusion | null {
  const instance = getInstance(state, id);
  if (!instance) return "unknownCard";
  if (query.self !== undefined) {
    const isSelf = context.selfInstanceId === id;
    if (query.self !== isSelf) return "wrongSelf";
  }
  if (query.categories) {
    const categories = categoriesOf(state, id);
    if (!query.categories.some((category) => categories.includes(category))) return "wrongCategory";
  }
  if (query.controller) {
    const controller = controllerOf(state, id);
    if (query.controller === "encounter" && controller !== null) return "wrongController";
    if (query.controller === "you" && controller !== context.controllerId) return "wrongController";
    if (query.controller === "other" && (controller === null || controller === context.controllerId)) {
      return "wrongController";
    }
  }
  if (query.engagedWith === "you" && instance.engagedWith !== context.controllerId) return "notEngagedWithYou";
  if (query.engagedWith === "any" && instance.engagedWith === null) return "notEngaged";
  if (query.trait && !traitsOf(state, id, context.deps).includes(query.trait)) return "missingTrait";
  if (query.withoutTrait && traitsOf(state, id, context.deps).includes(query.withoutTrait)) return "hasExcludedTrait";
  if (query.anyTrait) {
    const traits = traitsOf(state, id, context.deps);
    if (!query.anyTrait.some((wanted) => traits.includes(wanted))) return "missingTrait";
  }
  // The name showing now: a facedown card has none; a villain or flipped card has its current face's.
  if (query.name !== undefined && currentName(state, id) !== query.name) return "wrongName";
  if (query.facedown !== undefined && (instance.facedownAs !== null) !== query.facedown) return "wrongFacedown";
  if (query.hostOfSelf !== undefined) {
    const host = context.selfInstanceId ? getInstance(state, context.selfInstanceId)?.attachedTo : null;
    if ((host === id) !== query.hostOfSelf) return "notHostOfSelf";
  }
  // "A Weapon upgrade **on your hero**": the candidate is attached to one of the cards the ref names. The mirror of
  // `hostOfSelf`, which asks whether the candidate *is* this card's host.
  if (query.host !== undefined) {
    const attachedTo = instance.attachedTo;
    if (attachedTo === null || !resolveRef(state, query.host, context).includes(attachedTo)) return "notAttachedToHost";
  }
  if (query.owner === "you" && instance.ownerId !== context.controllerId) return "wrongOwner";
  if (query.printedResource !== undefined) {
    const card = cardOf(state, id);
    if (!card || printedResources(card)[query.printedResource] <= 0) return "missingPrintedResource";
  }
  if (query.anyPrintedResource !== undefined) {
    const card = cardOf(state, id);
    const pool = card ? printedResources(card) : null;
    if (!pool || !query.anyPrintedResource.some((type) => pool[type] > 0)) return "missingPrintedResource";
  }
  if (query.aspect !== undefined) {
    const card = cardOf(state, id);
    // An identity-specific card may also print an aspect (Spider-Woman's Venom Blast: `printedAspect`,
    // docs/phase7-wave2.md §1.2); card effects asking for an aspect's cards count it.
    if (!card || !("aspect" in card) || (card.aspect !== query.aspect && card.printedAspect !== query.aspect)) return "wrongAspect";
  }
  if (query.exhausted !== undefined && instance.exhausted !== query.exhausted) return query.exhausted ? "ready" : "exhausted";
  if (query.hasThreat !== undefined && instance.threat > 0 !== query.hasThreat) return query.hasThreat ? "noThreat" : "hasThreat";
  if (query.damaged !== undefined && instance.damage > 0 !== query.damaged) return query.damaged ? "notDamaged" : "damaged";
  if (query.hasStatus && instance.statuses[query.hasStatus] <= 0) return "missingStatus";
  // "A status card in play": a character carrying at least one of any type (RRG 1.8 "Status Cards", p. 42 lists
  // exactly three). Counts the cards present, so a steady character's second stunned card still reads as "has one".
  if (query.hasAnyStatus !== undefined) {
    const any = STATUS_NAMES.some((status) => instance.statuses[status] > 0);
    if (any !== query.hasAnyStatus) return query.hasAnyStatus ? "missingStatus" : "hasStatus";
  }
  if (query.maxPrintedHp !== undefined) {
    const card = cardOf(state, id);
    const hp = card && "hp" in card ? (card.hp as number) : undefined;
    if (hp === undefined || hp > query.maxPrintedHp) return "printedHpTooHigh";
  }
  if (query.maxPrintedCost !== undefined) {
    const card = cardOf(state, id);
    const cost = card && "cost" in card ? card.cost : 0;
    const bound = typeof query.maxPrintedCost === "number" ? query.maxPrintedCost : resolveValue(state, query.maxPrintedCost, context);
    if (cost > bound) return "printedCostTooHigh";
  }
  if (query.attackableBy) {
    const [attacker] = resolveRef(state, query.attackableBy, context);
    if (!attacker || !canAttack(state, attacker, id, context.deps)) return "cannotBeAttacked";
  }
  if (query.excludeSlots?.some((slot) => (context.bindings[slot] ?? []).includes(id))) return "alreadyChosen";
  if (query.inSlot !== undefined && !(context.bindings[query.inSlot] ?? []).includes(id)) return "notInSlot";
  if (query.controlledBy) {
    const controller = controllerOf(state, id);
    if (controller === null || !resolvePlayers(state, query.controlledBy, context).includes(controller)) return "wrongController";
  }
  if (query.signatureSideScheme !== undefined && state.villains.some((villain) => villain.signatureSideSchemeId === id) !== query.signatureSideScheme) {
    return "wrongSignatureSideScheme";
  }
  if (query.engagedWithPlayer) {
    if (instance.engagedWith === null || !resolvePlayers(state, query.engagedWithPlayer, context).includes(instance.engagedWith)) return "notEngagedWithPlayer";
  }
  if (query.identitySetOf) {
    // RRG 1.8 "Identity-Specific Card" (p. 23): the set icon, carried as `aspect: "hero:<identity card id>"`.
    const card = cardOf(state, id);
    const aspect = card && "aspect" in card ? String(card.aspect) : null;
    const identities = resolvePlayers(state, query.identitySetOf, context).map((playerId) => getPlayer(state, playerId)?.identity.cardId);
    if (!aspect || !identities.some((cardId) => cardId !== undefined && aspect === `hero:${cardId}`)) return "wrongIdentitySet";
  }
  return null;
}

export const matchesQuery = (
  state: GameState,
  id: InstanceId,
  query: TargetQuery,
  context: EffectContext,
): boolean => explainQuery(state, id, query, context) === null;

const guardEngagedWith = (state: GameState, playerId: PlayerId, deps: EngineDeps): boolean =>
  cardsInPlay(state).some(
    (id) =>
      isMinion(state, id) &&
      getInstance(state, id)?.engagedWith === playerId &&
      hasKeyword(state, id, "guard", deps),
  );

/**
 * RRG "Guard": while a minion with guard is engaged with a player, that player
 * cannot use cards they control to attack a villain without this keyword. It
 * restricts the *controller*, so it blocks that player's allies too, and it
 * only ever protects villains — other minions stay attackable. Ranged does not
 * bypass guard (RRG "Ranged" only ignores retaliate). With several villains in
 * play it protects every one of them, not only the active villain (RRG 1.8
 * "Guard", p. 21: "The engaged player cannot attack any villain.").
 */
export function canAttack(state: GameState, attackerId: InstanceId, targetId: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean {
  const controller = controllerOf(state, attackerId);
  if (controller === null) return true;
  if (attackForbidden(state, targetId, deps)) return false;
  if (!isVillain(state, targetId)) return true;
  if (hasKeyword(state, targetId, "guard", deps)) return true;
  return !guardEngagedWith(state, controller, deps);
}

/** "Players cannot attack other villains" (Distracting Taunts): a constant `cannotAttack` rule in play matches the target. */
function attackForbidden(state: GameState, targetId: InstanceId, deps: EngineDeps): boolean {
  if (Object.keys(deps.abilities).length === 0) return false;
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const rule of trigger.rules ?? []) {
        if (rule.kind !== "cannotAttack") continue;
        const context: EffectContext = { selfInstanceId: sourceId, controllerId: controllerOf(state, sourceId), event: null, bindings: {}, deps };
        if (rule.while && !evaluate(state, rule.while, context)) continue;
        if (matchesQuery(state, targetId, rule.target, context)) return true;
      }
    }
  }
  return false;
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
    case "slot": {
      const ids = context.bindings[ref.slot] ?? [];
      return playerOrder(state)
        .filter((p) => ids.includes(p.identity.instanceId))
        .map((p) => p.playerId);
    }
    case "scoped":
      return context.scopedPlayerId ? [context.scopedPlayerId] : [];
    case "others": {
      const excluded = resolvePlayers(state, ref.of, context);
      return playerOrder(state)
        .map((p) => p.playerId)
        .filter((id) => !excluded.includes(id));
    }
    case "ownerOf": {
      const owners = resolveRef(state, ref.target, context)
        .map((id) => getInstance(state, id)?.ownerId ?? null)
        .filter((id): id is PlayerId => id !== null);
      return [...new Set(owners)];
    }
    case "engagedWith": {
      const engaged = resolveRef(state, ref.of, context)
        .map((id) => getInstance(state, id)?.engagedWith ?? null)
        .filter((id): id is PlayerId => id !== null);
      return [...new Set(engaged)];
    }
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
    case "host": {
      const host = context.selfInstanceId ? getInstance(state, context.selfInstanceId)?.attachedTo : null;
      return host ? [host] : [];
    }
    case "each":
      return selectTargets(state, ref.query, context);
    case "named": {
      // The current face only: a flipped Criminal Enterprise is no longer "Criminal Enterprise" (§3.4).
      const found = cardsInPlay(state).find((id) => currentName(state, id) === ref.name);
      return found ? [found] : [];
    }
    case "slot":
      return context.bindings[ref.slot] ?? [];
    case "eventSource":
      return context.event ? eventSubjects(context.event).sources : [];
    case "eventTarget":
      return context.event ? eventSubjects(context.event).targets : [];
    case "defendingCharacter": {
      // The stack is innermost-first, so a nested or queued attack names its own defender.
      const attack = state.stack.find((f) => f.kind === "event" && f.event.kind === "enemyAttack");
      if (attack?.kind !== "event") return [];
      const inPlay = cardsInPlay(state);
      return (attack.slots[DEFENDER_SLOT] ?? []).filter((id) => inPlay.includes(id));
    }
    case "villain": {
      // "The villain" is the active villain (The Wrecking Crew insert, "The Active Villain").
      const active = activeVillain(state);
      return active.defeated ? [] : [active.instanceId];
    }
    case "mainScheme":
      return [state.mainScheme.instanceId];
    case "identityOf":
      return resolvePlayers(state, ref.player, context)
        .map((id) => getPlayer(state, id)?.identity.instanceId)
        .filter((id): id is InstanceId => id !== undefined);
    case "villainOfSideScheme": {
      const schemes = resolveRef(state, ref.scheme, context);
      return undefeatedVillains(state)
        .filter((villain) => villain.signatureSideSchemeId !== null && schemes.includes(villain.signatureSideSchemeId))
        .map((villain) => villain.instanceId);
    }
    case "signatureSideSchemeOf": {
      const inPlay = cardsInPlay(state);
      return resolveRef(state, ref.villain, context).flatMap((id) => {
        const scheme = villainOf(state, id)?.signatureSideSchemeId;
        return scheme && inPlay.includes(scheme) ? [scheme] : [];
      });
    }
    case "attachmentsOf": {
      // "Each card attached here": in attachment order, out-of-play hosts included (nothing attaches out of play today).
      const attached = resolveRef(state, ref.of, context).flatMap((id) => getInstance(state, id)?.attachments ?? []);
      return ref.filter ? attached.filter((id) => matchesQuery(state, id, ref.filter as TargetQuery, context)) : attached;
    }
    case "superlative": {
      // Each candidate is measured with itself bound to `slot`, so the measure can read another card ("the villain
      // whose side scheme has the most threat"). Ties resolve to every tied card; see the `TargetRef` comment.
      const slot = ref.slot ?? "candidate";
      const candidates = resolveRef(state, ref.among, context).filter((id) => getInstance(state, id) !== undefined);
      if (candidates.length === 0) return [];
      const measured = candidates.map((id) => ({
        id,
        value: resolveValue(state, ref.measure, { ...context, bindings: { ...context.bindings, [slot]: [id] } }),
      }));
      const values = measured.map((entry) => entry.value);
      const best = ref.order === "highest" ? Math.max(...values) : Math.min(...values);
      const tied = measured.filter((entry) => entry.value === best).map((entry) => entry.id);
      return ref.ties === "first" ? tied.slice(0, 1) : tied;
    }
  }
}

function eventAmount(event: TriggerEvent | null): number {
  if (!event) return 0;
  return "amount" in event ? (event.amount ?? 0) : 0;
}

/** `deps` lets stat reads include constant and lasting modifiers ("damage equal to your hero's ATK" reads the modified ATK). */
export function resolveValue(
  state: GameState,
  value: ValueSpec,
  context: EffectContext,
  deps: EngineDeps = context.deps ?? DEFAULT_DEPS,
): number {
  switch (value.kind) {
    case "const":
      return value.value;
    case "perPlayer":
      return value.base + value.perPlayer * state.startingPlayerCount;
    case "stat": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      const profile = characterProfile(state, id, deps);
      return profile ? profile[value.stat] : 0;
    }
    case "counters": {
      const [id] = resolveRef(state, value.of, context);
      if (!id) return 0;
      return getInstance(state, id)?.counters[value.counterType] ?? 0;
    }
    case "eventAmount":
      return eventAmount(context.event);
    case "var":
      return context.vars?.[value.name] ?? 0;
    case "eventResult":
      return context.event?.results?.[value.key] ?? 0;
    case "scaled": {
      const base = resolveValue(state, value.value, context, deps);
      // A non-positive divisor is an authoring error (`@mc/cards`' validator rejects it); read it as 0, never NaN/Infinity.
      const divided = !value.divide
        ? base
        : value.divide.by > 0
          ? (value.divide.round === "up" ? Math.ceil : Math.floor)(base / value.divide.by)
          : 0;
      const scaled = divided * (value.times ?? 1) + (value.plus ?? 0);
      return value.max === undefined ? scaled : Math.min(value.max, scaled);
    }
    case "count":
      return selectTargets(state, value.query, { ...context, deps }).length;
    case "sum":
      return value.values.reduce((total, part) => total + resolveValue(state, part, context, deps), 0);
    case "countInRef": {
      const withDeps = { ...context, deps };
      return resolveRef(state, value.cards, withDeps).filter((id) => matchesQuery(state, id, value.query, withDeps)).length;
    }
    case "remainingHp": {
      const [id] = resolveRef(state, value.of, context);
      const max = id ? maxHitPoints(state, id, deps) : undefined;
      return id && max !== undefined ? Math.max(0, max - (getInstance(state, id)?.damage ?? 0)) : 0;
    }
    case "conditional":
      return evaluate(state, value.if, { ...context, deps })
        ? resolveValue(state, value.then, context, deps)
        : resolveValue(state, value.else, context, deps);
    case "damage": {
      const [id] = resolveRef(state, value.of, context);
      return id ? (getInstance(state, id)?.damage ?? 0) : 0;
    }
    case "threat": {
      const [id] = resolveRef(state, value.of, context);
      return id ? (getInstance(state, id)?.threat ?? 0) : 0;
    }
    case "boostIcons": {
      const [id] = resolveRef(state, value.of, context);
      const card = id ? cardOf(state, id) : undefined;
      return card && "boostIcons" in card ? card.boostIcons : 0;
    }
    case "handSize": {
      const [playerId] = resolvePlayers(state, value.player, context);
      if (!playerId) return 0;
      return value.printed ? printedHandSize(state, playerId) : handSize(state, playerId, deps);
    }
    case "resourceTypes": {
      const seen = new Set<string>();
      for (const id of resolveRef(state, value.cards, context)) {
        const card = cardOf(state, id);
        if (!card) continue;
        const pool = printedResources(card);
        for (const type of ["physical", "mental", "energy", "wild"] as const) if (pool[type] > 0) seen.add(type);
      }
      return seen.size;
    }
    case "handCount": {
      const [playerId] = resolvePlayers(state, value.player, context);
      return playerId ? (getPlayer(state, playerId)?.hand.length ?? 0) : 0;
    }
    case "distinctCardTypes": {
      const types = new Set<string>();
      for (const id of resolveRef(state, value.cards, context)) {
        const card = cardOf(state, id);
        if (card) types.add(card.type);
      }
      return types.size;
    }
    case "printedCost": {
      const [id] = resolveRef(state, value.of, context);
      const card = id ? cardOf(state, id) : undefined;
      return card && "cost" in card && typeof card.cost === "number" ? card.cost : 0;
    }
    case "villainStageNumber": {
      const [id] = value.of ? resolveRef(state, value.of, context) : [activeVillain(state).instanceId];
      return id && isVillain(state, id) ? villainStageOf(state, id).stageNumber : 0;
    }
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
    case "paidWith":
      return (context.vars?.[`paid.${predicate.resource}`] ?? 0) > 0 || (context.vars?.["paid.wild"] ?? 0) > 0;
    case "varAtLeast":
      return (context.vars?.[predicate.name] ?? 0) >= predicate.amount;
    case "and":
      return predicate.of.every((p) => evaluate(state, p, context));
    case "or":
      return predicate.of.some((p) => evaluate(state, p, context));
    case "eventResultAtLeast":
      return (context.event?.results?.[predicate.key] ?? 0) >= predicate.amount;
    case "hasTrait": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? traitsOf(state, id, context.deps).includes(predicate.trait) : false;
    }
    case "currentAttack": {
      const id = currentActivationFrameId(state.stack);
      const frame = id ? state.stack.find((f) => f.frameId === id) : undefined;
      return frame?.kind === "event" && (frame.vars[predicate.key] ?? 0) >= predicate.atLeast;
    }
    case "refMatches": {
      const inPlay = predicate.anywhere === true ? null : cardsInPlay(state);
      return resolveRef(state, predicate.ref, context).some(
        (id) => (inPlay === null || inPlay.includes(id)) && matchesQuery(state, id, predicate.query, context),
      );
    }
    case "gameStep":
      return state.step.phase === predicate.phase && (predicate.step === undefined || state.step.kind === predicate.step);
    case "isAttached": {
      const [id] = resolveRef(state, predicate.of, context);
      return id !== undefined && getInstance(state, id)?.attachedTo !== null && getInstance(state, id) !== undefined;
    }
    case "faceNamed": {
      const [id] = resolveRef(state, predicate.of, context);
      return id ? currentName(state, id) === predicate.name : false;
    }
    case "paidWithOnly": {
      const vars = context.vars ?? {};
      if ((vars["paid.total"] ?? 0) <= 0) return false;
      return (["physical", "mental", "energy"] as const).every((type) => type === predicate.resource || (vars[`paid.${type}`] ?? 0) === 0);
    }
    case "playedThisRound": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      return playerId !== undefined && (state.playedByPlayerThisRound[`${playerId}:${predicate.cardType}`] ?? 0) <= predicate.atMost;
    }
    case "compare": {
      const left = resolveValue(state, predicate.left, context);
      const right = resolveValue(state, predicate.right, context);
      if (predicate.op === "atLeast") return left >= right;
      if (predicate.op === "atMost") return left <= right;
      return left === right;
    }
  }
}

/** The ability slots that are live on a card right now (active identity face, current stage). */
export function activeAbilityRefs(state: GameState, id: InstanceId): readonly AbilityReference[] {
  const card = cardOf(state, id);
  if (!card) return [];
  // A facedown card's own text is blank while it is facedown, and so is a card whose text box is treated as blank.
  if (getInstance(state, id)?.facedownAs || textBoxBlank(state, id)) return [];
  const face = encounterFace(state, id);
  if (face) return face.abilities;
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return player.identity.form === "hero" ? card.hero.abilities : card.alterEgo.abilities;
  }
  if (card.type === "villain") {
    return isVillain(state, id) ? villainStageOf(state, id).abilities : [];
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
  if (card.type === "main_scheme") {
    return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities]);
  }
  return "abilities" in card ? card.abilities : [];
}

/** The A-side abilities of the main scheme's current stage (1A setup / NA When Revealed). */
export function mainSchemeASideRefs(state: GameState): readonly AbilityReference[] {
  return mainSchemeStage(state).aSide.abilities;
}

/** RRG "Restricted": the limit is two per *player*, across every card they control. */
export const restrictedCardsOf = (state: GameState, playerId: PlayerId, deps: EngineDeps = DEFAULT_DEPS): readonly InstanceId[] =>
  cardsInPlay(state).filter(
    (id) => controllerOf(state, id) === playerId && hasKeyword(state, id, "restricted", deps),
  );
