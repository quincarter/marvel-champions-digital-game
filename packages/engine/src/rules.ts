import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  cardOf,
  currentName,
  getInstance,
  mainSchemeFor,
  mainSchemeStageOf,
  minionsEngagedWith,
  sharedMainSchemes,
  villainOf,
} from "./query.js";
import {
  activeAbilityRefs,
  activeRules,
  cardsInPlay,
  categoriesOf,
  focusedMainSchemeId,
  contextArea,
  evaluate,
  isPlayerCard,
  matchesQuery,
  resolveRef,
  rulePlayers,
  type EffectContext,
} from "./select.js";
import { combineRequirements, type ResolvedRequirement } from "./resources.js";
import type { AttackKeyword, CardDestination } from "./spec.js";
import type { Form, GameState } from "./state.js";

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
export function damagePreventerOf(state: GameState, deps: EngineDeps, targetId: InstanceId): InstanceId | null {
  const found = activeRules(state, deps, "preventAllDamage").find(({ rule, context }) =>
    matchesQuery(state, targetId, rule.target, context),
  );
  return found ? found.context.selfInstanceId : null;
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

/** "While Baron Zemo is engaged with you, you cannot thwart." */
export const cannotThwart = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotThwart").some((active) => rulePlayers(state, active.rule, active).includes(playerId));

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
    return own?.instanceId ?? null;
  }
  return focusedMainSchemeId(state, deps);
}

/**
 * "You cannot change form." (no `formType`: the hero/alter-ego change) / "You cannot change energy forms." (`formType`
 * given: that additional form; docs/phase7-wave4.md §3.1). Each rule blocks only the kind of change it names.
 */
export const cannotChangeForm = (state: GameState, deps: EngineDeps, playerId: PlayerId, formType?: string): boolean =>
  activeRules(state, deps, "cannotChangeForm").some(
    (active) => active.rule.formType === formType && rulePlayers(state, active.rule, active).includes(playerId),
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
 * on what one attack can make the character take (§4 Q9).
 */
export function damageTakenAfterConstants(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  amount: number,
  fromAttack: boolean,
): number {
  let taken = amount;
  for (const { rule, context } of activeRules(state, deps, "reduceDamageTaken")) {
    if (rule.fromAttack === true && !fromAttack) continue;
    if (matchesQuery(state, targetId, rule.target, context)) taken -= rule.amount;
  }
  if (fromAttack) {
    for (const { rule, context } of activeRules(state, deps, "maxDamageTakenPerAttack")) {
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

/** "X cannot defend [against Y's attacks]" (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31). */
export const cannotDefend = (
  state: GameState,
  deps: EngineDeps,
  characterId: InstanceId,
  attackerId: InstanceId | null,
): boolean =>
  activeRules(state, deps, "cannotDefend").some(
    ({ rule, context }) =>
      matchesQuery(state, characterId, rule.target, context) &&
      (rule.attacker === undefined || (attackerId !== null && matchesQuery(state, attackerId, rule.attacker, context))),
  );

/** "The engaged player must defend against [this enemy]'s attacks with an ally they control, if able" (Melter). */
export const mustDefendWithAlly = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "mustDefendWithAlly").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );
