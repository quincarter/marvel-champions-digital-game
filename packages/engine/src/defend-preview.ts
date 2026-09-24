/**
 * The defend prompt's outcome preview: what each option would cost, as a range over the boost cards nobody has turned
 * over yet.
 *
 * `preview()` is no use here — it would truncate at the first `boostCardFlipped`, which is the whole question. So this
 * is its own query, and it is the **one** place the engine does arithmetic in front of facedown cards. That is only
 * allowable because the answer is permutation-invariant over them: it is a bound taken over the *multiset* of cards
 * nobody has seen, never a peek at which card is where.
 *
 * What is public, precisely:
 *  - **The count** of facedown boost cards is exact, not a guess. The procedure deals them in step 1 and only then
 *    moves to step 2 (RRG 1.8 "Attack (Enemy Activation)", p. 9), so by the time the defend prompt is open every boost
 *    card for this attack is already on the enemy — extra ones and any dealt outside an activation (p. 11) included.
 *  - **The icons on each card** are not public until step 3 flips it (p. 9, p. 11), so they only ever appear here as a
 *    bound over the unseen pool.
 *  - **The composition of the unseen pool** is public: the players assembled the encounter deck themselves at setup,
 *    and "Each discard pile is open information, and may be looked at by any player at any time" (p. 16), so *which*
 *    cards remain unseen is legitimately derivable. Only their order is secret (p. 15 "Deck", p. 17 "Encounter Deck").
 *
 * **Flagged, not silently decided:** the RRG never says in so many words that the encounter deck's *contents* are open
 * information. It follows from how the deck is built plus the open discard pile, and every real player counts this
 * way, but it is a rules-adjacent judgement. `scope` exists so the claim can be weakened in one place: `"unseen"`
 * (the default) bounds over the cards nobody has seen; `"wholeSet"` bounds over every card in the assembled deck,
 * seen or not, which is looser but unimpeachable.
 *
 * **Boost abilities are never folded into a number.** A star icon marks a mandatory "Boost" ability (p. 11; p. 40
 * "Star Icon") that can do anything, and p. 11 is explicit that a star is *not* a boost icon and that damage dealt by
 * a boost ability is not damage dealt by the activation. So the bands cover icons only, and the possibility of an
 * ability is reported as counts (`mayTriggerBoostAbility`, `poolWithBoostAbility`) that name no card and compute no
 * probability.
 */

import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { InstanceId, FrameId, PlayerId } from "./ids.js";
import { hasKeyword, keywordTotal } from "./keywords.js";
import { boostIconsFor } from "./modifiers.js";
import {
  activeVillain,
  cardOf,
  characterProfile,
  encounterDeckOf,
  getInstance,
  getPlayer,
  homeEncounterDeckId,
  isMinion,
  maxHitPoints,
  mustInstance,
} from "./query.js";
import { cardsInPlay, controllerOf, printedAbilityRefs } from "./select.js";
import type { StackFrame, Vars } from "./stack.js";
import type { GameState } from "./state.js";

/** The numbers recorded on an activation's event frame ("gains overkill", "+N ATK", extra boost cards). */
export const activationVarsOf = (state: GameState, eventFrameId: FrameId | null): Vars => {
  const frame = eventFrameId ? state.stack.find((f) => f.frameId === eventFrameId) : undefined;
  return frame?.kind === "event" ? frame.vars : {};
};

export interface PlannedAttack {
  /** The enemy's ATK for this attack, `atkBonus` included — but an unmodifiable 0 if its ATK is printed "—". */
  readonly baseAtk: number;
  /** The defending hero's DEF, or 0. An ally's DEF never reduces. */
  readonly defenseReduction: number;
  /** `max(0, baseAtk + boostIcons − defenseReduction)`. */
  readonly damage: number;
}

/**
 * RRG 1.8 "Attack (Enemy Activation)" step 4 (p. 9): the damage an attack is about to deal.
 *
 * One implementation, two callers — the resolver calls it with the real flipped boost total, the defend preview calls
 * it once per candidate total — so the two cannot drift. The two rules that surround the arithmetic live here too: a
 * dashed ATK is "an unmodifiable 0" (p. 15 "Dash (Value)"), so a "+N ATK for this attack" does not raise it; and
 * `reduction` is the defender's DEF **only** for a hero's basic defense (p. 9 step 4, p. 15) — an ally's DEF never
 * reduces, and all the damage is dealt to the ally (p. 9 step 5).
 */
export function plannedAttackDamage(
  state: GameState,
  deps: EngineDeps,
  frame: Extract<StackFrame, { kind: "enemyAttack" }>,
  override: {
    readonly boostIcons: number;
    readonly defenderInstanceId: InstanceId | null;
    readonly basicDefense: boolean;
  },
): PlannedAttack | null {
  const enemy = characterProfile(state, frame.enemyInstanceId, deps);
  if (!enemy) return null;
  const vars = activationVarsOf(state, frame.eventFrameId);
  // `atkBonus` covers both a `modifyAttack` on the attack in progress and an `enemyAttack.atkBonus` the effect that
  // initiated this attack seeded onto it ("attacks with +X ATK"). Boost icons are added even to a dashed ATK
  // (FAQ "Green Goblin (#1B)", p. 59: a flip mid-attack deals 0 plus the icons).
  const baseAtk = enemy.atk + (enemy.missing.includes("atk") ? 0 : (vars.atkBonus ?? 0));
  const defenderProfile = override.defenderInstanceId
    ? characterProfile(state, override.defenderInstanceId, deps)
    : undefined;
  // "Use its ATK instead of its DEF for this attack" (The Best Defense…, `modifyAttack.defenseUsesAtk`; §3.22).
  const defenseStat = (vars.defenseUsesAtk ?? 0) > 0 ? "atk" : "def";
  const defenseReduction =
    override.basicDefense && defenderProfile?.kind === "identity" ? defenderProfile[defenseStat] : 0;
  return { baseAtk, defenseReduction, damage: Math.max(0, baseAtk + override.boostIcons - defenseReduction) };
}

/**
 * RRG 1.8 "Overkill" (p. 31): where excess damage carries when the attacked character is defeated. Nowhere, unless
 * the character is a minion (then to the villain) or an ally that was *defending* (then to its controller's hero) —
 * an ally hit by anything other than a defense does not spill.
 *
 * Shared by the resolver and the defend preview, so "the rest was simply lost" is one answer, not two. `defending`
 * overrides the stack scan for a defender that has not been declared yet — which is the whole point of a preview.
 */
export function overkillRecipient(state: GameState, targetId: InstanceId, defending?: boolean): InstanceId | null {
  const card = cardOf(state, targetId);
  if (isMinion(state, targetId)) {
    // "To the villain" is read as the active villain. Open (docs/phase7-wave1.md §4.5): the insert's "'the villain'
    // only refers to the active villain" speaks of card effects, and overkill is a keyword.
    const active = activeVillain(state);
    return active.defeated ? null : active.instanceId;
  }
  if (card?.type !== "ally") return null;
  const defended =
    defending ?? state.stack.some((frame) => frame.kind === "enemyAttack" && frame.defenderInstanceId === targetId);
  if (!defended) return null;
  const controller = controllerOf(state, targetId);
  return controller ? (getPlayer(state, controller)?.identity.instanceId ?? null) : null;
}

// ---------------------------------------------------------------------------
// The query
// ---------------------------------------------------------------------------

/** How many boost icons the facedown cards could add, bounded over the cards nobody has seen. */
export interface BoostBound {
  /** Exact, and public: every boost card for this attack has already been dealt when the prompt opens. */
  readonly facedownCount: number;
  readonly min: number;
  readonly max: number;
  /** How many cards the bound was taken over. */
  readonly poolSize: number;
  /** At least one card in the pool carries a "Boost" ability (a star icon), which no number can stand in for. */
  readonly mayTriggerBoostAbility: boolean;
  readonly poolWithBoostAbility: number;
  readonly scope: BoostScope;
}

export type BoostScope = "unseen" | "wholeSet";

/** One stretch of the boost range over which the outcome is the same. */
export interface DefendBand {
  readonly boostFrom: number;
  readonly boostTo: number;
  /** After DEF (RRG 1.8 p. 9 step 4). */
  readonly damageDealt: number;
  /** After a tough status (p. 44). */
  readonly damageTaken: number;
  readonly toughSpent: boolean;
  readonly defeated: boolean;
  /** Where the excess carries, and how much — absent (null/0) is "the rest was lost" (p. 31). */
  readonly overkillToInstanceId: InstanceId | null;
  readonly overkillAmount: number;
  /** Retaliate X back to the attacker: fixed across the range, but 0 where the defender does not survive (p. 38). */
  readonly retaliateToAttacker: number;
}

export interface DefendOptionPreview {
  /** Matches an option of the open `PendingChoice`. */
  readonly optionId: string;
  /** Null for "no defense". */
  readonly defenderInstanceId: InstanceId | null;
  readonly basicDefense: boolean;
  /** Who actually takes the damage. */
  readonly targetInstanceId: InstanceId;
  readonly targetPlayerId: PlayerId;
  /** What declaring this defender exhausts (p. 9 step 2). */
  readonly exhausts: readonly InstanceId[];
  readonly baseAtk: number;
  readonly defenseReduction: number;
  readonly boost: BoostBound;
  readonly bands: readonly DefendBand[];
}

