import type { AbilityReference, AnyCard, Trait } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps, type RuleSpec } from "./abilities.js";
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
  hasStarIcon,
  heroFacesOf,
  identityFace,
  isMinion,
  isVillain,
  mainSchemeStage,
  mainSchemeStageOf,
  mainSchemeStateOf,
  mainSchemeFor,
  activeVillainIdFor,
  areaOfCard,
  areaOfPlayer,
  maxHitPoints,
  playerOrder,
  printedHandSize,
  textBoxBlank,
  undefeatedVillains,
  villainOf,
  villainStageOf,
} from "./query.js";
import type { LogValue } from "./campaign.js";
import {
  campaignLogContains,
  campaignLogField,
  campaignLogIsSet,
  campaignLogNumber,
  campaignSeatNumber,
} from "./campaign-state.js";
import { boostIconsFor } from "./modifiers.js";
import { printedResources, RESOURCE_TYPES } from "./resources.js";
import { currentActivationFrameId, type Bindings, type Vars } from "./stack.js";
import type { LastingReach, LastingScope } from "./lasting.js";
import type { PlayerRef, Predicate, TargetCategory, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import { STATUS_NAMES, type GameAreaState, type GameState } from "./state.js";
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
export function lastingReaches(
  state: GameState,
  effect: LastingReach & { readonly scope: LastingScope },
  id: InstanceId,
  deps: EngineDeps,
): boolean {
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
    return player.identity.form === "hero" ? ["identity", "hero", "character"] : ["identity", "alterEgo", "character"];
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
    return identityFace(state, player).face.traits;
  }
  if (card.type === "villain") return isVillain(state, id) ? villainStageOf(state, id).traits : [];
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    return scheme ? mainSchemeStageOf(state, scheme).traits : [];
  }
  return "traits" in card ? card.traits : [];
}

/**
 * Printed traits plus traits gained from constant abilities and lasting effects (RRG "Gains").
 *
 * **A constant trait grant's own `while` and `target` are read against printed characteristics and lasting effects
 * only, never against traits (or keywords, or anything else) that constant abilities grant** — the same guard
 * `blankedByConstantRules` uses below, and for the same reason: a condition like "while you have the Giant trait"
 * (Yellowjacket 12027, Ant-Man's ally 13002) re-enters this function, which would otherwise recurse forever whatever
 * the board looks like, and two grants each conditional on the other's granted trait have no answer at all.
 *
 * The RRG does not settle this: "Modifiers" (p. 29) says a modified quantity is recalculated from its base value and
 * all active modifiers, with no rule for a modifier whose own condition depends on the result, and "Constant
 * Abilities" (p. 5) only says a conditional one is active "anytime the specific condition is met". So this is the
 * engine's reading, chosen because it terminates and because no answer depends on the order cards are visited (see
 * docs/phase7-wave2.md §17.5). It costs the cards that need it nothing: a three-sided identity prints Giant/Tiny on
 * its own hero face, so a form-conditional grant reads a printed trait.
 */
