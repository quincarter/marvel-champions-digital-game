import type { AbilityTriggerSpec, ConsequentialDamageScope, EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import type { AnyCard, SchemeIcon } from "@mc/content";
import {
  areaOfCard,
  cardOf,
  currentName,
  encounterFace,
  getInstance,
  mainSchemeFor,
  mainSchemeStageOf,
  mainSchemeStates,
  minionsEngagedWith,
  sameGameArea,
  sharedMainSchemes,
  villainOf,
} from "./query.js";
import {
  activeAbilityRefs,
  activeRules,
  cardsInPlay,
  categoriesOf,
  focusedMainSchemeId,
  gliderMainSchemeId,
  contextArea,
  controllerOf,
  evaluate,
  isPlayerCard,
  matchesQuery,
  resolveRef,
  resolveValue,
  rulePlayers,
  textBoxBlankFor,
  timingWordOf,
  traitsOf,
  type ActiveRule,
  type EffectContext,
} from "./select.js";
import { combineRequirements, type ResolvedRequirement } from "./resources.js";
import type { AttackKeyword, CardDestination } from "./spec.js";
import type { Bindings, Vars } from "./stack.js";
import type { Form, GameAreaState, GameState } from "./state.js";
import type { TriggerEvent } from "./trigger-events.js";

/**
 * Whether a revealed encounter card's effects are beyond canceling: an "uncancellable" ability of its own ("This effect
 * cannot be canceled.", a player card revealed from the encounter deck), a `cannotBeCanceled` rule on the card itself
 * (read wherever the card is, since a revealed treachery is not in play), or one in play that matches it ("Treacheries
 * cannot be canceled."). docs/phase7-wave4.md §3.14.
 */
export function revealCannotBeCanceled(state: GameState, deps: EngineDeps, id: InstanceId): boolean {
  const own: EffectContext = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
  for (const ref of activeAbilityRefs(state, id, deps)) {
    const definition = deps.abilities[ref.id];
    if (!definition) continue;
    if (definition.uncancellable && definition.trigger.kind === "whenRevealed") return true;
    if (definition.trigger.kind !== "constant") continue;
    for (const rule of definition.trigger.rules ?? []) {
      if (rule.kind !== "cannotBeCanceled") continue;
      if (rule.while && !evaluate(state, rule.while, own)) continue;
      if (matchesQuery(state, id, rule.cards, own)) return true;
    }
  }
  return activeRules(state, deps, "cannotBeCanceled").some(({ rule, context }) =>
    matchesQuery(state, id, rule.cards, context),
  );
}

/** "X cannot take damage [while …] [from …]". `sources` are the damage's source and the card it came through. */
export function cannotTakeDamage(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  sources: readonly (InstanceId | null | undefined)[],
): boolean {
  return activeRules(state, deps, "cannotTakeDamage").some(({ rule, context }) => {
    if (!matchesQuery(state, targetId, rule.target, context)) return false;
    if (!rule.fromSource) return true;
    const query = rule.fromSource;
    return sources.some((id) => id !== null && id !== undefined && matchesQuery(state, id, query, context));
  });
}

/**
 * The card whose "Prevent all damage to X" constant (`RuleSpec preventAllDamage`, docs/phase7-wave4.md §3.20) covers
 * this target, or null: the first such rule in the order constants are read.
 */
export function damagePreventerOf(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  consequential?: ConsequentialDamage,
): InstanceId | null {
  const found = activeRules(state, deps, "preventAllDamage").find(
    ({ rule, context }) =>
      matchesQuery(state, targetId, rule.target, context) &&
      consequentialScopeMatches(state, rule.consequential, consequential, context),
  );
  return found ? found.context.selfInstanceId : null;
}

/**
 * An ally's consequential damage being applied (docs/phase7-wave6.md §3.31): the basic power it follows, and its
 * `dealDamage` frame's event, vars and slots, where that power reported its results (`attack.defeated`, slot
 * `attack.damaged`; `pushConsequentialDamage`). Absent for every other damage, so a rule scoped to consequential damage
 * never reaches it.
 */
export interface ConsequentialDamage {
  readonly from: "attack" | "thwart";
  readonly event: TriggerEvent;
  readonly vars: Vars;
  readonly slots: Bindings;
}

/** Whether a damage-taken rule's `consequential` scope (if any) covers this damage (`ConsequentialDamageScope`). */
function consequentialScopeMatches(
  state: GameState,
  scope: ConsequentialDamageScope | undefined,
  damage: ConsequentialDamage | undefined,
  context: EffectContext,
): boolean {
  if (!scope) return true;
  if (!damage) return false;
  if (scope.from !== "any" && scope.from !== damage.from) return false;
  if (!scope.if) return true;
  return evaluate(state, scope.if, {
    ...context,
    event: damage.event,
    vars: { ...context.vars, ...damage.vars },
    bindings: { ...context.bindings, ...damage.slots },
  });
}

/**
 * "Threat cannot be removed from this scheme" (Countdown to Oblivion); a `by: "thwart"` rule only stops a thwart.
 * `removerId` is the player attempting the removal (the thwart's player, else the removing card's controller; null
 * for a removal no player made) — read only by a rule that scopes itself with `player` ("Players other than Gamora
 * cannot remove threat from Sibling Rivalry", `gam` 18025, docs/phase7-wave3.md §3.26): such a rule blocks only a
 * removal whose `removerId` is one of `rulePlayers(rule.player)`, so a removal with no player is never blocked by a
 * scoped rule (there is nothing to compare) but is still blocked by an unscoped one, exactly as before this field.
 */
export const threatCannotBeRemoved = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  byThwart = false,
  removerId: PlayerId | null = null,
): boolean =>
  activeRules(state, deps, "threatCannotBeRemoved").some((active) => {
    const { rule, context } = active;
    if (rule.by === "thwart" && !byThwart) return false;
    if (!matchesQuery(state, schemeId, rule.target, context)) return false;
    if (!rule.player) return true;
    return removerId !== null && rulePlayers(state, { player: rule.player }, active).includes(removerId);
  });

/**
 * "While Baron Zemo is engaged with you, you cannot thwart." With `schemeId`, whether this player cannot thwart that
 * scheme: an unscoped rule, or one whose `schemes` matches it ("The engaged player cannot thwart side schemes", Life-Size
 * Decoy, `sm` 27142). Without it, whether they cannot thwart at all: only an unscoped rule says so.
 */
export const cannotThwart = (
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  schemeId?: InstanceId,
  /**
   * The thwarting character, for a rule scoped with `thwarter` ("Attached identity cannot thwart", docs/phase7-wave6.md
   * §3.77). Without it such a rule never applies: it restricts one character, never the player as a whole.
   */
  thwarterId?: InstanceId | null,
): boolean =>
  activeRules(state, deps, "cannotThwart").some((active) => {
    const { rule, speakerContext } = active;
    if (rule.schemes && (schemeId === undefined || !matchesQuery(state, schemeId, rule.schemes, speakerContext))) {
      return false;
    }
    if (rule.thwarter && (!thwarterId || !matchesQuery(state, thwarterId, rule.thwarter, speakerContext))) return false;
    if (rule.player) return rulePlayers(state, { player: rule.player }, active).includes(playerId);
    return true;
  });

/**
 * "Attached identity cannot … recover" (`RuleSpec cannotRecover`, docs/phase7-wave6.md §3.14): this player cannot make
 * a basic recovery.
 */
export const cannotRecover = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotRecover").some((active) =>
    rulePlayers(state, active.rule, active).includes(playerId),
  );

/**
 * "You take the first turn during the player phase" (`RuleSpec takesFirstTurn`, docs/phase7-wave6.md §3.27): the
 * player phase's turn order, `order` (the undefeated players in player order) with the rule's player moved to the front.
 * Two such players at once is not a case the card pool produces (Field Commander is Cyclops's alone); the one earliest
 * in player order would go first and the other keeps their place. A rule naming a player not in `order` (eliminated)
 * changes nothing.
 */
export function playerPhaseTurnOrder(
  state: GameState,
  deps: EngineDeps,
  order: readonly PlayerId[],
): readonly PlayerId[] {
  const named = new Set(
    activeRules(state, deps, "takesFirstTurn").flatMap((active) => rulePlayers(state, active.rule, active)),
  );
  const first = order.find((id) => named.has(id));
  return first === undefined || first === order[0] ? order : [first, ...order.filter((id) => id !== first)];
}

/**
 * The card's own "You cannot choose to discard this card from your hand" (`cannotChooseToDiscard` on a constant that works
 * in hand, docs/phase7-wave4.md §3.13).
 */
export function cannotChooseToDiscard(state: GameState, deps: EngineDeps, id: InstanceId): boolean {
  const card = cardOf(state, id);
  if (!card || !("abilities" in card)) return false;
  return card.abilities.some((ref) => {
    const definition = deps.abilities[ref.id];
    return (
      definition?.trigger.kind === "constant" &&
      definition.activeIn === "hand" &&
      (definition.trigger.rules ?? []).some((rule) => rule.kind === "cannotChooseToDiscard")
    );
  });
}

/**
 * An encounter card drawn from a player's deck that stays in the hand instead of the wave 5 §4.1 Q4 fallback
 * (`RuleSpec staysInHand`, docs/phase7-wave6.md §3.10): a rule in play or the scenario's whose `cards` matches it, or
 * the card's own hand-active constant (`activeIn: "hand"`), whose `cards` is read with the card itself as "this card".
 */
export function staysInHand(state: GameState, deps: EngineDeps, id: InstanceId): boolean {
  if (activeRules(state, deps, "staysInHand").some(({ rule, context }) => matchesQuery(state, id, rule.cards, context)))
    return true;
  const card = cardOf(state, id);
  if (!card || !("abilities" in card)) return false;
  const context: EffectContext = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
  return card.abilities.some((ref) => {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind !== "constant" || definition.activeIn !== "hand") return false;
    return (definition.trigger.rules ?? []).some(
      (rule) =>
        rule.kind === "staysInHand" &&
        (!rule.while || evaluate(state, rule.while, context)) &&
        matchesQuery(state, id, rule.cards, context),
    );
  });
}

/** A revealed environment goes to the revealer's play area (`entersRevealersPlayArea`, docs/phase7-wave4.md §3.16). */
export const entersRevealersPlayArea = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "entersRevealersPlayArea").some(({ rule, context }) =>
    matchesQuery(state, id, rule.cards, context),
  );

/** "If Odin leaves play, the players lose the game." (`leavingPlayLoses`, docs/phase7-wave4.md §3.8), read before it goes. */
export const leavingPlayLoses = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "leavingPlayLoses").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/**
 * Why `attachmentId` cannot attach to `hostId` under its own printed maximums, or null. RRG 1.8 "Max, Maximum" (p. 28):
 * "'Max 1 per [game element]' restricts the number of copies of that card that can be attached to each indicated game
 * element" (`maxPerHost`, copies by title), and "Max 1 TRAINING upgrade per ally" counts attachments with that trait,
 * printed or gained (`maxWithTrait` with `per: "host"`, docs/phase7-wave6.md §3.28). The card never counts against
 * itself, so an attached card re-checked on its own host is not refused. Checked wherever a host is chosen
 * (`attachmentHostCandidates`, the play command), so a put-into-play obeys it as a play does.
 */