const hasBoostAbility = (state: GameState, deps: EngineDeps, id: InstanceId): boolean => {
  const card = cardOf(state, id);
  if (!card) return false;
  return printedAbilityRefs(card).some((ref) => deps.abilities[ref.id]?.trigger.kind === "boost");
};

/**
 * The cards a facedown boost card could be.
 *
 * Every instance still in the enemy's own encounter deck, plus every still-unrevealed facedown card that came out of
 * that deck (the boost cards themselves, cards dealt but not yet revealed). They are all equally unknown, and the
 * boost cards were drawn from exactly that multiset — which is why reading their instance ids here is not a peek:
 * only the multiset is used, never which card is which. If the pool is smaller than the number of boost cards, the
 * discard pile is added, since that is what a reshuffle would put back (RRG 1.8 "Encounter Deck", p. 17).
 */
function unseenPool(state: GameState, enemyId: InstanceId, need: number, scope: BoostScope): readonly InstanceId[] {
  const deckId = homeEncounterDeckId(state, enemyId);
  const piles = encounterDeckOf(state, deckId);
  const fromSameDeck = (id: InstanceId): boolean => {
    const home = getInstance(state, id)?.home;
    return home?.kind === "encounterDeck" ? home.deckId === deckId : home?.kind === "activeEncounterDeck";
  };
  const facedown = (Object.keys(state.instances) as InstanceId[]).filter(
    (id) => fromSameDeck(id) && facedownOutOfDeck(state, id),
  );
  if (scope === "wholeSet") return [...piles.deck, ...piles.discard, ...facedown];
  const pool = [...piles.deck, ...facedown];
  return pool.length >= need ? pool : [...pool, ...piles.discard];
}

/** A card that is out of a deck but has never been turned over: a facedown boost card, a dealt encounter card. */
const facedownOutOfDeck = (state: GameState, id: InstanceId): boolean => {
  const instance = getInstance(state, id);
  if (!instance || instance.faceup) return false;
  const piles = Object.values(state.encounterDecks);
  return !piles.some((deck) => deck.deck.includes(id) || deck.discard.includes(id));
};

function boundOf(
  state: GameState,
  deps: EngineDeps,
  enemyId: InstanceId,
  count: number,
  scope: BoostScope,
): BoostBound {
  const pool = unseenPool(state, enemyId, count, scope);
  const icons = pool.map((id) => boostIconsFor(state, deps, id)).sort((a, b) => a - b);
  const take = Math.min(count, icons.length);
  const min = icons.slice(0, take).reduce((total, value) => total + value, 0);
  const max = icons.slice(icons.length - take).reduce((total, value) => total + value, 0);
  const withAbility = pool.filter((id) => hasBoostAbility(state, deps, id)).length;
  return {
    facedownCount: count,
    min,
    max,
    poolSize: pool.length,
    mayTriggerBoostAbility: count > 0 && withAbility > 0,
    poolWithBoostAbility: withAbility,
    scope,
  };
}

interface Outcome {
  readonly damageDealt: number;
  readonly damageTaken: number;
  readonly toughSpent: boolean;
  readonly defeated: boolean;
  readonly overkillToInstanceId: InstanceId | null;
  readonly overkillAmount: number;
  readonly retaliateToAttacker: number;
}

const sameOutcome = (a: Outcome, b: Outcome): boolean =>
  a.damageDealt === b.damageDealt &&
  a.damageTaken === b.damageTaken &&
  a.toughSpent === b.toughSpent &&
  a.defeated === b.defeated &&
  a.overkillToInstanceId === b.overkillToInstanceId &&
  a.overkillAmount === b.overkillAmount &&
  a.retaliateToAttacker === b.retaliateToAttacker;

/**
 * Whether this attack carries overkill: either the enemy has the keyword, or something granted it to this attack in
 * progress ("that attack gains overkill" records `overkill` on the activation's event frame).
 */
const attackHasOverkill = (
  state: GameState,
  deps: EngineDeps,
  frame: Extract<StackFrame, { kind: "enemyAttack" }>,
): boolean =>
  (activationVarsOf(state, frame.eventFrameId).overkill ?? 0) > 0 ||
  hasKeyword(state, frame.enemyInstanceId, "overkill", deps);

/**
 * Reports, for one option, what `boostIcons` more icons would do — including where the outcome *changes kind*, which
 * is what the bands exist to say ("5–7 damage, and at 6 or more the ally is defeated").
 */
function outcomeAt(
  state: GameState,
  deps: EngineDeps,
  frame: Extract<StackFrame, { kind: "enemyAttack" }>,
  option: {
    readonly targetInstanceId: InstanceId;
    readonly defenderInstanceId: InstanceId | null;
    readonly basicDefense: boolean;
  },
  boostIcons: number,
  overkill: boolean,
  ranged: boolean,
): Outcome {
  const planned = plannedAttackDamage(state, deps, frame, {
    boostIcons,
    defenderInstanceId: option.defenderInstanceId,
    basicDefense: option.basicDefense,
  });
  const damageDealt = planned?.damage ?? 0;
  const target = getInstance(state, option.targetInstanceId);
  const maxHp = maxHitPoints(state, option.targetInstanceId, deps) ?? 0;
  const already = target?.damage ?? 0;

  // RRG 1.8 "Tough" (p. 44): the damage is prevented and the status card is discarded — except that a hero making a
  // basic defense reduces by DEF first and *keeps* the tough if the result is 0 (p. 9 step 5), which the resolver
  // gets right by returning before any of this when the amount is 0 or less.
  const hasTough = (target?.statuses.tough ?? 0) > 0;
  const damageTaken = damageDealt <= 0 || hasTough ? 0 : damageDealt;
  const toughSpent = damageDealt > 0 && hasTough;

  const defeated = damageTaken > 0 && already + damageTaken >= maxHp;
  const excess = overkill && defeated ? already + damageTaken - maxHp : 0;
  // The defender has not been declared yet, so the preview says who it would be rather than reading the frame.
  const recipient =
    excess > 0
      ? overkillRecipient(state, option.targetInstanceId, option.defenderInstanceId === option.targetInstanceId)
      : null;

  // RRG 1.8 "Retaliate X" (p. 38): a forced response after the character is attacked, so the character must still be
  // in play once the attack resolves; and "Ranged" (p. 37) — an attack with ranged ignores retaliate entirely.
  const retaliate = ranged || defeated ? 0 : keywordTotal(state, option.targetInstanceId, "retaliate", deps);

  return {
    damageDealt,
    damageTaken,
    toughSpent,
    defeated,
    overkillToInstanceId: recipient,
    overkillAmount: recipient ? excess : 0,
    retaliateToAttacker: retaliate,
  };
}

/**
 * The open defend prompt's options, each with what it would cost. Null unless a `declareDefender` choice is open.
 *
 * The attack itself is read off the frame `PendingChoice.frameId` names — the procedure requests the choice with its
 * own frame id, so there is no need for a second record of which attack is being defended.
 */
export function defendPreview(
  state: GameState,
  deps: EngineDeps = DEFAULT_DEPS,
  opts: { readonly scope?: BoostScope } = {},
): readonly DefendOptionPreview[] | null {
  const choice = state.pendingChoice;
  if (!choice || choice.prompt.kind !== "declareDefender") return null;
  const frame = state.stack.find((f) => f.frameId === choice.frameId);
  if (frame?.kind !== "enemyAttack") return null;

  const scope = opts.scope ?? "unseen";
  const inPlay = cardsInPlay(state);
  const facedownCount = mustInstance(state, frame.enemyInstanceId).boostCards.filter(
    (id) => getInstance(state, id)?.faceup !== true,
  ).length;
  const boost = boundOf(state, deps, frame.enemyInstanceId, facedownCount, scope);
  const overkill = attackHasOverkill(state, deps, frame);
  const ranged = hasKeyword(state, frame.enemyInstanceId, "ranged", deps);

  return choice.options.map((option) => {
    const defenderInstanceId =
      option.ref.kind === "card" && inPlay.includes(option.ref.instanceId) ? option.ref.instanceId : null;
    // Declaring a defender through this prompt is always a basic defense (p. 9 step 2); "no defense" leaves the
    // attack's existing target where it is.
    const basicDefense = defenderInstanceId !== null;
    const targetInstanceId = defenderInstanceId ?? frame.targetInstanceId;
    const targetPlayerId =
      (defenderInstanceId ? controllerOf(state, defenderInstanceId) : null) ?? frame.targetPlayerId;
    const shape = { targetInstanceId, defenderInstanceId, basicDefense };
    const planned = plannedAttackDamage(state, deps, frame, { boostIcons: 0, defenderInstanceId, basicDefense });

    const bands: DefendBand[] = [];
    for (let icons = boost.min; icons <= boost.max; icons++) {
      const outcome = outcomeAt(state, deps, frame, shape, icons, overkill, ranged);
      const last = bands[bands.length - 1];
      if (last && sameOutcome(last, outcome)) bands[bands.length - 1] = { ...last, boostTo: icons };
      else bands.push({ boostFrom: icons, boostTo: icons, ...outcome });
    }

    return {
      optionId: option.optionId,
      defenderInstanceId,
      basicDefense,
      targetInstanceId,
      targetPlayerId,
      exhausts: defenderInstanceId ? [defenderInstanceId] : [],
      baseAtk: planned?.baseAtk ?? 0,
      defenseReduction: planned?.defenseReduction ?? 0,
      boost,
      bands,
    };
  });
}
