import type {
  AbilityCost,
  AbilityRegistry,
  AbilityTriggerSpec,
  CardIcon,
  ConsequentialDamageScope,
  EngineDeps,
  RuleSpec,
} from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { attackKeywordsOf, hasKeyword } from "./keywords.js";
import type { AnyCard, CardId, SchemeIcon } from "@mc/content";
import {
  areaOfCard,
  cardOf,
  currentName,
  encounterFace,
  getInstance,
  identityFace,
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
  isAttachedMinion,
  isPlayerCard,
  matchesQuery,
  resolveRef,
  resolveValue,
  restrictedCardsOf,
  restrictedLoadOf,
  rulePlayers,
  textBoxBlankFor,
  timingWordOf,
  traitsOf,
  type ActiveRule,
  type EffectContext,
} from "./select.js";
import { combineRequirements, type ResolvedRequirement } from "./resources.js";
import type { AttackKeyword, CardDestination, TargetQuery } from "./spec.js";
import type { Bindings, LingeringDamageRule, StackFrame, Vars } from "./stack.js";
import type { FrameId } from "./ids.js";
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

/**
 * The card a damage event counts as coming from, for "damage from cards with a printed [X] resource"
 * (docs/phase7-wave6.md §3.68, §4 Q39): the card the damage came through (`viaInstanceId`: the event, support or upgrade
 * whose ability made the attack), else its source (the card whose ability dealt it, an ally for its attack, the identity
 * for a hero's basic attack). Resources spent to pay for it never count. Null when the damage has no source card.
 */
export const damageSourceCard = (
  event: Pick<Extract<TriggerEvent, { kind: "dealDamage" }>, "sourceInstanceId" | "viaInstanceId">,
): InstanceId | null => event.viaInstanceId ?? event.sourceInstanceId ?? null;

/**
 * What the damage-taken rules read about where one damage event comes from (docs/phase7-wave6.md §3.68): its source
 * card (`damageSourceCard`), and the keywords of the attack it belongs to when it is an attack's damage to the
 * character it attacks (absent otherwise; `attackKeywordsOf`).
 */
export interface DamageSourceInfo {
  readonly card: InstanceId | null;
  readonly attackKeywords?: readonly AttackKeyword[];
  /** The attack this damage is from (docs/phase7-wave7.md §3.30); absent for damage that is not an attack's. */
  readonly attack?: DamageAttackInfo;
}

/**
 * The attack one instance of damage is from, as the rules that read "the attacker" or "the attack" see it
 * (`cannotTakeDamage.exceptAttacker` / `exceptAttackCard` / `exceptAttackKeyword`, `reduceDamageTaken.exceptAttacker`;
 * docs/phase7-wave7.md §3.30). Only an attack's damage has one: an ability's or non-attack event's damage, retaliate
 * and indirect damage have neither an attacker nor an attack (§4.1 Q17).
 *
 * - `attackerInstanceId`: the attacking character (a hero or ally for a player's attack, whatever card made it; the
 *   enemy for an enemy's). For a `dealDamage` effect marked `fromAttack`, the card dealing it.
 * - `cardInstanceId`: the card whose ability makes the attack (an attack event, an upgrade's attack ability), which is
 *   what "the attack has the [X] trait" reads; null for a basic attack or an enemy's activation, which no card makes.
 * - `keywords`: the attack's keywords, its attacker's own or granted to it (`attackKeywordsOf`). Empty for attack
 *   damage dealt to a character the attack is not against (`notAttacked`, docs/phase7-wave6.md §4.1 Q18).
 */
export interface DamageAttackInfo {
  readonly attackerInstanceId: InstanceId | null;
  readonly cardInstanceId: InstanceId | null;
  readonly keywords: readonly AttackKeyword[];
}

/**
 * "X cannot take damage [while …] [from …]". `sources` are the damage's source and then the card it came through, if
 * any; `fromSource` matches either. `exceptFromSource` ("can only take damage from cards with a printed [physical]
 * resource", §3.68) reads the one source card of §4 Q39: the last of `sources` given, else the first.
 *
 * `attack`: the attack the damage is from, when it is an attack's, for "unless the attacker or attack has the [X]
 * trait, or the attack has ranged" (`exceptAttacker`, `exceptAttackCard`, `exceptAttackKeyword`; docs/phase7-wave7.md
 * §3.30). Absent, none of those exceptions holds and the damage is blocked (§4.1 Q17).
 */
export function cannotTakeDamage(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  sources: readonly (InstanceId | null | undefined)[],
  attack?: DamageAttackInfo,
): boolean {
  const card = sources[1] ?? sources[0] ?? null;
  const matches = (id: InstanceId | null, query: TargetQuery | undefined, context: EffectContext): boolean =>
    query !== undefined && id !== null && matchesQuery(state, id, query, context);
  return activeRules(state, deps, "cannotTakeDamage").some(({ rule, context }) => {
    if (!matchesQuery(state, targetId, rule.target, context)) return false;
    if (rule.exceptFromSource && card !== null && matchesQuery(state, card, rule.exceptFromSource, context)) {
      return false;
    }
    if (attack) {
      if (matches(attack.attackerInstanceId, rule.exceptAttacker, context)) return false;
      if (matches(attack.cardInstanceId, rule.exceptAttackCard, context)) return false;
      if (rule.exceptAttackKeyword !== undefined && attack.keywords.includes(rule.exceptAttackKeyword)) return false;
    }
    if (!rule.fromSource) return true;
    const query = rule.fromSource;
    return sources.some((id) => id !== null && id !== undefined && matchesQuery(state, id, query, context));
  });
}