export function attachLimitFault(
  state: GameState,
  deps: EngineDeps,
  hostId: InstanceId,
  attachmentId: InstanceId | null,
): string | null {
  if (attachmentId === null) return null;
  const card = cardOf(state, attachmentId);
  const restrictions = card && "playRestrictions" in card ? card.playRestrictions : undefined;
  if (!card || !restrictions) return null;
  const others = (getInstance(state, hostId)?.attachments ?? []).filter((id) => id !== attachmentId);
  const { maxPerHost, maxWithTrait } = restrictions;
  if (maxPerHost !== undefined && others.filter((id) => cardOf(state, id)?.name === card.name).length >= maxPerHost)
    return `max ${maxPerHost} per host`;
  if (
    maxWithTrait?.per === "host" &&
    others.filter((id) => traitsOf(state, id, deps).includes(maxWithTrait.trait)).length >= maxWithTrait.max
  )
    return `max ${maxWithTrait.max} ${maxWithTrait.trait} upgrade per host`;
  return null;
}

/**
 * Why `card` cannot be played or put into play under `controllerId` because of "Max 1 TEAM card per player"
 * (`maxWithTrait` with `per: "player"`, docs/phase7-wave6.md §3.28), or null. RRG 1.8 "Max, Maximum" (p. 28): "'Max 1
 * per player' is player specific, and restricts the number of copies of that card that each player may control in play
 * at a given time"; here the count is over every card in play that player controls with the trait, printed or gained,
 * other than `instanceId` itself.
 */
export function playerTraitLimitFault(
  state: GameState,
  deps: EngineDeps,
  controllerId: PlayerId,
  card: AnyCard,
  instanceId: InstanceId,
): string | null {
  const limit = "playRestrictions" in card ? card.playRestrictions?.maxWithTrait : undefined;
  if (limit?.per !== "player") return null;
  const held = cardsInPlay(state).filter(
    (id) =>
      id !== instanceId && controllerOf(state, id) === controllerId && traitsOf(state, id, deps).includes(limit.trait),
  ).length;
  return held >= limit.max ? `max ${limit.max} ${limit.trait} card per player` : null;
}

/**
 * Whether `hostId` may take `attachmentId` as an attachment (`cannotHaveAttachments`, docs/phase7-wave4.md §3.8). An
 * attachment is an encounter card when no player owns it, an upgrade when it is a player's upgrade.
 */
export function canHaveAttached(
  state: GameState,
  deps: EngineDeps,
  hostId: InstanceId,
  attachmentId: InstanceId | null,
): boolean {
  const attaching = attachmentId !== null ? getInstance(state, attachmentId) : undefined;
  const card = attachmentId !== null ? cardOf(state, attachmentId) : undefined;
  const encounter = attaching !== undefined && attaching.ownerId === null;
  const upgrade = card?.type === "upgrade";
  return !activeRules(state, deps, "cannotHaveAttachments").some(
    ({ rule, context }) =>
      (rule.from === undefined || (rule.from === "encounter" ? encounter : upgrade)) &&
      matchesQuery(state, hostId, rule.target, context),
  );
}

/**
 * The main scheme a villain's scheme activation places its threat on when a main scheme in play belongs to it
 * (`MainSchemeStage.villainOf`, "Proxima Midnight's Scheme."; MC21 p. 10: "When either of the two villains schemes, place
 * the threat on their matching main scheme card only"), and a minion's when a `focusedMainScheme` names one (errata, RRG
 * 1.8 p. 67). Null when neither applies: the enemy's ordinary main scheme. docs/phase7-wave4.md §3.2.
 */
export function pairedMainSchemeId(state: GameState, deps: EngineDeps, enemyId: InstanceId): InstanceId | null {
  if ((state.extraMainSchemes ?? []).length === 0) return null;
  if (villainOf(state, enemyId)) {
    const name = currentName(state, enemyId);
    const own = sharedMainSchemes(state).find((scheme) => mainSchemeStageOf(state, scheme).villainOf === name);
    // With no scheme of its own, the glider's (Venom Goblin, docs/phase7-wave5.md §3.3).
    return own?.instanceId ?? gliderMainSchemeId(state, deps);
  }
  return focusedMainSchemeId(state, deps);
}

/**
 * "You cannot change form." (no `formType`: the hero/alter-ego change) / "You cannot change energy forms." (`formType`
 * given: that additional form; docs/phase7-wave4.md §3.1). Each rule blocks only the kind of change it names.
 * `sourceInstanceId` is the card whose effect makes the change (an `exceptSource: "self"` rule lets its own card's through).
 */
export const cannotChangeForm = (
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  formType?: string,
  sourceInstanceId: InstanceId | null = null,
): boolean =>
  activeRules(state, deps, "cannotChangeForm").some(
    (active) =>
      active.rule.formType === formType &&
      !(
        active.rule.exceptSource === "self" &&
        sourceInstanceId !== null &&
        active.context.selfInstanceId === sourceInstanceId
      ) &&
      rulePlayers(state, active.rule, active).includes(playerId),
  );

/** "… cannot ready." */
/**
 * "… cannot ready" rules that stop this ready. `sourceInstanceId` is the card whose ability readies it (null for the
 * end-of-phase ready or when unknown): a `bySource: "playerCard"` rule stops only a ready a player card caused.
 */
export const cannotReady = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  sourceInstanceId: InstanceId | null = null,
): boolean =>
  activeRules(state, deps, "cannotReady").some(
    ({ rule, context }) =>
      (rule.bySource !== "playerCard" || isPlayerCard(state, sourceInstanceId)) &&
      matchesQuery(state, id, rule.target, context),
  );

/**
 * Whether a "cannot be healed" rule (`RuleSpec cannotBeHealed`, docs/phase7-wave6.md §3.12) stops this heal.
 * `sourceInstanceId` is the card whose ability (or cost, or basic power) heals it, null when no card does: a
 * `bySource: "playerCard"` rule stops only a heal a player card causes.
 */
export const cannotBeHealed = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  sourceInstanceId: InstanceId | null = null,
): boolean =>
  activeRules(state, deps, "cannotBeHealed").some(
    ({ rule, context }) =>
      (rule.bySource !== "playerCard" || isPlayerCard(state, sourceInstanceId)) &&
      matchesQuery(state, id, rule.target, context),
  );