export function traitsOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): readonly Trait[] {
  const traits = [...printedTraitsOf(state, id)];
  for (const effect of state.lastingEffects) {
    if (effect.kind === "traitGrant" && lastingReaches(state, effect, id, deps)) traits.push(effect.trait);
  }
  if (Object.keys(deps.abilities).length > 0) {
    for (const sourceId of cardsInPlay(state)) {
      for (const ref of activeAbilityRefs(state, sourceId, deps)) {
        const definition = deps.abilities[ref.id];
        if (definition?.trigger.kind !== "constant" || !definition.trigger.traitGrants) continue;
        // `DEFAULT_DEPS`: printed characteristics only, so neither the condition nor the target query can re-enter
        // this function (a `while: hasTrait(...)`, a `target` that asks what a card may attack, …).
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: controllerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
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
            if (grant.trait) traits.push(grant.trait);
            if (grant.traitsOf) {
              const query = grant.traitsOf;
              for (const other of cardsInPlay(state)) {
                if (other !== id && matchesQuery(state, other, query, context))
                  traits.push(...printedTraitsOf(state, other));
              }
            }
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
  // Each separate game area's own main scheme stage (docs/phase7-wave2.md §3.1).
  for (const area of state.gameAreas) if (area.mainScheme) withAttachments(area.mainScheme.instanceId);
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
  | "wrongStarIcon"
  | "wrongUnique"
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
  | "wrongIdentitySet"
  | "notNemesisMinion"
  | "noSharedTrait"
  | "wrongEncounterSet"
  /** The card's title is not recorded in the campaign-log field the query names (`inCampaignLogField`). */
  | "notInCampaignLog"
  /** In a different separate game area from the effect's (docs/phase7-wave2.md §3.1). */
  | "otherGameArea";

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
  if (!inContextArea(state, id, context)) return "otherGameArea";
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
  // "If that card has a star icon (★) in the boost area" (Longshot, `wolv`). A printed fact (`hasStarIcon`), not a
  // read of the ability registry: see docs/phase7-wave2.md §18.6. RRG 1.8 "Boost, Boost Icon" (p. 11) — a star is not
  // a boost icon, so this clause says nothing about the card's pip count.
  if (query.starIcon !== undefined && hasStarIcon(state, id) !== query.starIcon) return "wrongStarIcon";
  // "Against a unique enemy" (Godslayer, `gam` 18018): the same printed-fact reading `unique.ts`'s `isUnique` uses
  // for the deckbuilding unique rule (RRG 1.8 "Unique", p. 46) — every hero identity is unique whether or not its
  // own card prints the icon. Read inline here (not `isUnique` itself) to avoid a `select.ts` ↔ `unique.ts` import
  // cycle (`unique.ts` already imports `cardsInPlay` from here).
  if (query.unique !== undefined) {
    const card = cardOf(state, id);
    const printedUnique = (card?.unique ?? false) || card?.type === "hero_identity";
    if (printedUnique !== query.unique) return "wrongUnique";
  }
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
    if (!card || !("aspect" in card) || (card.aspect !== query.aspect && card.printedAspect !== query.aspect))
      return "wrongAspect";
  }
  // "An aspect card": the OR of the four core aspects, read the same way `aspect` is.
  if (query.anyAspect !== undefined) {
    const card = cardOf(state, id);
    const aspects =
      card && "aspect" in card
        ? [String(card.aspect), ...(card.printedAspect === undefined ? [] : [String(card.printedAspect)])]
        : [];
    if (!query.anyAspect.some((wanted) => aspects.includes(wanted))) return "wrongAspect";
  }
  if (query.exhausted !== undefined && instance.exhausted !== query.exhausted)
    return query.exhausted ? "ready" : "exhausted";
  if (query.hasThreat !== undefined && instance.threat > 0 !== query.hasThreat)
    return query.hasThreat ? "noThreat" : "hasThreat";
  if (query.damaged !== undefined && instance.damage > 0 !== query.damaged)
    return query.damaged ? "notDamaged" : "damaged";
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
    const bound =
      typeof query.maxPrintedCost === "number"
        ? query.maxPrintedCost
        : resolveValue(state, query.maxPrintedCost, context);
    if (cost > bound) return "printedCostTooHigh";
  }
  if (query.attackableBy) {
    const [attacker] = resolveRef(state, query.attackableBy, context);
    if (!attacker || !canAttack(state, attacker, id, context.deps)) return "cannotBeAttacked";
  }
  if (query.excludeSlots?.some((slot) => (context.bindings[slot] ?? []).includes(id))) return "alreadyChosen";
  // "each *other* environment card in play": everything this ref names is out.
  if (query.excluding !== undefined && resolveRef(state, query.excluding, context).includes(id)) return "alreadyChosen";
  if (query.inSlot !== undefined && !(context.bindings[query.inSlot] ?? []).includes(id)) return "notInSlot";
  if (query.controlledBy) {
    const controller = controllerOf(state, id);
    if (controller === null || !resolvePlayers(state, query.controlledBy, context).includes(controller))
      return "wrongController";
  }
  if (
    query.signatureSideScheme !== undefined &&
    state.villains.some((villain) => villain.signatureSideSchemeId === id) !== query.signatureSideScheme
  ) {
    return "wrongSignatureSideScheme";
  }
  if (query.engagedWithPlayer) {
    if (
      instance.engagedWith === null ||
      !resolvePlayers(state, query.engagedWithPlayer, context).includes(instance.engagedWith)
    )
      return "notEngagedWithPlayer";
  }
  if (query.identitySetOf) {
    // RRG 1.8 "Identity-Specific Card" (p. 23): the set icon, carried as `aspect: "hero:<identity card id>"`.
    const card = cardOf(state, id);
    const aspect = card && "aspect" in card ? String(card.aspect) : null;
    const identities = resolvePlayers(state, query.identitySetOf, context).map(
      (playerId) => getPlayer(state, playerId)?.identity.cardId,
    );
    if (!aspect || !identities.some((cardId) => cardId !== undefined && aspect === `hero:${cardId}`))
      return "wrongIdentitySet";
  }
  if (query.nemesisMinionOf) {
    // RRG 1.8 "Nemesis Encounter Set" (p. 30): the minion belonging to that identity's nemesis set, designated by the
    // parenthetical text a set with several minions prints on one of them (the card data's `nemesisMinion` flag).
    const card = cardOf(state, id);
    if (!card || !("nemesisMinion" in card) || card.nemesisMinion !== true) return "notNemesisMinion";
    const sets = "encounterSetIds" in card ? card.encounterSetIds : [];
    const owned = resolvePlayers(state, query.nemesisMinionOf, context)
      .map((playerId) => getPlayer(state, playerId)?.identity.instanceId)
      .map((instanceId) => (instanceId === undefined ? undefined : cardOf(state, instanceId)))
      .map((identity) => (identity?.type === "hero_identity" ? identity.nemesisEncounterSetId : undefined));
    if (!owned.some((setId) => setId !== undefined && sets.includes(setId))) return "notNemesisMinion";
  }
  if (query.sharesTraitWith) {
    // "A card that shares a trait with your hero" (docs/phase7-wave2.md §20.1): both sides read live, so a granted
    // trait counts either way (RRG 1.8 "Gains", p. 21).
    const mine = traitsOf(state, id, context.deps);
    const theirs = new Set(
      resolveRef(state, query.sharesTraitWith, context).flatMap((other) => traitsOf(state, other, context.deps)),
    );
    if (!mine.some((trait) => theirs.has(trait))) return "noSharedTrait";
  }
  if (query.encounterSetOf) {
    // "A card from the <X> encounter set" (docs/phase7-wave2.md §20.2): read off card data, so it matches wherever
    // the card is — an encounter deck, a discard pile, set aside, in play.
    const sets = encounterSetsOf(state, id);
    if (sets.length === 0) return "wrongEncounterSet";
    const wanted = new Set(
      resolveRef(state, query.encounterSetOf, context).flatMap((other) => encounterSetsOf(state, other)),
    );
    if (!sets.some((setId) => wanted.has(setId))) return "wrongEncounterSet";
  }
  if (query.inCampaignLogField) {
    // "Each EXPERIMENTAL attachment recorded in the campaign log" (MC10 p. 7) as a filter. Membership only: the
    // `campaignLog` selector is where a title recorded twice names two cards (ruling June 2, 2026 (3) answer 3).
    const value = campaignFieldRead(state, query.inCampaignLogField, context);
    if (!campaignLogContains(value, instance.cardId)) return "notInCampaignLog";
  }
  return null;
}

/**
 * The campaign-log field an in-game read names: the shared one, or the column of the seat `seat` resolves to.
 *
 * Undefined when the game has no campaign, when the field is not in the frozen view, or when `seat` names nobody
 * seated in the campaign — every reader above treats all three the same way, as "nothing recorded".
 */
export function campaignFieldRead(
  state: GameState,
  spec: { readonly field: string; readonly seat?: PlayerRef },
  context: EffectContext,
): LogValue | undefined {
  if (!state.campaign) return undefined;
  const seatNumber = campaignSeatRead(state, spec, context);
  if (spec.seat && seatNumber === null) return undefined;
  return campaignLogField(state, spec.field, seatNumber);
}

/**
 * Whose column a campaign-log read or write addresses: the seat `seat` resolves to (the first, as every `PlayerRef`
 * used as a singular does), or null for the shared field and for a `seat` that names nobody.
 */
export function campaignSeatRead(
  state: GameState,
  spec: { readonly seat?: PlayerRef },
  context: EffectContext,
): number | null {
  if (!spec.seat) return null;
  const [playerId] = resolvePlayers(state, spec.seat, context);
  return playerId === undefined ? null : campaignSeatNumber(state, playerId);
}

/** The encounter sets a card belongs to (`encounterSetIds`); empty for a player card. */
function encounterSetsOf(state: GameState, id: InstanceId): readonly string[] {
  const card = cardOf(state, id);
  return card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
}

/**
 * The separate game area an effect resolves in (docs/phase7-wave2.md §3.1), or null for every area: the players share
 * one area, or the effect's card is area-neutral (an environment, the central stage). The Once and Future Kang insert:
 * "Cards and components in one game area cannot affect another game area (with the exception of the text on stage 2B)."
 *
 * The card resolving the effect decides when it is in an area; otherwise the player resolving it ("That player", then
 * the controller) does, which covers an encounter card revealed by a player and an ability of a card out of play.
 */
export function contextArea(state: GameState, context: EffectContext): GameAreaState | null {
  if (state.gameAreas.length === 0) return null;
  const self = context.selfInstanceId;
  if (self) {
    const area = areaOfCard(state, self);
    if (area) return area;
    if (cardsInPlay(state).includes(self)) return null;
  }
  const player = context.scopedPlayerId ?? context.controllerId;
  return player ? areaOfPlayer(state, player) : null;
}

/** Whether a card can be affected from the effect's area: same area, or either side is in every area. */
export function inContextArea(state: GameState, id: InstanceId, context: EffectContext): boolean {
  if (state.gameAreas.length === 0) return true;
  const area = contextArea(state, context);
  if (!area) return true;
  const cardArea = areaOfCard(state, id);
  return cardArea === null || cardArea.areaId === area.areaId;
}

export const matchesQuery = (state: GameState, id: InstanceId, query: TargetQuery, context: EffectContext): boolean =>
  explainQuery(state, id, query, context) === null;

/**
 * Rule restrictions from constant abilities in play ("cannot take damage",
 * "threat cannot be removed", ally limit, "must defend with an ally"). Like
 * modifiers, they are recomputed on every check (RRG "Constant Abilities").
 *
 * Lives here rather than in `rules.ts` (which is where every consumer of it lives) only so that `canAttack`, an
 * older and much more widely called resident of this module, can read rules through the same one scan as everything
 * else instead of its own hand-rolled copy that saw constant abilities but not lasting ones (docs/phase7-wave2.md
 * §25.2). `rules.ts` imports it straight back out.
 */
export interface ActiveRule<K extends RuleSpec["kind"]> {
  readonly rule: Extract<RuleSpec, { kind: K }>;
  readonly context: EffectContext;
  /** Who "you" is for a player-scoped rule (`rulePlayers`): the card's speaker, or a lasting effect's controller. */
  readonly speakerId: PlayerId | null;
  /**
   * `context` with "you" resolved to `speakerId` — the context a query that is part of a *player-scoped* restriction
   * reads, so the restricted player and the cards/targets the restriction names agree on who "you" is. A card whose
   * controller is a player resolves both identically; the two differ only for a card no player controls but that
   * still speaks to one (an obligation, an engaged minion), where the plain `context` has `controllerId: null` and a
   * `you` ref in the query would silently match nobody. docs/phase7-wave2.md §25.3.
   */
  readonly speakerContext: EffectContext;
}

/**
 * Every rule of this kind in force right now: from constant abilities on cards in play, **and** from
 * `ruleGrant` lasting effects (docs/phase7-wave2.md §22, "you cannot change form until your next turn ends").
 *
 * A lasting rule's source card is usually gone by the time it is read — both obligations that need this discard
 * themselves as they resolve — so its `speakerId` is the creating ability's own controller rather than anything
 * derived from the card's current position (RRG 1.8 "Lasting Effects", p. 26: a lasting effect keeps working
 * "whether or not the card that created the lasting effect is in play").
 */
export function activeRules<K extends RuleSpec["kind"]>(
  state: GameState,
  deps: EngineDeps,
  kind: K,
): readonly ActiveRule<K>[] {
  const found: ActiveRule<K>[] = [];
  const record = (rule: RuleSpec, context: EffectContext, speakerId: PlayerId | null) => {
    found.push({
      rule: rule as Extract<RuleSpec, { kind: K }>,
      context,
      speakerId,
      speakerContext: speakerId === context.controllerId ? context : { ...context, controllerId: speakerId },
    });
  };
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const rule of definition.trigger.rules ?? []) {
        if (rule.kind !== kind) continue;
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: controllerOf(state, sourceId),
          event: null,
          bindings: {},
          deps,
        };
        if ("while" in rule && rule.while && !evaluate(state, rule.while, context)) continue;
        record(rule, context, speakerOf(state, sourceId));
      }
    }
  }
  for (const effect of state.lastingEffects) {
    if (effect.kind !== "ruleGrant" || effect.rule.kind !== kind) continue;
    const context = lastingContext(effect.scope, deps);
    if ("while" in effect.rule && effect.rule.while && !evaluate(state, effect.rule.while, context)) continue;
    record(effect.rule, context, effect.scope.controllerId);
  }
  return found;
}