/** A player's attack on the stack: its `attack` event frame (`playerAttackInProgress`). */
export type PlayerAttackFrame = Extract<StackFrame, { kind: "event" }> & {
  readonly event: Extract<TriggerEvent, { kind: "attack" }>;
};

/**
 * The innermost player attack that has not dealt its damage yet: the first uncancelled `attack` event frame of the
 * stack (innermost-first) that has not applied, which is when "when you attack" abilities resolve (RRG 1.8
 * "Interrupt", p. 25). A nested attack (one made from an interrupt to another) is the one found. Null with none, and
 * once the innermost one is past its interrupts: its damage is already on the stack against the old target.
 */
export function playerAttackInProgress(stack: readonly StackFrame[]): PlayerAttackFrame | null {
  const frame = stack.find((f) => f.kind === "event" && f.event.kind === "attack" && !f.cancelled);
  // `apply` is the stage an event frame waits in under its open interrupt window; it leaves it as it applies.
  return frame?.kind === "event" &&
    frame.event.kind === "attack" &&
    (frame.stage === "interrupts" || frame.stage === "apply")
    ? (frame as PlayerAttackFrame)
    : null;
}

/**
 * Whether `targetId` is a valid target for this player attack's damage: RRG 1.8 "Target" (p. 43), "A target that
 * 'cannot take damage' is not a valid target for an ability or game function whose only effect on that target is to
 * deal it damage", which ruling Mar 19, 2026 (2) applies to basic powers too. Read as the attack's damage will be
 * (`DamageAttackInfo`): its attacker, the card making it and the keywords it has now, so a rule scoped by source or
 * by attack keyword answers as it will when the damage lands.
 */
export function canTakePlayerAttack(
  state: GameState,
  deps: EngineDeps,
  attack: PlayerAttackFrame,
  targetId: InstanceId,
): boolean {
  const { attackerInstanceId, sourceInstanceId = null, basic, keywords, overkill } = attack.event;
  const has = attackKeywordsOf(state, deps, {
    attackerInstanceId,
    viaInstanceId: sourceInstanceId,
    basic: basic === true,
    ...(keywords ? { keywords } : {}),
    vars: attack.vars,
  });
  return !cannotTakeDamage(state, deps, targetId, [attackerInstanceId, sourceInstanceId], {
    attackerInstanceId,
    cardInstanceId: sourceInstanceId,
    keywords: overkill === true && !has.includes("overkill") ? [...has, "overkill"] : has,
  });
}

/** Whether a damage-taken rule's `fromSource` lets this damage through: no `fromSource`, or a source card matching it. */
function fromSourceMatches(
  state: GameState,
  query: TargetQuery | undefined,
  source: DamageSourceInfo | undefined,
  context: EffectContext,
): boolean {
  if (!query) return true;
  const card = source?.card ?? null;
  return card !== null && matchesQuery(state, card, query, context);
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
  if (found) return found.context.selfInstanceId;
  return lingeringRulesOf(state, consequential, "preventAllDamage")[0]?.sourceInstanceId ?? null;
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
  /** The rules kept on its frame from sources that left play during the power (`lingeringConsequentialRules`). */
  readonly lingering?: readonly LingeringDamageRule[];
}

/**
 * The lingering rules of this kind on this consequential damage whose source is still out of play. One whose source is
 * back in play is read live instead, so it never counts twice.
 */
function lingeringRulesOf(
  state: GameState,
  damage: ConsequentialDamage | undefined,
  kind: LingeringDamageRule["kind"],
): readonly LingeringDamageRule[] {
  if (!damage?.lingering?.length) return [];
  const inPlay = new Set(cardsInPlay(state));
  return damage.lingering.filter((l) => l.kind === kind && !inPlay.has(l.sourceInstanceId));
}

/**
 * The consequential-scoped damage-taken rules (`reduceDamageTaken`, `increaseDamageTaken`, `preventAllDamage` with a
 * `consequential` scope) of a card about to leave play that apply to an ally's consequential damage still pending on the
 * stack, grouped by that damage's frame. `leaveNow` keeps them on the frame (`lingeringDamageRules`), so the damage still
 * gets them once their source is gone.
 *
 * Wave 6 §4.1 Q50 (user, 2026-10-02, option A): FFG ruling Feb 8, 2026 (1), on RRG 1.8 "Consequential Damage" (p. 13),
 * reads Coordinated Attack's "-1 consequential damage when attacking attached minion" as lost when the attack defeats
 * its host (it is discarded before the consequential damage is dealt), and states the designer intent that it is not.
 * The project builds the intent: such a rule is read as last known information, as it applied when its source left
 * play. The scope's `if` is read then, with the results the power has gathered so far (its event frames reporting into
 * the damage, prefixed as they will be: slot `attack.target` is set as the attack starts; `attack.made` is not yet).
 * This holds for any way the source leaves while the power resolves, not only by that attack's defeat.
 */