/**
 * The resources `readierId` must spend to ready this card (`RuleSpec readyCost`, docs/phase7-wave4.md §3.19), every
 * applicable rule added together, or null when none applies.
 */
export function readyCostFor(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  readierId: PlayerId,
): ResolvedRequirement | null {
  let total: ResolvedRequirement | null = null;
  for (const active of activeRules(state, deps, "readyCost")) {
    const { rule, context } = active;
    if (!matchesQuery(state, id, rule.target, context)) continue;
    if (rule.player && !rulePlayers(state, { player: rule.player }, active).includes(readierId)) continue;
    total = combineRequirements(total ?? 0, rule.resources);
  }
  return total;
}

/**
 * The additional cost to thwart this scheme (`RuleSpec additionalThwartCost`, docs/phase7-wave5.md §3.21), every
 * applicable rule added together, or null when none applies.
 */
export function thwartCostFor(
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
): { readonly resources: ResolvedRequirement | null; readonly indirectDamage: number } | null {
  let resources: ResolvedRequirement | null = null;
  let indirectDamage = 0;
  let any = false;
  for (const { rule, context } of activeRules(state, deps, "additionalThwartCost")) {
    if (!matchesQuery(state, schemeId, rule.scheme, context)) continue;
    any = true;
    if (rule.resources) resources = combineRequirements(resources ?? 0, rule.resources);
    indirectDamage += rule.indirectDamage ?? 0;
  }
  return any ? { resources, indirectDamage } : null;
}

/** How many additional times this player resolves each When Revealed ability they reveal (Media Coverage). */
export const whenRevealedRepeats = (state: GameState, deps: EngineDeps, playerId: PlayerId): number =>
  activeRules(state, deps, "repeatWhenRevealed")
    .filter((active) => rulePlayers(state, active.rule, active).includes(playerId))
    .reduce((sum, { rule }) => sum + rule.times, 0);

/** RRG 1.8 "Ally Limit" (p. 7): "a maximum of three allies in play". */
export const BASE_ALLY_LIMIT = 3;

/**
 * RRG "Ally Limit": three, plus "increase your ally limit" abilities on cards that player controls. A rule's `while`
 * is read now, on every call, so a conditional increase (Avengers Tower) counts only while its condition holds.
 */
export const allyLimitFor = (state: GameState, deps: EngineDeps, playerId: PlayerId): number =>
  BASE_ALLY_LIMIT +
  activeRules(state, deps, "allyLimit")
    .filter(({ context }) => context.controllerId === playerId)
    .reduce((sum, { rule }) => sum + rule.amount, 0);

/** An ally that does not count against its controller's ally limit (`excludedFromAllyLimit`). */
export const excludedFromAllyLimit = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "excludedFromAllyLimit").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/**
 * The `AttackKeyword`s constant abilities in play grant to one attack (`attackKeywords`; Hawkeye's Bow). `viaId` is
 * the card whose ability is making the attack, or null for a basic attack; `basic` is whether the attack is a
 * character's basic attack (RRG 1.8 "Basic Power", p. 10), which an enemy activation is not.
 */
export function grantedAttackKeywords(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  viaId: InstanceId | null,
  basic = false,
): readonly AttackKeyword[] {
  const granted: AttackKeyword[] = [];
  for (const { rule, context } of activeRules(state, deps, "attackKeywords")) {
    if (rule.attacker && !matchesQuery(state, attackerId, rule.attacker, context)) continue;
    if (rule.via && (viaId === null || !matchesQuery(state, viaId, rule.via, context))) continue;
    // "Your *basic* attacks gain piercing": an attack made by a card's ability is not one, whoever makes it.
    if (rule.basicOnly === true && !basic) continue;
    for (const keyword of rule.keywords) if (!granted.includes(keyword)) granted.push(keyword);
  }
  return granted;
}

/** Whether a basic thwart against this scheme may use ATK instead of THW (`thwartWithAtk`). */
export const mayThwartWithAtk = (state: GameState, deps: EngineDeps, schemeId: InstanceId): boolean =>
  activeRules(state, deps, "thwartWithAtk").some(({ rule, context }) =>
    matchesQuery(state, schemeId, rule.scheme, context),
  );

/**
 * Whether `playerId` is forbidden to play this card (`cannotPlay`; Depowered, `toafk` 11020).
 *
 * `cards` is matched in the rule's **speaker** context, the same "you" its `player` field is resolved in: the two
 * clauses of one printed sentence ("*you* cannot play *your* hero-specific cards") have to agree on who "you" is.
 * On a player-controlled card the two contexts are identical; they differ only on a card no player controls — an
 * obligation, where `controllerId` is `null` and a `you` ref in `cards` used to match nobody, silently turning the
 * whole restriction off (RRG 1.8 "Obligation", p. 30; docs/phase7-wave2.md §25.3).
 */
export const cannotPlayCard = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotPlay").some(
    (active) =>
      rulePlayers(state, active.rule, active).includes(playerId) &&
      matchesQuery(state, id, active.rule.cards, active.speakerContext),
  );

/** Whether an action ability with this form label on this card cannot be triggered (`cannotTriggerActions`). */
export const cannotTriggerAction = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  form: Form | undefined,
): boolean =>
  activeRules(state, deps, "cannotTriggerActions").some(
    ({ rule, context }) => (rule.form === undefined || rule.form === form) && matchesQuery(state, id, rule.on, context),
  );

/**
 * Whether a triggered ability with this trigger, on this card, cannot be resolved (`cannotResolveTriggeredAbilities`;
 * Induced Panic). A trigger with no bold timing word (a constant, When Revealed, …) is never stopped. `rules` lets a
 * caller that checks many abilities read the active rules once.
 */