/**
 * Who "you" is for a player-scoped rule on a card: its controller, else the controller of the card it is attached to
 * (Media Coverage on your identity), else the player whose area it is in (an engaged minion, an obligation).
 *
 * RRG 1.8 "Obligation" (p. 30): "Abilities on obligations that use the words 'you' or 'your' apply only to the
 * player whose play area the obligation is in" — the third branch.
 */
export function speakerOf(state: GameState, sourceId: InstanceId | null): PlayerId | null {
  if (!sourceId) return null;
  const controller = controllerOf(state, sourceId);
  if (controller) return controller;
  const host = getInstance(state, sourceId)?.attachedTo;
  const hostController = host ? controllerOf(state, host) : null;
  if (hostController) return hostController;
  return state.players.find((p) => p.playArea.includes(sourceId))?.playerId ?? null;
}

/** The players a rule's `player` ref binds, with "you" read as the rule's speaker rather than the card's controller. */
export const rulePlayers = (
  state: GameState,
  rule: { readonly player: PlayerRef },
  active: Pick<ActiveRule<RuleSpec["kind"]>, "speakerContext">,
): readonly PlayerId[] => resolvePlayers(state, rule.player, active.speakerContext);

const guardEngagedWith = (state: GameState, playerId: PlayerId, deps: EngineDeps): boolean =>
  cardsInPlay(state).some(
    (id) =>
      isMinion(state, id) && getInstance(state, id)?.engagedWith === playerId && hasKeyword(state, id, "guard", deps),
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
export function canAttack(
  state: GameState,
  attackerId: InstanceId,
  targetId: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): boolean {
  const controller = controllerOf(state, attackerId);
  // An attack by an enemy is nobody's attack: neither guard nor a player-scoped `cannotAttack` (an `attacker`-scoped
  // one still can, and does apply to an enemy attacker — see `attackForbidden`).
  if (attackForbidden(state, attackerId, controller, targetId, deps)) return false;
  if (controller === null) return true;
  if (!isVillain(state, targetId)) return true;
  if (hasKeyword(state, targetId, "guard", deps)) return true;
  return !guardEngagedWith(state, controller, deps);
}

/**
 * A `cannotAttack` rule in force forbids this attack: "Players cannot attack other villains" (Distracting Taunts,
 * `twc` 07035 — no `player`, so the whole table) or "You cannot attack Kang" (Fear of Kang, `toafk` 11049 — a
 * `player`, so only them). docs/phase7-wave2.md §25. "Drax cannot attack minions" (`gam` 18019, docs/phase7-wave3.md
 * §3.26) is scoped by `attacker` instead — the attacking *character*, checked regardless of controller (so it
 * reaches an enemy's own attack too, unlike every `player`-scoped rule, which a controller-less attacker can never
 * match).
 *
 * `attackerPlayerId` is the **attacker's controller**, which is what "you cannot attack" restricts: RRG 1.8 "Guard"
 * (p. 21) equates "that player cannot use cards they control to attack a villain" with the constant ability "The
 * engaged player cannot attack any villain", so a player's allies attack on their behalf. It is deliberately not the
 * rule card's own controller, which for an obligation is nobody.
 */
function attackForbidden(
  state: GameState,
  attackerId: InstanceId,
  attackerPlayerId: PlayerId | null,
  targetId: InstanceId,
  deps: EngineDeps,
): boolean {
  return activeRules(state, deps, "cannotAttack").some((active) => {
    const { player, target, attacker } = active.rule;
    if (attacker && !matchesQuery(state, attackerId, attacker, active.speakerContext)) return false;
    if (player) {
      if (attackerPlayerId === null || !rulePlayers(state, { player }, active).includes(attackerPlayerId)) {
        return false;
      }
    }
    return matchesQuery(state, targetId, target, active.speakerContext);
  });
}

/** A minion's controller is null (it belongs to the encounter side) even while engaged. */
export function controllerOf(state: GameState, id: InstanceId): PlayerId | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const player = state.players.find((p) => p.identity.instanceId === id);
  if (player) return player.playerId;
  return instance.controllerId;
}