export function lingeringConsequentialRules(
  state: GameState,
  deps: EngineDeps,
  leavingId: InstanceId,
): readonly { readonly frameId: FrameId; readonly rules: readonly LingeringDamageRule[] }[] {
  const pending = state.stack.filter(
    (f): f is Extract<StackFrame, { kind: "event" }> =>
      f.kind === "event" &&
      f.stage !== "done" &&
      !f.cancelled &&
      f.event.kind === "dealDamage" &&
      f.event.consequential === true,
  );
  if (pending.length === 0) return [];
  const mine = <K extends LingeringDamageRule["kind"]>(kind: K) =>
    activeRules(state, deps, kind).filter(
      ({ rule, context }) =>
        context.selfInstanceId === leavingId && "consequential" in rule && rule.consequential !== undefined,
    );
  const reduce = mine("reduceDamageTaken");
  const increase = mine("increaseDamageTaken");
  const prevent = mine("preventAllDamage");
  if (reduce.length + increase.length + prevent.length === 0) return [];
  const out: { frameId: FrameId; rules: LingeringDamageRule[] }[] = [];
  for (const frame of pending) {
    const event = frame.event;
    if (event.kind !== "dealDamage" || event.consequentialFrom === undefined) continue;
    const vars: Record<string, number> = { ...frame.vars };
    const slots: Record<string, readonly InstanceId[]> = { ...frame.slots };
    for (const reporter of state.stack) {
      if (reporter.kind !== "event" || reporter.reportTo?.frameId !== frame.frameId) continue;
      const prefix = reporter.reportTo.prefix;
      if (prefix === null) continue;
      for (const [key, amount] of Object.entries(reporter.vars)) vars[`${prefix}.${key}`] = amount;
      for (const [key, ids] of Object.entries(reporter.slots)) slots[`${prefix}.${key}`] = ids;
    }
    const damage: ConsequentialDamage = { from: event.consequentialFrom, event, vars, slots };
    const applies = (
      rule: { target: TargetQuery; consequential?: ConsequentialDamageScope; fromAttack?: boolean },
      context: EffectContext,
    ) =>
      rule.fromAttack !== true &&
      matchesQuery(state, event.targetInstanceId, rule.target, context) &&
      consequentialScopeMatches(state, rule.consequential, damage, context);
    const rules: LingeringDamageRule[] = [
      ...reduce
        .filter(({ rule, context }) => applies(rule, context))
        .map(({ rule }) => ({ sourceInstanceId: leavingId, kind: rule.kind, amount: rule.amount })),
      ...increase
        .filter(({ rule, context }) => applies(rule, context))
        .map(({ rule }) => ({ sourceInstanceId: leavingId, kind: rule.kind, amount: rule.amount })),
      ...prevent
        .filter(({ rule, context }) => applies(rule, context))
        .map(({ rule }) => ({ sourceInstanceId: leavingId, kind: rule.kind, amount: 0 })),
    ];
    if (rules.length > 0) out.push({ frameId: frame.frameId, rules });
  }
  return out;
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
 *
 * `characterId` is the character performing the removal (the thwarting character, else `actingCharacterOf` the
 * removing card; null when no character performs it), read only by a rule with `exceptBy` ("Characters other than
 * Cable cannot remove threat from Technovirus Purge", docs/phase7-wave7.md §3.51): such a rule binds characters only
 * (§4.1 Q29 = A), so it never blocks a removal with no character and blocks a character's unless it matches.
 */
export const threatCannotBeRemoved = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  byThwart = false,
  removerId: PlayerId | null = null,
  characterId: InstanceId | null = null,
): boolean =>
  activeRules(state, deps, "threatCannotBeRemoved").some((active) => {
    const { rule, context } = active;
    if (rule.by === "thwart" && !byThwart) return false;
    if (!matchesQuery(state, schemeId, rule.target, context)) return false;
    if (rule.exceptBy && (characterId === null || matchesQuery(state, characterId, rule.exceptBy, context))) {
      return false;
    }
    if (!rule.player) return true;
    return removerId !== null && rulePlayers(state, { player: rule.player }, active).includes(removerId);
  });

/**
 * Whether a `threatCannotBeRemoved` rule scoped with `exceptBy` keeps this character from removing threat from the
 * scheme (docs/phase7-wave7.md §3.51): what the basic thwart command refuses on, so the scheme is not a legal target
 * of that character's basic thwart. A rule without `exceptBy`, or one that also scopes itself with `by` or `player`,
 * is left to the removal itself, as before the field.
 */
export const characterCannotRemoveThreat = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  characterId: InstanceId,
): boolean =>
  activeRules(state, deps, "threatCannotBeRemoved").some(
    ({ rule, context }) =>
      rule.exceptBy !== undefined &&
      rule.by !== "thwart" &&
      rule.player === undefined &&
      matchesQuery(state, schemeId, rule.target, context) &&
      !matchesQuery(state, characterId, rule.exceptBy, context),
  );

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
    const { rule, context } = active;
    if (rule.schemes && (schemeId === undefined || !matchesQuery(state, schemeId, rule.schemes, context))) {
      return false;
    }
    if (rule.thwarter && (!thwarterId || !matchesQuery(state, thwarterId, rule.thwarter, context))) return false;
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
 * (`RuleSpec staysInHand`, docs/phase7-wave6.md §3.10): a rule in play or the scenario's whose `cards` matches it, the
 * card's own hand-active constant (`activeIn: "hand"`), whose `cards` is read with the card itself as "this card", or
 * the card's own hand-active interrupt or response to `cardEntersHand` ("Forced Response: After this card enters your
 * hand, …": Misled, `rogue` 38027; Infiltration and Shapeshifter Surprise, `mut_gen` 32082-32083). §3.10's plan: a
 * card printing "after this card enters your hand" is meant to be in the hand, and MC32 p. 7 says so for Mystique's:
 * "If one of these treachery cards subsequently enters your hand, trigger its Forced Response at that time … Each
 * treachery in your hand remains until you discard it".
 */