export function triggeredAbilityForbidden(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  trigger: AbilityTriggerSpec,
  rules: readonly ActiveRule<"cannotResolveTriggeredAbilities">[] = activeRules(
    state,
    deps,
    "cannotResolveTriggeredAbilities",
  ),
): boolean {
  if (rules.length === 0) return false;
  const word = timingWordOf(trigger);
  if (word === null) return false;
  return rules.some(({ rule, context }) => {
    if (rule.timings && !rule.timings.includes(word)) return false;
    if (rule.identityFace !== undefined) {
      const seat = state.players.find((p) => p.identity.instanceId === id);
      if (seat?.identity.form !== rule.identityFace) return false;
    }
    return matchesQuery(state, id, rule.on, context);
  });
}

/**
 * Where a defeated card goes instead of its discard pile, from a constant rule (docs/phase7-wave3.md §3.45): the first
 * matching `defeatDestination`, else `"encounterDeckShuffle"` for the older `defeatedIntoEncounterDeck` (Time Portal),
 * else null (the discard pile). An interrupt's `setDefeatDestination` on the defeat event itself wins over both.
 */
export function defeatDestinationRule(state: GameState, deps: EngineDeps, id: InstanceId): CardDestination | null {
  const general = activeRules(state, deps, "defeatDestination").find(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );
  if (general) return general.rule.to;
  const intoDeck = activeRules(state, deps, "defeatedIntoEncounterDeck").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );
  return intoDeck ? "encounterDeckShuffle" : null;
}

/** Whether this character may divide its basic `power` among several targets (`divideBasicPower`). */
export const canDivideBasicPower = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  power: "attack" | "thwart",
): boolean =>
  activeRules(state, deps, "divideBasicPower").some(
    ({ rule, context }) => rule.power === power && matchesQuery(state, id, rule.target, context),
  );

/** "This card cannot leave play while …" (`cannotLeavePlay`). */
export const cannotLeavePlay = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotLeavePlay").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/**
 * Whether the card being revealed right now gains surge from a `firstRevealGainsSurge` rule (docs/phase7-wave3.md
 * §3.8). Call it before the reveal is recorded in `revealedThisRound`: the history is every earlier reveal.
 */
export function firstRevealGainsSurge(
  state: GameState,
  deps: EngineDeps,
  revealedId: InstanceId,
  revealerId: PlayerId,
): boolean {
  const phase = state.step.phase;
  const history = state.revealedThisRound ?? [];
  return activeRules(state, deps, "firstRevealGainsSurge").some((active) => {
    const { rule, context } = active;
    if (!matchesQuery(state, revealedId, rule.cards, context)) return false;
    const revealers = rule.revealer ? rulePlayers(state, { player: rule.revealer }, active) : null;
    if (revealers && !revealers.includes(revealerId)) return false;
    return !history.some(
      (earlier) =>
        (rule.each === "round" || earlier.phase === phase) &&
        (!revealers || revealers.includes(earlier.playerId)) &&
        matchesQuery(state, earlier.instanceId, rule.cards, context),
    );
  });
}

/**
 * The damage a character takes from one damage event once constant reductions and caps apply (`reduceDamageTaken`,
 * `maxDamageTakenPerAttack`; docs/phase7-wave3.md §3.15). Reductions first, then the lowest cap: a cap is the last word
 * on what one attack can make the character take (§4 Q9). Last of all, `maxSustainedDamage` (docs/phase7-wave6.md
 * §3.3) and a per-phase cap (§3.4) hold it to what they still allow (`damageTakenAllowance`).
 */
export function damageTakenAfterConstants(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  amount: number,
  fromAttack: boolean,
  consequential?: ConsequentialDamage,
): number {
  const uncapped = damageTakenBeforeSustainedCap(state, deps, targetId, amount, fromAttack, consequential);
  const allowance = damageTakenAllowance(state, deps, targetId);
  return allowance === null ? uncapped : Math.min(uncapped, allowance);
}

/**
 * How much more damage this character can take right now under the caps that hold back damage without preventing it
 * (docs/phase7-wave6.md §4.1 Q9): `maxSustainedDamage` (§3.3) and a per-phase `maxDamageTakenPerAttack` (§3.4). The
 * lowest wins; null when neither applies.
 */
export function damageTakenAllowance(state: GameState, deps: EngineDeps, targetId: InstanceId): number | null {
  const sustained = sustainedDamageAllowance(state, deps, targetId);
  const phase = phaseDamageAllowance(state, deps, targetId);
  if (sustained === null) return phase;
  return phase === null ? sustained : Math.min(sustained, phase);
}

/**
 * How much more damage this character can take this phase under the lowest `maxDamageTakenPerAttack` with `per:
 * "phase"` ("Nimrod cannot take more than 3 damage each phase", docs/phase7-wave6.md §3.4), from its
 * `damageTakenThisPhase`; null when no such rule applies.
 */
export function phaseDamageAllowance(state: GameState, deps: EngineDeps, targetId: InstanceId): number | null {
  let cap: number | null = null;
  for (const { rule, context } of activeRules(state, deps, "maxDamageTakenPerAttack")) {
    if (rule.per !== "phase" || !matchesQuery(state, targetId, rule.target, context)) continue;
    cap = cap === null ? rule.amount : Math.min(cap, rule.amount);
  }
  if (cap === null) return null;
  return Math.max(0, cap - (getInstance(state, targetId)?.damageTakenThisPhase ?? 0));
}

/**
 * The lowest `maxSustainedDamage` cap on this character right now ("Magneto cannot have more than 6[per_hero]
 * sustained damage", docs/phase7-wave6.md §3.3), or null when none applies. Each amount is read from its own card.
 */
export function maxSustainedDamageOf(state: GameState, deps: EngineDeps, targetId: InstanceId): number | null {
  let cap: number | null = null;
  for (const { rule, context } of activeRules(state, deps, "maxSustainedDamage")) {
    if (!matchesQuery(state, targetId, rule.target, context)) continue;
    const amount = Math.max(0, resolveValue(state, rule.amount, context, deps));
    cap = cap === null ? amount : Math.min(cap, amount);
  }
  return cap;
}

/**
 * How much more damage this character can take before `maxSustainedDamage` stops it (never below 0, so a character
 * already above the cap takes nothing and is not healed), or null when no cap applies. Sustained damage is `damage`
 * (RRG 1.8 "Sustained Damage", p. 42: maximum minus remaining hit points, or the damage tokens).
 */
export function sustainedDamageAllowance(state: GameState, deps: EngineDeps, targetId: InstanceId): number | null {
  const cap = maxSustainedDamageOf(state, deps, targetId);
  if (cap === null) return null;
  const instance = getInstance(state, targetId);
  return Math.max(0, cap - (instance?.damage ?? 0));
}

/**
 * `damageTakenAfterConstants` without `damageTakenAllowance` (the sustained and per-phase caps): what the character
 * would take with every reduction, increase and per-attack cap applied. The difference is damage that is dealt but
 * neither taken nor prevented (docs/phase7-wave6.md §4.1 Q9), which `applyDamage` reports as `damageCapped`.
 */
export function damageTakenBeforeSustainedCap(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  amount: number,
  fromAttack: boolean,
  consequential?: ConsequentialDamage,
): number {
  let taken = amount;
  // "Increase all damage Venom takes by 1" (docs/phase7-wave5.md §3.8), summed with the reductions (RRG 1.8
  // "Modifiers", p. 29); a damage event of nothing stays nothing. A rule scoped to consequential damage ("Cannonball
  // takes -1 consequential damage", docs/phase7-wave6.md §3.31) reaches only that.
  if (amount > 0) {
    for (const { rule, context } of activeRules(state, deps, "increaseDamageTaken")) {
      if (rule.fromAttack === true && !fromAttack) continue;
      if (!matchesQuery(state, targetId, rule.target, context)) continue;
      if (consequentialScopeMatches(state, rule.consequential, consequential, context)) taken += rule.amount;
    }
  }
  for (const { rule, context } of activeRules(state, deps, "reduceDamageTaken")) {
    if (rule.fromAttack === true && !fromAttack) continue;
    if (!matchesQuery(state, targetId, rule.target, context)) continue;
    if (consequentialScopeMatches(state, rule.consequential, consequential, context)) taken -= rule.amount;
  }
  if (fromAttack) {
    for (const { rule, context } of activeRules(state, deps, "maxDamageTakenPerAttack")) {
      if (rule.per === "phase") continue;
      if (matchesQuery(state, targetId, rule.target, context)) taken = Math.min(taken, rule.amount);
    }
  }
  return Math.max(0, taken);
}

/** Whether this enemy's attacks deal indirect damage (`attacksDealIndirectDamage`; docs/phase7-wave3.md §3.16). */
export const attacksDealIndirectDamage = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "attacksDealIndirectDamage").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );

/** Whether this enemy's attacks are divided evenly among the target player's characters (`attacksDividedEvenly`). */
export const attacksDividedEvenly = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "attacksDividedEvenly").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );

/** The excess damage an attack by this character adds (`excessDamageBonus`; docs/phase7-wave3.md §3.18). */
export const excessDamageBonus = (state: GameState, deps: EngineDeps, attackerId: InstanceId): number =>
  activeRules(state, deps, "excessDamageBonus")
    .filter(({ rule, context }) => matchesQuery(state, attackerId, rule.attacker, context))
    .reduce((sum, { rule }) => sum + rule.amount, 0);

/** "The Power Stone cannot be unattached from Ronan the Accuser." (`cannotBeUnattached`; docs/phase7-wave3.md §3.19). */
export const cannotBeUnattached = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotBeUnattached").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/** Where `discardRedirectArea` sends a card, and the follow-up (if any) that redirect itself carries. */
export interface DiscardRedirect {
  readonly area: string;
  /** Collector III's "…, then place 1 threat on the main scheme" (`thenPlaceThreat`, docs/phase7-wave3.md §3.14). */
  readonly thenPlaceThreat?: number;
  readonly sourceInstanceId: InstanceId | null;
}

/** The scenario area a card discarded from play goes to instead, or null (`discardFromPlayDestination`; §3.14). */
export function discardRedirectArea(state: GameState, deps: EngineDeps, id: InstanceId): DiscardRedirect | null {
  const match = activeRules(state, deps, "discardFromPlayDestination").find(({ rule, context }) =>
    matchesQuery(state, id, rule.cards, context),
  );
  if (!match) return null;
  return {
    area: match.rule.area,
    ...(match.rule.thenPlaceThreat !== undefined ? { thenPlaceThreat: match.rule.thenPlaceThreat } : {}),
    sourceInstanceId: match.context.selfInstanceId,
  };
}

/** The main scheme a redirect's follow-up threat lands on: the redirecting rule's own game area's stage. */
export function mainSchemeForRedirect(
  state: GameState,
  deps: EngineDeps,
  redirect: DiscardRedirect,
): InstanceId | null {
  const context: EffectContext = {
    selfInstanceId: redirect.sourceInstanceId,
    controllerId: null,
    event: null,
    bindings: {},
    deps,
  };
  return mainSchemeFor(state, contextArea(state, context))?.instanceId ?? null;
}

/** RRG 1.8 "Restricted" (p. 38): "A player cannot have more than two cards with the restricted keyword in play". */
export const BASE_RESTRICTED_LIMIT = 2;

/**
 * How many restricted cards `playerId` may control if they held exactly `held` (docs/phase7-wave3.md §3.22): two, plus
 * each `restrictedLimit` rule for that player — a rule with `cards` adds room only for as many of `held` as match it.
 */
