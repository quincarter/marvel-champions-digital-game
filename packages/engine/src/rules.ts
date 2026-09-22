import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { villainOf } from "./query.js";
import { activeRules, cardsInPlay, categoriesOf, matchesQuery, resolveRef, rulePlayers } from "./select.js";
import type { AttackKeyword } from "./spec.js";
import type { Form, GameState } from "./state.js";

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

/** "Threat cannot be removed from this scheme" (Countdown to Oblivion); a `by: "thwart"` rule only stops a thwart. */
export const threatCannotBeRemoved = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  byThwart = false,
): boolean =>
  activeRules(state, deps, "threatCannotBeRemoved").some(
    ({ rule, context }) => (rule.by !== "thwart" || byThwart) && matchesQuery(state, schemeId, rule.target, context),
  );

/** "While Baron Zemo is engaged with you, you cannot thwart." */
export const cannotThwart = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotThwart").some((active) => rulePlayers(state, active.rule, active).includes(playerId));

/** "You cannot change form." */
export const cannotChangeForm = (state: GameState, deps: EngineDeps, playerId: PlayerId): boolean =>
  activeRules(state, deps, "cannotChangeForm").some((active) =>
    rulePlayers(state, active.rule, active).includes(playerId),
  );

/** "… cannot ready." */
export const cannotReady = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotReady").some(({ rule, context }) => matchesQuery(state, id, rule.target, context));

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

/** Whether a defeated side scheme is shuffled into the encounter deck instead of discarded (`defeatedIntoEncounterDeck`). */
export const defeatedIntoEncounterDeck = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "defeatedIntoEncounterDeck").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

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

/** "The engaged player must defend against [this enemy]'s attacks with an ally they control, if able" (Melter). */
export const mustDefendWithAlly = (state: GameState, deps: EngineDeps, attackerId: InstanceId): boolean =>
  activeRules(state, deps, "mustDefendWithAlly").some(({ rule, context }) =>
    matchesQuery(state, attackerId, rule.attacker, context),
  );