export const selectTargets = (state: GameState, query: TargetQuery, context: EffectContext): readonly InstanceId[] =>
  cardsInPlay(state).filter((id) => matchesQuery(state, id, query, context));

export function resolvePlayers(state: GameState, ref: PlayerRef, context: EffectContext): readonly PlayerId[] {
  switch (ref.kind) {
    case "controller":
      return context.controllerId ? [context.controllerId] : [];
    case "eventPlayer": {
      const players = context.event ? eventSubjects(context.event).players : [];
      return players.slice(0, 1);
    }
    case "firstPlayer":
      return [state.firstPlayerId];
    case "each": {
      // The Once and Future Kang insert, "Rules Clarifications": "'Each player' refers to each player in the same game
      // area" (docs/phase7-wave2.md §3.1).
      const area = contextArea(state, context);
      return playerOrder(state)
        .map((p) => p.playerId)
        .filter((id) => !area || area.playerIds.includes(id));
    }
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
    case "defeatingPlayer": {
      const event = context.event;
      if (event?.kind !== "schemeDefeated" && event?.kind !== "characterDefeated") return [];
      const player = event.defeatedByPlayerId ?? null;
      return player !== null && getPlayer(state, player) ? [player] : [];
    }
  }
}

export function resolveRef(state: GameState, ref: TargetRef, context: EffectContext): readonly InstanceId[] {
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
      // "The villain" is the active villain (The Wrecking Crew insert, "The Active Villain"); in a separate game area,
      // that area's (docs/phase7-wave2.md §3.1).
      const activeId = activeVillainIdFor(state, contextArea(state, context));
      const active = activeId ? villainOf(state, activeId) : undefined;
      return !active || active.defeated ? [] : [active.instanceId];
    }
    case "mainScheme": {
      // "The main scheme": this area's own stage, or the central one (`of: "central"`, "under stage 4A").
      const scheme = ref.of === "central" ? state.mainScheme : mainSchemeFor(state, contextArea(state, context));
      return scheme ? [scheme.instanceId] : [];
    }
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
      return ref.filter
        ? attached.filter((id) => matchesQuery(state, id, ref.filter as TargetQuery, context))
        : attached;
    }
    case "tuckedUnder": {
      // "Each face down Kang's Dominion under this stage": tucked cards are out of play, so only a ref finds them.
      const tucked = resolveRef(state, ref.of, context).flatMap((id) => getInstance(state, id)?.tucked ?? []);
      return ref.filter ? tucked.filter((id) => matchesQuery(state, id, ref.filter as TargetQuery, context)) : tucked;
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
      return resolveRef(state, value.cards, withDeps).filter((id) => matchesQuery(state, id, value.query, withDeps))
        .length;
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
    case "mainSchemeStageNumber":
      return mainSchemeStage(state).stageNumber;
    case "boostIcons": {
      // One counting function for every read (docs/phase7-wave2.md §3.6): printed icons plus boost icon modifiers.
      const [counted] = resolveRef(state, value.of, context);
      if (counted && context.deps) return boostIconsFor(state, context.deps, counted);
      const [id] = resolveRef(state, value.of, context);
      const card = id ? cardOf(state, id) : undefined;
      return card && "boostIcons" in card ? card.boostIcons : 0;
    }
    case "starIcons":
      // "For each star icon in the boost area discarded this way" (Slipping Sanity, `scw`). Independent of
      // `boostIcons`: RRG 1.8 "Boost, Boost Icon" (p. 11), "A star icon is not itself considered a boost icon". A
      // boost area carries at most one star, so each card adds 0 or 1; read wherever the cards are, since the pile
      // being counted is normally already in a discard pile by now.
      return resolveRef(state, value.cards, context).filter((id) => hasStarIcon(state, id)).length;
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
    case "scenarioAreaCount": {
      const ids = state.scenarioAreas?.[value.name] ?? [];
      const filter = value.filter;
      return filter ? ids.filter((id) => matchesQuery(state, id, filter, { ...context, deps })).length : ids.length;
    }
    case "dealtEncounterCount": {
      const [playerId] = resolvePlayers(state, value.player, context);
      return playerId ? (getPlayer(state, playerId)?.dealtEncounter.length ?? 0) : 0;
    }
    case "min":
      return Math.min(...value.values.map((part) => resolveValue(state, part, context, deps)));
    case "max":
      return Math.max(...value.values.map((part) => resolveValue(state, part, context, deps)));
    case "deckCount": {
      // The player deck only: a separate deck (`PlayerState.separateDecks`) is its own deck, not part of this one.
      const [playerId] = resolvePlayers(state, value.player, context);
      return playerId ? (getPlayer(state, playerId)?.deck.length ?? 0) : 0;
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
    case "totalPrintedCost":
      // Read wherever the cards are (tucked cards are out of play); a card with no printed cost adds 0.
      return resolveRef(state, value.cards, context).reduce((sum, id) => {
        const card = cardOf(state, id);
        return sum + (card && "cost" in card && typeof card.cost === "number" ? card.cost : 0);
      }, 0);
    case "totalPrintedResources": {
      // Printed icons only (RRG 1.8 "Printed", p. 35), read wherever the cards are — a card discarded to pay a cost
      // is already in the discard pile by the time the ability's effects resolve.
      const types = value.types ?? RESOURCE_TYPES;
      return resolveRef(state, value.cards, context).reduce((sum, id) => {
        const card = cardOf(state, id);
        if (!card) return sum;
        const pool = printedResources(card);
        return sum + types.reduce((total, type) => total + pool[type], 0);
      }, 0);
    }
    case "villainStageNumber": {
      const [id] = value.of
        ? resolveRef(state, value.of, context)
        : [activeVillainIdFor(state, contextArea(state, context)) ?? activeVillain(state).instanceId];
      return id && isVillain(state, id) ? villainStageOf(state, id).stageNumber : 0;
    }
    // A number the campaign recorded, read out of the frozen `GameState.campaign.log` (design §7.1). Not traced:
    // see `campaignLogRead` in `events.ts` for why a pure, re-entrant read must not emit.
    case "campaignLog":
      return campaignLogNumber(campaignFieldRead(state, value, context), value.of);
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
    case "currentActivationIs": {
      const id = currentActivationFrameId(state.stack);
      const frame = id ? state.stack.find((f) => f.frameId === id) : undefined;
      if (frame?.kind !== "event") return false;
      return predicate.activation === "attack"
        ? frame.event.kind === "enemyAttack"
        : frame.event.kind === "enemyScheme";
    }
    case "refMatches": {
      const inPlay = predicate.anywhere === true ? null : cardsInPlay(state);
      return resolveRef(state, predicate.ref, context).some(
        (id) => (inPlay === null || inPlay.includes(id)) && matchesQuery(state, id, predicate.query, context),
      );
    }
    case "gameStep":
      return (
        state.step.phase === predicate.phase && (predicate.step === undefined || state.step.kind === predicate.step)
      );
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
      return (["physical", "mental", "energy"] as const).every(
        (type) => type === predicate.resource || (vars[`paid.${type}`] ?? 0) === 0,
      );
    }
    case "playedThisTurn": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (playerId === undefined) return false;
      const played = state.playedThisTurn?.[playerId] ?? [];
      const matching = played.filter((id) => matchesQuery(state, id, predicate.cards, context)).length;
      return matching >= (predicate.atLeast ?? 1);
    }
    case "playedThisRound": {
      const [playerId] = resolvePlayers(state, predicate.player, context);
      if (playerId === undefined) return false;
      const played =
        predicate.cardType === undefined
          ? Object.entries(state.playedByPlayerThisRound)
              .filter(([key]) => key.startsWith(`${playerId}:`))
              .reduce((sum, [, count]) => sum + count, 0)
          : (state.playedByPlayerThisRound[`${playerId}:${predicate.cardType}`] ?? 0);
      return played <= predicate.atMost;
    }
    case "compare": {
      const left = resolveValue(state, predicate.left, context);
      const right = resolveValue(state, predicate.right, context);
      if (predicate.op === "atLeast") return left >= right;
      if (predicate.op === "atMost") return left <= right;
      return left === right;
    }
    case "gameAreasSplit":
      return state.gameAreas.length > 0;
    case "areaPlayersDefeated": {
      const area = contextArea(state, context);
      return area !== null && area.playerIds.every((id) => getPlayer(state, id)?.eliminated !== false);
    }
    case "campaignLog": {
      // Every condition given must hold; with none given the question is only "is the field there at all?", which
      // is how "if <field> is in the campaign log" reads when a box tracks a field's mere presence. A field the
      // frozen view does not carry reads as nothing recorded — so `isSet: false` holds for it, and nothing else does.
      if (!state.campaign) return false;
      const value = campaignFieldRead(state, predicate, context);
      if (predicate.has !== undefined && !campaignLogContains(value, predicate.has)) return false;
      if (predicate.atLeast !== undefined && campaignLogNumber(value, predicate.of) < predicate.atLeast) return false;
      if (predicate.isSet !== undefined && campaignLogIsSet(value) !== predicate.isSet) return false;
      const asked = predicate.has !== undefined || predicate.atLeast !== undefined || predicate.isSet !== undefined;
      return asked || value !== undefined;
    }
  }
}