export function restrictedLimitFor(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  held: readonly InstanceId[],
): number {
  let limit = BASE_RESTRICTED_LIMIT;
  for (const active of activeRules(state, deps, "restrictedLimit")) {
    const { rule, context } = active;
    const players = rule.player ? rulePlayers(state, { player: rule.player }, active) : [active.speakerId];
    if (!players.includes(playerId)) continue;
    const cards = rule.cards;
    limit += cards
      ? Math.min(rule.amount, held.filter((id) => matchesQuery(state, id, cards, context)).length)
      : rule.amount;
  }
  return limit;
}

/** "Ronan the Accuser cannot be stunned." (`cannotHaveStatus`; docs/phase7-wave3.md §3.7). */
/**
 * "Armadillo can have any number of tough status cards." / "Colossus can have 1 additional tough status card."
 * (`statusLimit`, docs/phase7-wave5.md §3.19, docs/phase7-wave6.md §3.7): the largest `max` among the matching rules,
 * `Infinity` for "unlimited", or `undefined` when none matches (the RRG's one of each applies).
 */
export function statusLimit(state: GameState, deps: EngineDeps, id: InstanceId, status: "tough"): number | undefined {
  let limit: number | undefined;
  for (const { rule, context } of activeRules(state, deps, "statusLimit")) {
    if (rule.status !== status || !matchesQuery(state, id, rule.target, context)) continue;
    const max = rule.max === "unlimited" ? Number.POSITIVE_INFINITY : rule.max;
    limit = limit === undefined ? max : Math.max(limit, max);
  }
  return limit;
}

export const cannotHaveStatus = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  status: "stunned" | "confused" | "tough",
): boolean =>
  activeRules(state, deps, "cannotHaveStatus").some(
    ({ rule, context }) => rule.statuses.includes(status) && matchesQuery(state, id, rule.target, context),
  );

/**
 * RRG 1.8 "Patrol" (p. 32): "While a minion with the patrol keyword is engaged with a player, that player cannot use
 * cards they control to thwart the main scheme" (docs/phase7-wave3.md §3.5).
 */
export const patrolledBy = (state: GameState, deps: EngineDeps, playerId: PlayerId): InstanceId | null =>
  minionsEngagedWith(state, playerId).find((id) => hasKeyword(state, id, "patrol", deps)) ?? null;

/** "X cannot be defeated" (`cannotBeDefeated`; docs/phase7-wave3.md §3.1). */
export const cannotBeDefeated = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotBeDefeated").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/** A side scheme at no threat that is not defeated for it (`notDefeatedWithoutThreat`; signature side schemes). */
export const notDefeatedWithoutThreat = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "notDefeatedWithoutThreat").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/** Where a scheme activation by this enemy places its threat instead of the main scheme (`schemeThreatDestination`), or null. */
export function schemeThreatDestination(state: GameState, deps: EngineDeps, enemyId: InstanceId): InstanceId | null {
  const redirected = activeRules(state, deps, "schemeThreatDestination").some(({ rule, context }) =>
    matchesQuery(state, enemyId, rule.enemy, context),
  );
  if (!redirected) return null;
  const scheme = villainOf(state, enemyId)?.signatureSideSchemeId ?? null;
  return scheme !== null && cardsInPlay(state).includes(scheme) ? scheme : null;
}

/**
 * The schemes that receive excess damage dealt by `sourceId` as threat (`excessDamageAsThreat`), in play, each once:
 * two rules naming the same scheme still place the same excess damage there only once, since it is one amount of
 * damage being converted, not one per rule.
 */
export function excessDamageThreatSchemes(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId | null,
): readonly InstanceId[] {
  if (sourceId === null) return [];
  const inPlay = cardsInPlay(state);
  const schemes: InstanceId[] = [];
  for (const { rule, context } of activeRules(state, deps, "excessDamageAsThreat")) {
    if (!matchesQuery(state, sourceId, rule.source, context)) continue;
    const named =
      rule.scheme === "ownSignatureSideScheme"
        ? [villainOf(state, sourceId)?.signatureSideSchemeId ?? null]
        : resolveRef(state, rule.scheme, context);
    for (const id of named) {
      if (id === null || schemes.includes(id) || !inPlay.includes(id)) continue;
      if (categoriesOf(state, id).includes("scheme")) schemes.push(id);
    }
  }
  return schemes;
}

/**
 * Where an acceleration token headed for `schemeId` actually goes (`accelerationTokenDestination`; The Master of Time
 * 2B), or null for no redirect. A rule whose destination is the scheme the token was already headed for is ignored,
 * so "another scheme" cannot send a token back to itself.
 */
export function accelerationTokenRedirect(state: GameState, deps: EngineDeps, schemeId: InstanceId): InstanceId | null {
  for (const { rule, context } of activeRules(state, deps, "accelerationTokenDestination")) {
    const [to] = resolveRef(state, rule.to, context);
    if (to !== undefined && to !== schemeId) return to;
  }
  return null;
}

/** "Players cannot discard [these cards]" (`RuleSpec playersCannotDiscard`, docs/phase7-wave4.md §3.44). */
export const playersCannotDiscard = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "playersCannotDiscard").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/** "X cannot defend [against Y's attacks]" (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31). */
export const cannotDefend = (
  state: GameState,
  deps: EngineDeps,
  characterId: InstanceId,
  attackerId: InstanceId | null,
): boolean =>
  activeRules(state, deps, "cannotDefend").some(
    ({ rule, speakerContext }) =>
      matchesQuery(state, characterId, rule.target, speakerContext) &&
      (rule.attacker === undefined ||
        (attackerId !== null && matchesQuery(state, attackerId, rule.attacker, speakerContext))),
  );

/** "The engaged player must defend against [this enemy]'s attacks with an ally they control, if able" (Melter). */
export const mustDefendWithAlly = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "mustDefendWithAlly").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );

/**
 * Whether a card in play shows no icons right now because its text box is blank (`textBoxBlankFor`): no printed
 * crisis, hazard, acceleration or amplify icon, and none it gains. RRG 1.8 "Blank" (p. 10) does not say whether the
 * icons in a card's threat box or text box go with its text; FFG's Game Rules Specialist (Alex Werner) answered it for
 * Vivian (`ironheart` 29024): "Vivian would treat any icons on the attachment or side scheme as blank until the end of
 * the round" (FFG email relayed on Reddit, confirmed by the user 2026-09-28; docs/phase7-wave5.md §4.1 Q73). A card
 * that cannot be blanked, or whose Permanent keyword stops the blank, keeps its icons, as `textBoxBlankFor` already
 * reads it.
 */
export const iconsBlankedOn = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  textBoxBlankFor(state, id, deps);

/**
 * Icons contributed by the main scheme stage plus every side scheme in play, less any whose text box is blank
 * (`iconsBlankedOn`). With `area` (docs/phase7-wave2.md §3.1), that area's own stage and the side schemes in it or in
 * every area; the default counts the central stage and all.
 */
export function countSchemeIcons(
  state: GameState,
  deps: EngineDeps,
  icon: SchemeIcon,
  area: GameAreaState | null = null,
): number {
  const scheme = mainSchemeFor(state, area);
  let total =
    scheme && !iconsBlankedOn(state, deps, scheme.instanceId)
      ? mainSchemeStageOf(state, scheme).icons.filter((i) => i === icon).length
      : 0;
  for (const id of state.villainArea) {
    if (cardOf(state, id)?.type !== "side_scheme") continue;
    if (area && !sameGameArea(area, areaOfCard(state, id))) continue;
    total += printedIconsOn(state, deps, id).filter((i) => i === icon).length;
  }
  return total;
}

/**
 * Icons cards in play gain from constant abilities ("Each enemy in play gains 1 acceleration icon", `RuleSpec gainsIcon`,
 * docs/phase7-wave4.md §3.57): for each rule, `count` per matching card in play, in `area` when the players are split.
 */
export function grantedIcons(
  state: GameState,
  deps: EngineDeps,
  icon: SchemeIcon,
  area: GameAreaState | null = null,
): number {
  let total = 0;
  const inPlay = cardsInPlay(state);
  for (const { rule, context } of activeRules(state, deps, "gainsIcon")) {
    if (rule.icon !== icon) continue;
    for (const id of inPlay) {
      if (area && !sameGameArea(area, areaOfCard(state, id))) continue;
      // A blanked card has no icons, gained ones included (`iconsBlankedOn`).
      if (iconsBlankedOn(state, deps, id)) continue;
      if (matchesQuery(state, id, rule.target, context)) total += rule.count ?? 1;
    }
  }
  return total;
}

/**
 * Scheme icons printed on cards in play that are not schemes (`BaseCard.schemeIcons` / `CardFlipSide.schemeIcons`,
 * docs/phase7-wave5.md §1.3, §3.10): Team Leader's crisis icon, Public Outcry's, the Venom ally's hazard icon. RRG 1.8
 * "Hazard Icon" (p. 21) counts "each hazard icon on cards in play", and the crisis and acceleration entries likewise. A
 * flipped card shows its other face's icons; a facedown card shows none, and neither does a blanked one
 * (`iconsBlankedOn`).
 */
export function nonSchemeIcons(
  state: GameState,
  deps: EngineDeps,
  icon: SchemeIcon,
  area: GameAreaState | null = null,
): number {
  let total = 0;
  for (const id of cardsInPlay(state)) {
    const card = cardOf(state, id);
    if (!card || card.type === "main_scheme" || card.type === "side_scheme" || card.type === "player_side_scheme")
      continue;
    if (area && !sameGameArea(area, areaOfCard(state, id))) continue;
    total += printedIconsOn(state, deps, id).filter((i) => i === icon).length;
  }
  return total;
}

/**
 * The scheme icons printed on one card in play as it shows them now: a main scheme's current stage, a side scheme's
 * threat box, any other card's `schemeIcons` (its showing face's, when flipped). None on a facedown card or a blanked
 * one (`iconsBlankedOn`).
 */
function printedIconsOn(state: GameState, deps: EngineDeps, id: InstanceId): readonly SchemeIcon[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card || instance.facedownAs || iconsBlankedOn(state, deps, id)) return [];
  switch (card.type) {
    case "main_scheme": {
      const scheme = mainSchemeStates(state).find((candidate) => candidate.instanceId === id);
      return scheme ? mainSchemeStageOf(state, scheme).icons : [];
    }
    case "side_scheme":
      return card.icons;
    case "player_side_scheme":
      return [];
    default: {
      const face = encounterFace(state, id);
      return (face ? face.schemeIcons : card.schemeIcons) ?? [];
    }
  }
}

/**
 * How many `icon`s one card in play shows right now, printed and gained: the per-card view of `iconsInPlay`, for a
 * card's own display or a test of one card's share. A blanked card shows none (`iconsBlankedOn`); a card out of play
 * none either.
 */
export function iconsOn(state: GameState, deps: EngineDeps, id: InstanceId, icon: SchemeIcon): number {
  if (!cardsInPlay(state).includes(id)) return 0;
  const printed = printedIconsOn(state, deps, id).filter((i) => i === icon).length;
  if (iconsBlankedOn(state, deps, id)) return printed;
  let granted = 0;
  for (const { rule, context } of activeRules(state, deps, "gainsIcon")) {
    if (rule.icon === icon && matchesQuery(state, id, rule.target, context)) granted += rule.count ?? 1;
  }
  return printed + granted;
}

/**
 * Every `icon` in play: printed on schemes (`countSchemeIcons`) and on other cards (`nonSchemeIcons`), and gained
 * (`grantedIcons`): RRG 1.8 "Acceleration Icon" (p. 5).
 */
export const iconsInPlay = (
  state: GameState,
  deps: EngineDeps,
  icon: SchemeIcon,
  area: GameAreaState | null = null,
): number =>
  countSchemeIcons(state, deps, icon, area) +
  nonSchemeIcons(state, deps, icon, area) +
  grantedIcons(state, deps, icon, area);