export function staysInHand(state: GameState, deps: EngineDeps, id: InstanceId): boolean {
  if (activeRules(state, deps, "staysInHand").some(({ rule, context }) => matchesQuery(state, id, rule.cards, context)))
    return true;
  const card = cardOf(state, id);
  if (!card || !("abilities" in card)) return false;
  const context: EffectContext = { selfInstanceId: id, controllerId: null, event: null, bindings: {}, deps };
  return card.abilities.some((ref) => {
    const definition = deps.abilities[ref.id];
    if (definition?.activeIn !== "hand") return false;
    const trigger = definition.trigger;
    if (trigger.kind === "interrupt" || trigger.kind === "response") {
      // "This card": the pattern names the card itself as what enters the hand.
      const on = trigger.on.on;
      return (typeof on === "string" ? [on] : on).includes("cardEntersHand") && trigger.on.selfIs === "target";
    }
    if (trigger.kind !== "constant") return false;
    return (trigger.rules ?? []).some(
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

/**
 * "If Odin leaves play, the players lose the game." (`leavingPlayLoses`, docs/phase7-wave4.md §3.8), read before it
 * goes: the card whose rule says so (the first in play order when several do), or null when `id` leaving loses nothing.
 * The outcome records it (`GameOutcome.sourceInstanceId`), so the caller never ends the game without naming a card.
 */
export const leavingPlayLoses = (state: GameState, deps: EngineDeps, id: InstanceId): InstanceId | null => {
  const found = activeRules(state, deps, "leavingPlayLoses").find(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );
  // A rule is always read off a card in play; the leaving card stands in if a context ever lacks one.
  return found ? (found.context.selfInstanceId ?? id) : null;
};

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
 * attachment is an encounter card when no player owns it, a player card when one does (RRG 1.8 "Player Card", p. 33;
 * an upgrade, or an event a card attaches), and an upgrade by its card type.
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
  const from = {
    encounter,
    upgrade: card?.type === "upgrade",
    playerCard: attaching !== undefined && attaching.ownerId !== null,
  };
  return !activeRules(state, deps, "cannotHaveAttachments").some(
    ({ rule, context }) =>
      (rule.from === undefined || from[rule.from]) && matchesQuery(state, hostId, rule.target, context),
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

/** One additional cost to change form in force for a change (`RuleSpec formChangeCost`), and the card it is on. */
export interface FormChangeCost {
  readonly sourceInstanceId: InstanceId;
  readonly cost: AbilityCost;
}

/**
 * The additional costs `playerId` must pay to change to form `to` right now (`RuleSpec formChangeCost`,
 * docs/phase7-wave8.md §3.63), one per rule that covers the change, in the order the rules are found; empty when the
 * change is free. `during: "ownTurn"` is read off the step: the player phase, that player's turn.
 *
 * This says what a change the player makes would cost. Whether a given change is one the player makes (the turn's
 * option, an ability of a player card they resolve) or one an encounter card forces, which is free (§4.2 Q37 = A), is
 * the caller's to say (`changeForm`, `executeChangeForm`).
 */
export function formChangeCostsFor(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  to: Form,
): readonly FormChangeCost[] {
  const step = state.step;
  const ownTurn = step.phase === "player" && step.kind === "turn" && step.activePlayerId === playerId;
  return activeRules(state, deps, "formChangeCost").flatMap((active) => {
    const { rule, context } = active;
    if (rule.to !== undefined && rule.to !== to) return [];
    if (rule.during === "ownTurn" && !ownTurn) return [];
    if (context.selfInstanceId === null || !rulePlayers(state, rule, active).includes(playerId)) return [];
    return [{ sourceInstanceId: context.selfInstanceId, cost: rule.cost }];
  });
}

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
  // "Allies you control cannot ready" on an obligation or on an attachment on a player card names the player the card
  // speaks to (`ActiveRule.context`; RRG 1.8 "Obligation", p. 30; "Attachment", p. 8), whom no one controls it for.
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
 * RRG "Ally Limit": three, plus every "increase/reduce your ally limit" rule that speaks to this player: on a card they
 * control, or on an obligation in their play area ("Reduce your ally limit by 2", The Odd Couple `mojo` 39063; RRG 1.8
 * "Obligation", p. 30: its "your" is "the player whose play area the obligation is in"). Never below zero. A rule's
 * `while` is read now, on every call, so a conditional increase (Avengers Tower) counts only while its condition holds.
 */
export const allyLimitFor = (state: GameState, deps: EngineDeps, playerId: PlayerId): number =>
  Math.max(
    0,
    BASE_ALLY_LIMIT +
      activeRules(state, deps, "allyLimit")
        .filter(({ speakerId }) => speakerId === playerId)
        .reduce((sum, { rule }) => sum + rule.amount, 0),
  );

const registriesReducingAllyLimit = new WeakMap<AbilityRegistry, boolean>();

/**
 * Whether any ally limit could be under three right now: a constant "reduce your ally limit" exists in the registry, or
 * a lasting or scenario rule reduces it. When false, three allies or fewer is never over the limit, and the check
 * between frames (`checkAllyLimits`) skips its rule scan.
 */
export function allyLimitMayBeReduced(state: GameState, deps: EngineDeps): boolean {
  let known = registriesReducingAllyLimit.get(deps.abilities);
  if (known === undefined) {
    known = Object.values(deps.abilities).some(
      (definition) =>
        definition.trigger.kind === "constant" &&
        (definition.trigger.rules ?? []).some((rule) => rule.kind === "allyLimit" && rule.amount < 0),
    );
    registriesReducingAllyLimit.set(deps.abilities, known);
  }
  if (known) return true;
  const reduces = (rule: RuleSpec) => rule.kind === "allyLimit" && rule.amount < 0;
  return (
    state.lastingEffects.some((effect) => effect.kind === "ruleGrant" && reduces(effect.rule)) ||
    (state.scenarioRules.rules ?? []).some(reduces)
  );
}

/** An ally that does not count against its controller's ally limit (`excludedFromAllyLimit`). */
export const excludedFromAllyLimit = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "excludedFromAllyLimit").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/**
 * A card that enters play exhausted by another card's constant rule (`entersPlayExhausted`, docs/phase7-wave7.md
 * §3.36). Read once, as the card enters play, with the card already in its zone and under its controller. The query
 * reads "you" as the rule's speaker, so "your allies" on an attachment no player controls means the allies of the
 * player whose identity it is attached to (RRG 1.8 "Attachment", p. 8).
 */
export const entersPlayExhausted = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "entersPlayExhausted").some(({ rule, context }) =>
    matchesQuery(state, id, rule.target, context),
  );

/**
 * RRG 1.8 "Player Side Scheme Limit" (p. 34): "If one or two players started the game, the player side scheme limit is
 * one. If three or four players started the game, the limit is two." One limit for the whole table, not one per player,
 * and fixed by the players who started: an eliminated player does not lower it.
 */
export const playerSideSchemeLimit = (state: GameState): number => (state.startingPlayerCount <= 2 ? 1 : 2);

/** A player side scheme that does not count toward the player side scheme limit (`excludedFromPlayerSideSchemeLimit`). */
export const excludedFromPlayerSideSchemeLimit = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "excludedFromPlayerSideSchemeLimit").some(({ rule, context }) =>
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
 * `cards` is matched with the same "you" its `player` field is resolved in (`ActiveRule.context`): the two clauses of
 * one printed sentence ("*you* cannot play *your* hero-specific cards") have to agree on who "you" is, on an obligation
 * as on a card a player controls (RRG 1.8 "Obligation", p. 30; docs/phase7-wave2.md §25.3).
 */
export const cannotPlayCard = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotPlay").some(
    (active) =>
      rulePlayers(state, active.rule, active).includes(playerId) &&
      matchesQuery(state, id, active.rule.cards, active.context),
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
 * Induced Panic). A trigger with no bold timing word (a constant, When Revealed, …) is never stopped. `resolver` is
 * the player who would resolve the ability (null when no player would), read by a rule scoped to players (`player`:
 * "Other players cannot resolve player card abilities during your turn"). `rules` lets a caller that checks many
 * abilities read the active rules once.
 */
export function triggeredAbilityForbidden(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  trigger: AbilityTriggerSpec,
  resolver: PlayerId | null,
  rules: readonly ActiveRule<"cannotResolveTriggeredAbilities">[] = activeRules(
    state,
    deps,
    "cannotResolveTriggeredAbilities",
  ),
): boolean {
  if (rules.length === 0) return false;
  const word = timingWordOf(trigger);
  if (word === null) return false;
  return rules.some((active) => {
    const { rule, context } = active;
    if (rule.timings && !rule.timings.includes(word)) return false;
    if (rule.player !== undefined) {
      if (resolver === null || !rulePlayers(state, { player: rule.player }, active).includes(resolver)) return false;
    }
    if (rule.playerCards === true && !isPlayerCard(state, id)) return false;
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

/**
 * "This card cannot leave play while …" (`cannotLeavePlay`). `sourceCardId`: the card whose ability, or whose ability's
 * cost, would move it, as `permanentStopsLeaving` reads it; none for a move the game's rules make. A rule limited to
 * card abilities (`by: "cardAbilities"`, docs/phase7-wave7.md §3.10) stops only a move with a source card.
 */
export const cannotLeavePlay = (state: GameState, deps: EngineDeps, id: InstanceId, sourceCardId?: CardId): boolean =>
  activeRules(state, deps, "cannotLeavePlay").some(
    ({ rule, context }) =>
      (rule.by !== "cardAbilities" || sourceCardId !== undefined) && matchesQuery(state, id, rule.target, context),
  );

/**
 * "You cannot flip your [name] upgrades" (`cannotFlip`, docs/phase7-wave7.md §3.64): whether a rule stops this card in
 * play being turned to its other face. "Your" is the rule card's speaker (an obligation's player, RRG 1.8 p. 30).
 */
export const cannotFlip = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotFlip").some(({ rule, context }) => matchesQuery(state, id, rule.target, context));

/**
 * "Card abilities cannot remove this ally from play" (`cannotLeavePlay` with `by: "cardAbilities"`) on its own, for a
 * "defeat" effect: the card is not defeated at all (docs/phase7-wave7.md §4.1 Q7), where the unqualified rule only
 * stops the defeated card's leaving step.
 */
export const cardAbilitiesCannotRemove = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  activeRules(state, deps, "cannotLeavePlay").some(
    ({ rule, context }) => rule.by === "cardAbilities" && matchesQuery(state, id, rule.target, context),
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
  source?: DamageSourceInfo,
): number {
  const uncapped = damageTakenBeforeSustainedCap(state, deps, targetId, amount, fromAttack, consequential, source);
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
  source?: DamageSourceInfo,
): number {
  return damageTakenBreakdown(state, deps, targetId, amount, fromAttack, consequential, source).taken;
}

/**
 * `damageTakenBeforeSustainedCap` with how doubling (`doubleDamageTaken`, docs/phase7-wave6.md §3.68) changed it:
 * `beforeDoubling` is the damage after every increase and reduction, `doubledBy` the cards whose rules doubled it (null for
 * a rule with no card), one entry per doubling, in the order the rules were read (empty when none did). `applyDamage` logs `damageDoubled` from it.
 */
export function damageTakenBreakdown(
  state: GameState,
  deps: EngineDeps,
  targetId: InstanceId,
  amount: number,
  fromAttack: boolean,
  consequential?: ConsequentialDamage,
  source?: DamageSourceInfo,
): { readonly taken: number; readonly beforeDoubling: number; readonly doubledBy: readonly (InstanceId | null)[] } {
  let taken = amount;
  // "Increase all damage Venom takes by 1" (docs/phase7-wave5.md §3.8), summed with the reductions (RRG 1.8
  // "Modifiers", p. 29); a damage event of nothing stays nothing. A rule scoped to consequential damage ("Cannonball
  // takes -1 consequential damage", docs/phase7-wave6.md §3.31) reaches only that.
  if (amount > 0) {
    for (const { rule, context } of activeRules(state, deps, "increaseDamageTaken")) {
      if (rule.fromAttack === true && !fromAttack) continue;
      if (!matchesQuery(state, targetId, rule.target, context)) continue;
      if (!fromSourceMatches(state, rule.fromSource, source, context)) continue;
      if (consequentialScopeMatches(state, rule.consequential, consequential, context)) taken += rule.amount;
    }
  }
  for (const { rule, context } of activeRules(state, deps, "reduceDamageTaken")) {
    if (rule.fromAttack === true && !fromAttack) continue;
    if (!matchesQuery(state, targetId, rule.target, context)) continue;
    // "… unless the attacker has the [TINY] trait" (docs/phase7-wave7.md §3.30).
    const attacker = source?.attack?.attackerInstanceId ?? null;
    if (rule.exceptAttacker && attacker !== null && matchesQuery(state, attacker, rule.exceptAttacker, context)) {
      continue;
    }
    if (consequentialScopeMatches(state, rule.consequential, consequential, context)) taken -= rule.amount;
  }
  // Rules whose source left play while the power resolved (wave 6 §4.1 Q50; `lingeringConsequentialRules`).
  if (amount > 0) for (const l of lingeringRulesOf(state, consequential, "increaseDamageTaken")) taken += l.amount;
  for (const l of lingeringRulesOf(state, consequential, "reduceDamageTaken")) taken -= l.amount;
  // "Double the amount of damage this minion takes from …" (§3.68): RRG 1.8 "Modifiers" (p. 29) calculates every
  // additive and subtractive modifier first, so the floored sum is what is doubled (Wild Wild Mojo's +1 too, §4 Q40),
  // and the per-attack cap below still has the last word.
  taken = Math.max(0, taken);
  const beforeDoubling = taken;
  const doubledBy: (InstanceId | null)[] = [];
  if (taken > 0) {
    for (const { rule, context } of activeRules(state, deps, "doubleDamageTaken")) {
      if (!matchesQuery(state, targetId, rule.target, context)) continue;
      if (!fromSourceMatches(state, rule.fromSource, source, context)) continue;
      if (rule.attackKeyword !== undefined && !(source?.attackKeywords ?? []).includes(rule.attackKeyword)) continue;
      taken *= 2;
      doubledBy.push(context.selfInstanceId);
    }
  }
  if (fromAttack) {
    for (const { rule, context } of activeRules(state, deps, "maxDamageTakenPerAttack")) {
      if (rule.per === "phase") continue;
      if (matchesQuery(state, targetId, rule.target, context)) taken = Math.min(taken, rule.amount);
    }
  }
  return { taken: Math.max(0, taken), beforeDoubling, doubledBy };
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

/**
 * RRG 1.8 "Restricted" (p. 38): "A player cannot have more than two cards with the restricted keyword in play". A
 * limit on what is in play, enforced by discards (`checkRestrictedLimits`); it never stops a card being played.
 */
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

/**
 * Where a player stands against the restricted limit (docs/phase7-wave7.md §3.82), counting what they control in play.
 * `load` is `restrictedLoadOf`; `held` is the cards with the keyword, the only ones a `restrictedLimit` rule's `cards`
 * makes room for and the only ones discarded for the limit (§4.1 Q52 = B: a card that "counts as 2 restricted cards"
 * weighs on the limit and is not itself a restricted card). The player is over the limit when `load > limit`.
 */
export function restrictedStanding(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
): { readonly load: number; readonly limit: number; readonly held: readonly InstanceId[] } {
  const held = restrictedCardsOf(state, playerId, deps);
  return {
    load: restrictedLoadOf(state, playerId, deps),
    limit: restrictedLimitFor(state, deps, playerId, held),
    held,
  };
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
  const inPlay = cardsInPlay(state);
  for (const { rule, context } of activeRules(state, deps, "schemeThreatDestination")) {
    if (!matchesQuery(state, enemyId, rule.enemy, context)) continue;
    const named =
      rule.scheme === "ownSignatureSideScheme"
        ? [villainOf(state, enemyId)?.signatureSideSchemeId ?? null]
        : resolveRef(state, rule.scheme, context);
    // "If able" (Dark Phoenix, §3.37): a rule whose scheme is not in play falls through to the next, then to the main scheme.
    const scheme = named.find((id) => id !== null && inPlay.includes(id) && categoriesOf(state, id).includes("scheme"));
    if (scheme) return scheme;
  }
  return null;
}

/**
 * The scheme a scheme activation by this enemy places its threat on: RRG 1.8 "Scheme (Enemy Activation)" step 3 places
 * it on the main scheme unless a constant ability redirects it (`schemeThreatDestination`). With separate game areas,
 * "the main scheme" is the enemy's own area's (docs/phase7-wave2.md §3.1).
 */
export function schemeActivationDestination(state: GameState, deps: EngineDeps, enemyId: InstanceId): InstanceId {
  return (
    schemeThreatDestination(state, deps, enemyId) ??
    pairedMainSchemeId(state, deps, enemyId) ??
    mainSchemeFor(state, areaOfCard(state, enemyId))?.instanceId ??
    state.mainScheme.instanceId
  );
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

/**
 * "Attached minion cannot activate" (`RuleSpec cannotActivate`, docs/phase7-wave6.md §3.34, §4.1 Q19). A minion that is
 * itself attached to a card cannot either, whatever aims an activation at it: it "is not considered engaged with a
 * player and so cannot activate" (RRG 1.8 FAQ "Malice (#199)", p. 64; docs/phase7-wave7.md §3.44).
 */
export const cannotActivate = (state: GameState, deps: EngineDeps, enemyId: InstanceId): boolean =>
  isAttachedMinion(state, enemyId) ||
  activeRules(state, deps, "cannotActivate").some(({ rule, context }) =>
    matchesQuery(state, enemyId, rule.target, context),
  );

/**
 * Whether the boost icons and "Boost" abilities of this activation are ignored (`RuleSpec ignoreBoost`,
 * docs/phase7-wave7.md §3.67). `eventFrameId` is the activation's own event frame. A lasting rule timed to the end of
 * an attack or activation is "for this attack": it covers the activation whose frame it ends with and no other, so one
 * that begins while that attack resolves turns its boost cards up as normal. A rule still waiting on its attack
 * (`awaitingAttack`) covers none yet.
 */
export const boostIgnored = (
  state: GameState,
  deps: EngineDeps,
  enemyId: InstanceId,
  eventFrameId: FrameId | null,
): boolean =>
  activeRules(state, deps, "ignoreBoost").some(({ rule, context, lastingUntil }) => {
    if (lastingUntil?.kind === "awaitingAttack") return false;
    if (lastingUntil?.kind === "endOfEvent" && lastingUntil.frameId !== eventFrameId) return false;
    return rule.enemy === undefined || matchesQuery(state, enemyId, rule.enemy, context);
  });

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
    scheme && !iconsBlankedOn(state, deps, scheme.instanceId) && !losesIcon(state, deps, scheme.instanceId, icon)
      ? mainSchemeStageOf(state, scheme).icons.filter((i) => i === icon).length
      : 0;
  for (const id of state.villainArea) {
    const type = cardOf(state, id)?.type;
    if (type !== "side_scheme" && type !== "player_side_scheme") continue;
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
  icon: CardIcon,
  area: GameAreaState | null = null,
): number {
  let total = 0;
  const inPlay = cardsInPlay(state);
  const loses = iconLossTest(state, deps, icon);
  for (const { rule, context } of activeRules(state, deps, "gainsIcon")) {
    if (rule.icon !== icon || rule.loses) continue;
    for (const id of inPlay) {
      if (area && !sameGameArea(area, areaOfCard(state, id))) continue;
      // A blanked card has no icons, gained ones included (`iconsBlankedOn`); a card that loses the icon cannot regain it.
      if (iconsBlankedOn(state, deps, id) || loses(id)) continue;
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
 * threat box, an identity's showing face's, any other card's `schemeIcons` (its showing face's, when flipped; a player
 * side scheme's too). None on a facedown card or a blanked one (`iconsBlankedOn`).
 */
function printedIconsOn(state: GameState, deps: EngineDeps, id: InstanceId): readonly SchemeIcon[] {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card || instance.facedownAs || iconsBlankedOn(state, deps, id)) return [];
  const icons = showingIconsOn(state, id, card);
  // "Loses the [amplify] icon" (`gainsIcon.loses`, §3.38): still printed (RRG 1.8 "'Loses'", p. 27), not shown.
  return icons.filter((icon) => !losesIcon(state, deps, id, icon));
}

function showingIconsOn(state: GameState, id: InstanceId, card: AnyCard): readonly SchemeIcon[] {
  switch (card.type) {
    case "main_scheme": {
      const scheme = mainSchemeStates(state).find((candidate) => candidate.instanceId === id);
      return scheme ? mainSchemeStageOf(state, scheme).icons : [];
    }
    case "side_scheme":
      return card.icons;
    case "player_side_scheme":
      return card.schemeIcons ?? [];
    case "hero_identity": {
      // An identity's icons are its showing face's own (`HeroFace.schemeIcons`, docs/phase7-wave7.md §3.63): only that
      // face is in play, so the other faces' icons are not "in play" (RRG 1.8 "Acceleration Icon", p. 5).
      const player = state.players.find((candidate) => candidate.identity.instanceId === id);
      return (player ? identityFace(state, player).face.schemeIcons : undefined) ?? [];
    }
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
export function iconsOn(state: GameState, deps: EngineDeps, id: InstanceId, icon: CardIcon): number {
  if (!cardsInPlay(state).includes(id)) return 0;
  const printed =
    icon === "amplify"
      ? printedAmplifyOn(state, deps, id)
      : printedIconsOn(state, deps, id).filter((i) => i === icon).length;
  if (iconsBlankedOn(state, deps, id) || losesIcon(state, deps, id, icon)) return 0;
  let granted = 0;
  for (const { rule, context } of activeRules(state, deps, "gainsIcon")) {
    if (rule.icon === icon && !rule.loses && matchesQuery(state, id, rule.target, context)) granted += rule.count ?? 1;
  }
  return printed + granted;
}

/**
 * "This scheme loses the [amplify] icon" (`gainsIcon.loses`, docs/phase7-wave6.md §3.38): the card shows none of
 * `icon`, printed or gained, while a matching rule is active.
 */
export const losesIcon = (state: GameState, deps: EngineDeps, id: InstanceId, icon: CardIcon): boolean =>
  iconLossTest(state, deps, icon)(id);

/** `losesIcon` for many cards: the active loss rules for `icon` read once, then matched per card. */
export function iconLossTest(state: GameState, deps: EngineDeps, icon: CardIcon): (id: InstanceId) => boolean {
  const losing = activeRules(state, deps, "gainsIcon").filter(({ rule }) => rule.loses === true && rule.icon === icon);
  return (id) => losing.some(({ rule, context }) => matchesQuery(state, id, rule.target, context));
}

/**
 * Amplify icons one card in play shows (RRG 1.8 "Amplify Icon", p. 7), printed only: a flipped card its other face's,
 * none facedown as something else or blanked (`iconsBlankedOn`). `loses` is `iconLossTest(…, "amplify")`.
 */
export function printedAmplifyOn(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  loses: (id: InstanceId) => boolean = iconLossTest(state, deps, "amplify"),
): number {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card || instance.facedownAs || iconsBlankedOn(state, deps, id) || loses(id)) return 0;
  const back = "flipSide" in card ? card.flipSide : undefined;
  return (instance.flipped ? back?.amplifyIcons : card.amplifyIcons) ?? 0;
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