/**
 * Class-wide text blanking: "Treat the printed text box of each [Tech] player card as if it were blank" (Tech Theft),
 * a constant `RuleSpec blankTextBox`. `textBoxBlank` (`query.ts`) covers the *lasting* kind, which is a fixed list of
 * instance ids and so needs no registry; a constant rule has to be found in play, which the naive version gets wrong
 * twice (docs/phase7-wave2.md §8):
 *
 * 1. **Recursion.** Finding the rule needs the in-play cards' live abilities, and matching its `{ trait: TECH }`
 *    target needs `traitsOf`, which needs them too. Both are cut the same way `traitsOf` already cuts trait grants:
 *    the scan below reads each source's refs with the *lasting* blank check only, and evaluates the rule's own
 *    `target`/`while` under `DEFAULT_DEPS`, so granted traits and keywords are never consulted. A blanking rule
 *    therefore cannot depend on another blanking rule, and the answer is a fixed point after one pass.
 * 2. **Cost.** `activeAbilityRefs` is the engine's hottest read, called once per in-play card inside `activeRules`,
 *    `traitsOf`, `grantedKeywords` and `statModifiers`, each of which runs per query candidate. Scanning the board
 *    on every lookup would make all of those quadratic. Two memos keep it O(1) amortized, both over **immutable
 *    inputs and never over game state the engine reads back**: which ability ids carry the rule (per `EngineDeps`,
 *    fixed for a whole game) and which cards are blanked (per `GameState`, which is replaced on every mutation and
 *    never edited in place). A registry with no such rule — Core, wave 1 and all of cycle 1 — short-circuits on the
 *    first `WeakMap` hit, so nothing that exists today pays anything at all.
 */
const NO_BLANKED: ReadonlySet<InstanceId> = new Set<InstanceId>();

/** Ability ids in this registry that carry a constant `blankTextBox` rule. Memoized per registry object. */
const BLANK_RULE_IDS = new WeakMap<EngineDeps, ReadonlySet<string>>();

function blankRuleIds(deps: EngineDeps): ReadonlySet<string> {
  const cached = BLANK_RULE_IDS.get(deps);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const [id, definition] of Object.entries(deps.abilities)) {
    if (
      definition.trigger.kind === "constant" &&
      (definition.trigger.rules ?? []).some((rule) => rule.kind === "blankTextBox")
    ) {
      ids.add(id);
    }
  }
  BLANK_RULE_IDS.set(deps, ids);
  return ids;
}

const BLANKED_BY_RULES = new WeakMap<GameState, WeakMap<EngineDeps, ReadonlySet<InstanceId>>>();

/**
 * Every card a constant `blankTextBox` rule in play treats as blank right now. A rule never blanks its own source
 * (that would erase the rule), and two rules blanking each other both apply — the scan reads printed refs, so the
 * answer does not depend on the order cards are visited.
 */
export function blankedByConstantRules(state: GameState, deps: EngineDeps): ReadonlySet<InstanceId> {
  const ruleIds = blankRuleIds(deps);
  if (ruleIds.size === 0) return NO_BLANKED;
  const perDeps = BLANKED_BY_RULES.get(state) ?? new WeakMap<EngineDeps, ReadonlySet<InstanceId>>();
  const cached = perDeps.get(deps);
  if (cached) return cached;
  const blanked = new Set<InstanceId>();
  const inPlay = cardsInPlay(state);
  for (const sourceId of inPlay) {
    for (const ref of activeAbilityRefs(state, sourceId)) {
      if (!ruleIds.has(ref.id)) continue;
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const rule of trigger.rules ?? []) {
        if (rule.kind !== "blankTextBox") continue;
        // `DEFAULT_DEPS`: printed characteristics only, so matching cannot re-enter this function.
        const context: EffectContext = {
          selfInstanceId: sourceId,
          controllerId: controllerOf(state, sourceId),
          event: null,
          bindings: {},
          deps: DEFAULT_DEPS,
        };
        if (rule.while && !evaluate(state, rule.while, context)) continue;
        for (const id of inPlay) {
          if (id !== sourceId && matchesQuery(state, id, rule.target, context)) blanked.add(id);
        }
      }
    }
  }
  perDeps.set(deps, blanked);
  BLANKED_BY_RULES.set(state, perDeps);
  return blanked;
}

/** Whether this card's printed text box is blank right now, from a lasting effect or a constant rule in play. */
export const textBoxBlankFor = (state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): boolean =>
  textBoxBlank(state, id) || blankedByConstantRules(state, deps).has(id);

/**
 * The ability slots that are live on a card right now (active identity face, current stage).
 *
 * `deps` is what makes a *constant* class-wide blank (Tech Theft) visible; without it only the lasting kind is seen,
 * which is what every caller that has no registry to hand wants. Passing it costs one `WeakMap` lookup in a game
 * whose card pool has no such rule.
 */
export function activeAbilityRefs(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly AbilityReference[] {
  const card = cardOf(state, id);
  if (!card) return [];
  // A facedown card's own text is blank while it is facedown, and so is a card whose text box is treated as blank.
  if (getInstance(state, id)?.facedownAs || textBoxBlankFor(state, id, deps)) return [];
  const face = encounterFace(state, id);
  if (face) return face.abilities;
  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return [];
    return identityFace(state, player).face.abilities;
  }
  if (card.type === "villain") {
    return isVillain(state, id) ? villainStageOf(state, id).abilities : [];
  }
  if (card.type === "main_scheme") {
    const scheme = mainSchemeStateOf(state, id);
    return scheme ? mainSchemeStageOf(state, scheme).abilities : [];
  }
  return "abilities" in card ? card.abilities : [];
}

/** Ability slots printed on a card regardless of where the card is (for reveal/boost). */
export function printedAbilityRefs(card: AnyCard): readonly AbilityReference[] {
  if (card.type === "hero_identity")
    return [...heroFacesOf(card).flatMap((face) => face.abilities), ...card.alterEgo.abilities];
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
export const restrictedCardsOf = (
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
): readonly InstanceId[] =>
  cardsInPlay(state).filter((id) => controllerOf(state, id) === playerId && hasKeyword(state, id, "restricted", deps));
