import type {
  CampaignLogValueSpec,
  CardDestination,
  CardSelector,
  CollectionSearchFilter,
  EventPattern,
  EffectSpec,
  FacedownRole,
  LastingUntil,
  NextBasicPowerUntil,
  LogWriteMode,
  PairLimit,
  PlayerRef,
  PlayerZone,
  Predicate,
  ReportedFact,
  ResourceRequirement,
  RuleSpec,
  ScenarioDeckSource,
  StatName,
  StatusName,
  TargetQuery,
  TargetRef,
} from "@mc/engine";
import { abilityId, type KeywordInstance, type Trait } from "@mc/content";
import {
  amount,
  chosen,
  query,
  self,
  TRAIT,
  you,
  yourIdentity,
  identityOf,
  theVillain,
  theMainScheme,
  valueAtLeast,
  varOf,
  type Amount,
  type AttackKeyword,
} from "./values.js";

/**
 * Effects — the verbs of the ability DSL. Every builder returns an engine
 * `EffectSpec` (or a short list of them for sugar like `attackAnEnemy`).
 * Ability builders accept nested lists and flatten them, so a card reads as a
 * sequence of printed sentences.
 */

export type EffectArg = EffectSpec | readonly EffectArg[];

export const flatten = (args: readonly EffectArg[]): EffectSpec[] =>
  args.flatMap((arg) => (Array.isArray(arg) ? flatten(arg as readonly EffectArg[]) : [arg as EffectSpec]));

const withBind = (bind: string | undefined) => (bind !== undefined ? { bind } : {});

// ---------------------------------------------------------------------------
// Damage, healing, threat
// ---------------------------------------------------------------------------

export const draw = (n: Amount = 1, player: PlayerRef = you): EffectSpec => ({
  kind: "draw",
  player,
  amount: amount(n),
});
export const drawUpTo = (n: Amount, player: PlayerRef = you): EffectSpec => ({
  kind: "drawUpTo",
  player,
  amount: amount(n),
});
export const heal = (n: Amount, target: TargetRef, opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "heal",
  target,
  amount: amount(n),
  ...withBind(opts.bind),
});
/**
 * "Deal N damage to X" — not an attack (no guard, no retaliate).
 *
 * `perTarget`: "deal 2 damage to each enemy for each bomb counter removed from it" (Boom Boom, `mut_gen` 32090) — `n`
 * is read once per target, with `theAffectedCard` / `chosen("affected")` that target; a target owed 0 is dealt none.
 *
 * `by`: "**the player who defeated this scheme** deals 5 damage to the villain" (Lay the Trap, `psylocke` 41016) is
 * `dealDamage(5, theVillain, { by: defeatingPlayer })`: the player the card names as dealing it. A ref that names no
 * player still deals the damage, by no player (`EffectSpec dealDamage.by`; docs/phase7-wave7.md §4.1 Q2).
 *
 * **In an "(attack)" ability, after its `attack(...)`:** the engine makes this damage that attack's whenever the target
 * is an enemy (RRG 1.8 "Attack (Player Ability Type)", p. 10: the ability is a single attack; owner ruling,
 * docs/phase7-wave8.md §4.1 Q47). Write the further instances as plain `dealDamage`: "deal 2 damage to an enemy; for
 * each …, choose an enemy and deal 2 damage to it" is `attack(2, …)` then `dealDamage(2, …)`, and every instance
 * takes "+1 damage from each attack", names its enemy as attacked (one retaliate each) and counts for "after you
 * attack and defeat". Damage to your own identity or an ally is never the attack's. `fromAttack: false` keeps one
 * instruction out of the attack; `fromAttack: true` is an attack's damage dealt by this card itself (no hero attack).
 */
export const dealDamage = (
  n: Amount,
  target: TargetRef,
  opts: {
    readonly bind?: string;
    readonly perTarget?: boolean;
    readonly sourceFromEvent?: boolean;
    readonly by?: PlayerRef;
    readonly fromAttack?: boolean;
  } = {},
): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: amount(n),
  ...(opts.fromAttack !== undefined ? { fromAttack: opts.fromAttack } : {}),
  ...withBind(opts.bind),
  ...(opts.perTarget ? { perTarget: true as const } : {}),
  ...(opts.sourceFromEvent ? { sourceFromEvent: true as const } : {}),
  ...(opts.by ? { by: opts.by } : {}),
});
/**
 * "You take N damage" / "Take N damage": your identity takes it. `taken` (docs/phase7-wave6.md §3.41, §4.1 Q21): no
 * "that event deals N additional damage" bonus (Embiggen!, Cybernetic Arm, Aggressive Energy) adds to it.
 */
export const takeDamage = (n: Amount, player: PlayerRef = you): EffectSpec => ({
  kind: "dealDamage",
  target: identityOf(player),
  amount: amount(n),
  taken: true,
});
export const placeThreat = (n: Amount, target: TargetRef, opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "placeThreat",
  target,
  amount: amount(n),
  ...withBind(opts.bind),
});
/**
 * "Remove N threat" — not a thwart, unless the ability is labeled "(thwart)": the engine then resolves it as `thwart`
 * by your identity (RRG 1.8 "Labeled Ability", p. 26), so either builder may be used there. `ignoreCrisis`: "…, ignoring
 * any crisis icons in play" (Cable Arrow, `trors`): steps over the RRG 1.8 "Crisis Icon" (p. 14) check that
 * otherwise stops players removing threat from the main scheme while one is in play.
 *
 * `by`: "**the player who defeated this scheme** removes 5 threat from the main scheme" (Keep Them Busy, `x23` 43018)
 * is `removeThreat(5, mainScheme, { by: defeatingPlayer })`: the player the card names as removing it, in place of the
 * player using the ability. A ref that names no player still removes the threat, by no player (`EffectSpec
 * removeThreat.by`; docs/phase7-wave7.md §4.1 Q2).
 */
export const removeThreat = (
  n: Amount,
  target: TargetRef,
  opts: { readonly bind?: string; readonly ignoreCrisis?: boolean; readonly by?: PlayerRef } = {},
): EffectSpec => ({
  kind: "removeThreat",
  target,
  amount: amount(n),
  ...(opts.ignoreCrisis ? { ignoreCrisis: true } : {}),
  ...withBind(opts.bind),
  ...(opts.by ? { by: opts.by } : {}),
});
export const placeDamage = (n: Amount, target: TargetRef): EffectSpec => ({
  kind: "placeDamage",
  target,
  amount: amount(n),
});
/**
 * "Set his hit point dial to N instead" (Captain America's Helmet, `cap` pack): sets the remaining-hit-points dial
 * directly. Not a heal — the card doesn't say "heal" — so it fires no heal event (docs/phase7-wave1.md §3.13).
 */
export const setRemainingHitPoints = (n: Amount, target: TargetRef): EffectSpec => ({
  kind: "setRemainingHitPoints",
  target,
  amount: amount(n),
});
/**
 * "Reset his hit points" (MaGog, `mojo`; docs/phase7-wave6.md §3.67): the dial set to the character's maximum hit
 * points, whatever modifies them. `setRemainingHitPoints` caps the amount at the maximum, so this sets no damage, and
 * announces `hitPointsReset` ("After MaGog's hit points are reset", `on.hitPointsReset`).
 */
export const resetHitPoints = (target: TargetRef): EffectSpec => setRemainingHitPoints(Number.MAX_SAFE_INTEGER, target);
/**
 * "…get +N to that power for this use" (Rapid Growth 13005, Venom's Pistol; docs/phase7-wave2.md §17.4): a bonus to
 * whichever basic power is being used, read off the `basicPowerUsing` event on the stack (`on.basicPowerUsing`
 * must be this ability's own trigger) and lasting only for that one activation. Does nothing outside a basic-power
 * use — an ability that reaches for this effect with no `basicPowerUsing` on the stack resolves into nothing.
 */
export const modifyBasicPower = (n: Amount): EffectSpec => ({ kind: "modifyBasicPower", amount: amount(n) });
/**
 * "That character uses their THW instead of their ATK" (Befuddle 33033, "Interrupt: When a character makes a basic
 * attack against attached minion"; docs/phase7-wave6.md §3.32): the basic attack being made deals the attacker's THW
 * with its THW modifiers, and no ATK modifier applies (§4.1 Q22). Interrupting the `attack` event (`on.attacks` with
 * `attackKind: "basic"`) or a `basicPowerUsing` for an attack; otherwise it is still a basic attack, ATK-field
 * consequential damage included.
 */
export const useThwInsteadOfAtk = (): EffectSpec => ({ kind: "modifyBasicPower", useStat: "thw" });

/**
 * The "(attack)" body: resolves as an attack by your identity (guard, retaliate, "after X attacks" apply).
 *
 * `keywords` is this activation's own attack-keyword grant — "this attack gains piercing" (Vibranium Arrow, Piercing
 * Strike): exact for a played event's one-shot attack, unlike a persistent `constant(...attacksGainKeywords(...))`
 * grant, which needs the granting card to stay in play (docs/phase7-wave2.md §3, `RuleSpec attackKeywords`).
 */
export const attack = (
  n: Amount,
  target: TargetRef,
  opts: {
    readonly overkill?: boolean;
    readonly attacker?: TargetRef;
    readonly moveDamageFrom?: TargetRef;
    readonly bind?: string;
    readonly keywords?: readonly AttackKeyword[];
  } = {},
): EffectSpec => ({
  kind: "attack",
  target,
  amount: amount(n),
  ...(opts.overkill ? { overkill: true } : {}),
  ...(opts.attacker ? { attacker: opts.attacker } : {}),
  ...(opts.moveDamageFrom ? { moveDamageFrom: opts.moveDamageFrom } : {}),
  ...(opts.keywords && opts.keywords.length > 0 ? { keywords: opts.keywords } : {}),
  ...withBind(opts.bind),
});
/**
 * The "(thwart)" body: resolves as a thwart by your identity (confused and crisis apply). `ignoreCrisis`: "…,
 * ignoring any crisis icons in play" (Cable Arrow, `trors`) — carried through to the removal this thwart makes.
 */
export const thwart = (
  n: Amount,
  target: TargetRef,
  opts: {
    readonly thwarter?: TargetRef;
    readonly bind?: string;
    readonly ignoreCrisis?: boolean;
    /** "…, ignoring the patrol keyword" (Just Passing Through, `vision` 26010; docs/phase7-wave4.md §3.32). */
    readonly ignorePatrol?: boolean;
  } = {},
): EffectSpec => ({
  kind: "thwart",
  target,
  amount: amount(n),
  ...(opts.thwarter ? { thwarter: opts.thwarter } : {}),
  ...(opts.ignoreCrisis ? { ignoreCrisis: true } : {}),
  ...(opts.ignorePatrol ? { ignorePatrol: true } : {}),
  ...withBind(opts.bind),
});

// ---------------------------------------------------------------------------
// Statuses, exhaust, counters, discard
// ---------------------------------------------------------------------------

/**
 * `opts.bind`: `<bind>.amount` is how many were actually given (none to a character already at capacity) — "If no
 * tough status card was given this way" (Magic Muscle, `hood` 24070; docs/phase7-wave4.md §3.60).
 */
export const giveStatus = (
  target: TargetRef,
  status: StatusName,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({
  kind: "giveStatus",
  target,
  status,
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
export const stun = (target: TargetRef): EffectSpec => giveStatus(target, "stunned");
export const confuse = (target: TargetRef): EffectSpec => giveStatus(target, "confused");
/** "Give X a tough status card". */
export const giveTough = (target: TargetRef, opts: { readonly bind?: string } = {}): EffectSpec =>
  giveStatus(target, "tough", opts);
/**
 * "Discard each [status] card from X" / the removal half of "replace that status card with a different status card"
 * (Vapors of Valtorr, `drs` pack). Every card of that type the target holds (a character holding several, Colossus,
 * loses all of them) unless `opts.count` caps it per target ("discard a tough status card", Steel Fist, `mut_gen`
 * 32008); a character with none is unaffected. `opts.bind`: `<bind>.amount` is how many were actually discarded,
 * summed ("If you discarded no tough status cards this way", Homesick, 32025; docs/phase7-wave6.md §3.6).
 */
export const removeStatus = (
  target: TargetRef,
  status: StatusName,
  opts: { readonly count?: number; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "removeStatus",
  target,
  status,
  ...(opts.count !== undefined ? { count: opts.count } : {}),
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
export const exhaust = (target: TargetRef): EffectSpec => ({ kind: "exhaust", target });
export const ready = (target: TargetRef): EffectSpec => ({ kind: "ready", target });
/** "Discard X" for a card in play. */
export const discard = (target: TargetRef): EffectSpec => ({ kind: "discardFromPlay", target });
/**
 * "Defeat a non-[Elite] minion." (Nova Prime, `stld` 17002; docs/phase7-wave3.md §3.9): a character defeated by
 * effect rather than by damage. Everything that sees an ordinary defeat sees this one (interrupts, When Defeated,
 * Victory X, `cannotBeDefeated`); a villain's stage falls the same way "Villain Defeat" (RRG 1.8 p. 47) describes,
 * and an identity's player is eliminated. Characters only.
 */
export const defeat = (target: TargetRef): EffectSpec => ({ kind: "defeat", target });
/**
 * "… return it to its owner's hand **instead of discarding it**" (Regroup, `drax` 19032; docs/phase7-wave3.md §3.45):
 * from an interrupt to a character's defeat, the card goes to `to` instead of its discard pile. It is still defeated.
 */
export const setDefeatDestination = (to: CardDestination): EffectSpec => ({ kind: "setDefeatDestination", to });
/**
 * "Cosmo does not take consequential damage for this use." (Cosmo, `stld` 17020, errata RRG 1.8 p. 67; docs/phase7-
 * wave3.md §3.21): cancels the named character's pending consequential damage from its current attack or thwart.
 * `character` defaults to the ability's own card.
 */
export const cancelConsequentialDamage = (character: TargetRef = self): EffectSpec => ({
  kind: "cancelConsequentialDamage",
  character,
});
/**
 * "Dust takes +1 consequential damage after this attack" (Dust, `cyclops` 33012; docs/phase7-wave6.md §3.31): adds
 * `n` (signed) to the named character's pending consequential damage from its current attack or thwart, for that one
 * use. The standing form ("Havok takes +1 consequential damage") is the rule `takesConsequentialDamage`.
 */
export const modifyConsequentialDamage = (n: Amount, character: TargetRef = self): EffectSpec => ({
  kind: "modifyConsequentialDamage",
  character,
  amount: amount(n),
});
/**
 * `opts.upTo`: "(to a maximum of 10)" (Growth Spurt, `gmw` 16001b; Drax's vengeance counters, `drax`) — places at
 * most as many as bring the card to that total, locally to this effect (docs/phase7-wave3.md §3.10). `opts.bind`:
 * `<bind>.amount` reports how many were actually placed.
 */
export const addCounters = (
  counterType: string,
  n: Amount,
  target: TargetRef = self,
  opts: { readonly upTo?: Amount; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: amount(n),
  ...(opts.upTo !== undefined ? { upTo: amount(opts.upTo) } : {}),
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
export const surge = (): EffectSpec => ({ kind: "gainSurge" });

// ---------------------------------------------------------------------------
// Control flow and choices
// ---------------------------------------------------------------------------

export const ifThen = (condition: Predicate, then: EffectArg, otherwise?: EffectArg): EffectSpec => ({
  kind: "if",
  condition,
  then: flatten([then]),
  ...(otherwise !== undefined ? { otherwise: flatten([otherwise]) } : {}),
});

/**
 * The printed "Then": "…. Then, discard Quinjet." The effects run only if the text before them fully resolved (RRG 1.8
 * "'Then'", p. 44): a required choice before it that found nothing skips them. Post-"then" text is also not a part of
 * the ability of its own when the engine asks whether the ability can be initiated at all (RRG 1.8 "Choose (Game
 * Element)", p. 12). Plain "and"/a new sentence is not a "then": list those effects after the choice as usual.
 */
export const andThen = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "then", effects: flatten(effects) });

export interface ChoiceOption {
  readonly label: string;
  readonly condition?: Predicate;
  readonly effects: readonly EffectSpec[];
}
/** One option of `chooseOne`; `when` limits it to states where it can happen. */
export const option = (label: string, ...rest: readonly (EffectArg | { readonly when: Predicate })[]): ChoiceOption => {
  const condition = rest.find((r): r is { readonly when: Predicate } => !Array.isArray(r) && "when" in (r as object));
  const effects = rest.filter((r): r is EffectArg => Array.isArray(r) || !("when" in (r as object)));
  return { label, ...(condition ? { condition: condition.when } : {}), effects: flatten(effects) };
};
/** "Choose one: …" / "Choose to either … or …" (made by you). */
export const chooseOne = (...options: readonly ChoiceOption[]): EffectSpec => chooseOneBy(you, ...options);
export const chooseOneBy = (chooser: PlayerRef, ...options: readonly ChoiceOption[]): EffectSpec => ({
  kind: "chooseOne",
  chooser,
  options,
});
/** "Choose a player." Refer to them with `chosenPlayer(slot)`. */
export const choosePlayer = (
  slot = "player",
  chooser: PlayerRef = you,
  opts: {
    /**
     * Only these players are eligible — the tie of a `superlativePlayer` ("the player engaged with the fewest
     * minions", Drang III; docs/phase7-wave3.md §3.35). One eligible player is bound without asking.
     */
    readonly among?: PlayerRef;
  } = {},
): EffectSpec => ({
  kind: "choosePlayer",
  slot,
  chooser,
  ...(opts.among ? { among: opts.among } : {}),
});
/** "Each player …": the effects run once per player with `thatPlayer`. */
export const forEachPlayer = (players: PlayerRef, ...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "forEachPlayer",
  players,
  effects: flatten(effects),
});
/**
 * "Choose a/an X" (`count` for "X enemies"). `upTo`: a printed "up to X" — at least one whenever a legal target exists
 * (docs/phase7-wave3.md §4 Q16, decided by the user on 2026-09-23). `optional`: only for a printed "may", which lets the
 * chooser pick none. With no legal target nothing is asked either way, so neither is needed for "if able".
 */
export const chooseTarget = (
  slot: string,
  q: TargetQuery,
  opts: {
    readonly chooser?: PlayerRef;
    readonly upTo?: boolean;
    readonly optional?: boolean;
    readonly count?: Amount;
  } = {},
): EffectSpec => ({
  kind: "chooseTarget",
  slot,
  query: q,
  chooser: opts.chooser ?? you,
  ...(opts.upTo ? { upTo: true as const } : {}),
  ...(opts.optional ? { optional: true } : {}),
  ...(opts.count !== undefined ? { count: amount(opts.count) } : {}),
});
export const bindTargets = (slot: string, target: TargetRef): EffectSpec => ({ kind: "bindTargets", slot, target });

// ---------------------------------------------------------------------------
// Enemy actions, attack/scheme modification, prevention and cancellation
// ---------------------------------------------------------------------------

/**
 * "Rhino attacks you" / "Green Goblin attacks with +X ATK" (Death from Above).
 *
 * `atkBonus` is scoped to exactly the attack this call initiates — use it, never a `modifyStat(..., "endOfPhase")`
 * ahead of the call, which would also buff any *other* activation in the same phase (a second copy of the card, a
 * surge chain, another player's reveal).
 */
export const enemyAttack = (
  enemies: TargetRef,
  opts: {
    readonly against?: PlayerRef;
    readonly bind?: string;
    readonly additionalResolution?: boolean;
    readonly atkBonus?: Amount;
    /** "…attacks you after this activation": queued behind the activation now resolving rather than nested in it. */
    readonly afterCurrentActivation?: boolean;
    /** "Do not deal any boost cards for that attack." */
    readonly noBoost?: boolean;
    /**
     * "… attacks that character" (Speed Demon, `hood` 24046; docs/phase7-wave4.md §3.21) / "attacks the hero with the
     * fewest hit points remaining" (Mad Genius): the attack is against this character, its controller the attacked
     * player. `EffectSpec enemyAttack.targetCharacter` (wave 1 §3.6), which wave 1's packs wrapped locally.
     */
    readonly targetCharacter?: TargetRef;
    /**
     * "The villain attacks you. That attack gains overkill" (Total Annihilation; Avatar of Death; Calvin Zabo): keywords
     * for exactly the attacks this effect initiates (docs/phase7-wave4.md §3.51). Not `modifyAttack` after it, which
     * runs once the attack has already resolved.
     */
    readonly keywords?: readonly AttackKeyword[];
    /**
     * "The villain attacks you. Give the villain 1 additional boost card for that activation" (Swinging Assault):
     * extra boost cards dealt at the start of exactly the activations this call initiates; none if no activation
     * happens (docs/phase7-wave5.md §4.1 Q66). Not `modifyAttack` after it, which runs once the attack has resolved.
     */
    readonly extraBoostCards?: Amount;
    /**
     * "Each boost card turned faceup during that activation gets +1 boost icon" (Biting Retort): added to every boost
     * card the activations this call initiates turn faceup, and to no other (docs/phase7-wave5.md §4.1 Q66).
     */
    readonly boostIconsEach?: Amount;
  } = {},
): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...(opts.targetCharacter ? { targetCharacter: opts.targetCharacter } : {}),
  ...withBind(opts.bind),
  ...(opts.noBoost ? { boost: false } : {}),
  ...(opts.afterCurrentActivation ? { after: "currentActivation" as const } : {}),
  ...(opts.additionalResolution ? { additionalResolution: true } : {}),
  ...(opts.atkBonus !== undefined ? { atkBonus: amount(opts.atkBonus) } : {}),
  ...(opts.keywords && opts.keywords.length > 0 ? { keywords: opts.keywords } : {}),
  ...activationBoost(opts),
});
/** `enemyAttack`/`enemyScheme`'s activation-scoped boost changes (docs/phase7-wave5.md §4.1 Q66). */
const activationBoost = (opts: { readonly extraBoostCards?: Amount; readonly boostIconsEach?: Amount }) => ({
  ...(opts.extraBoostCards !== undefined ? { extraBoostCards: amount(opts.extraBoostCards) } : {}),
  ...(opts.boostIconsEach !== undefined ? { boostIconsEach: amount(opts.boostIconsEach) } : {}),
});
/**
 * "The villain schemes" / "Green Goblin schemes with +X SCH" — `enemyAttack`'s `atkBonus`, for a scheme activation;
 * `extraBoostCards` / `boostIconsEach` as `enemyAttack`'s.
 */
export const enemyScheme = (
  enemies: TargetRef,
  opts: {
    readonly against?: PlayerRef;
    readonly bind?: string;
    readonly schBonus?: Amount;
    readonly extraBoostCards?: Amount;
    readonly boostIconsEach?: Amount;
  } = {},
): EffectSpec => ({
  kind: "enemyScheme",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
  ...(opts.schBonus !== undefined ? { schBonus: amount(opts.schBonus) } : {}),
  ...activationBoost(opts),
});
/**
 * "Venom activates against you" (Biting Retort, `sm` 27082): the enemies activate against the player the way the
 * villain phase activates them, attacking a player in hero form and scheming against one in alter-ego form, read when
 * the effect resolves (RRG 1.8 "Activation", p. 6; docs/phase7-wave5.md §4.1 Q67). Not `enemyAttack`, which is only
 * for "attacks you". The options are `enemyAttack`'s and `enemyScheme`'s: `atkBonus` / `keywords` apply if it is an
 * attack, `schBonus` if it is a scheme, `extraBoostCards` / `boostIconsEach` (§4.1 Q66) to either.
 */
export const enemyActivates = (
  enemies: TargetRef,
  opts: {
    readonly against?: PlayerRef;
    readonly bind?: string;
    /** "…activates against you after this activation": queued behind the activation now resolving. */
    readonly afterCurrentActivation?: boolean;
    /** "Do not deal any boost cards for that activation." */
    readonly noBoost?: boolean;
    readonly atkBonus?: Amount;
    readonly keywords?: readonly AttackKeyword[];
    readonly schBonus?: Amount;
    readonly extraBoostCards?: Amount;
    readonly boostIconsEach?: Amount;
  } = {},
): EffectSpec => ({
  kind: "enemyActivation",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
  ...(opts.noBoost ? { boost: false } : {}),
  ...(opts.afterCurrentActivation ? { after: "currentActivation" as const } : {}),
  ...(opts.atkBonus !== undefined ? { atkBonus: amount(opts.atkBonus) } : {}),
  ...(opts.keywords && opts.keywords.length > 0 ? { keywords: opts.keywords } : {}),
  ...(opts.schBonus !== undefined ? { schBonus: amount(opts.schBonus) } : {}),
  ...activationBoost(opts),
});
/**
 * "That minion attacks another enemy" (Moondragon, `drax` 19013): `attacker` attacks `target`, an enemy attacking an
 * enemy. An attack, not an activation (docs/phase7-wave3.md §3.23, §4 Q12): no boost card, no defense, and "when this
 * enemy attacks" abilities stay silent; the target's tough, retaliate and the attacker's overkill apply. Pair with
 * `enemyToAttack` for the two choices. `bind`: `<bind>.made`, `.damage`, `.defeated`.
 */
/**
 * "If the Gamora hero or ally is in play, she attacks you (resolve her ATK against you without exhausting her)." (Old
 * Rivals, `nebu` 22031): a friendly character (hero-form identity or controlled ally) attacks `player`'s identity, as
 * her controller's attack. `bind`: `<bind>.made` (0 when no attack was made). docs/phase7-wave4.md §3.26.
 */
/**
 * "While Karma is in play, take control of that minion and treat it as a [Controlled] ally with a blank text box. Its
 * THW is equal to its printed SCH and it takes 2 consequential damage after it thwarts or attacks." (Karma, `rogue`
 * 38011): `treatAsAlly(chosen("minion"), [CONTROLLED], 2)`, lasting while this card is in play. docs/phase7-wave4.md
 * §3.29.
 */
export const treatAsAlly = (target: TargetRef, traits: readonly Trait[], consequential: number): EffectSpec => ({
  kind: "treatAsAlly",
  target,
  traits,
  thwFromSch: true,
  consequential,
});
/**
 * "When a boost card on an enemy attacking you would be turned faceup, discard it instead." (Defiance, `vision`
 * 26018): the boost card resolving now is discarded, its Boost ability and icons never applied. docs/phase7-wave4.md
 * §3.35.
 */
export const discardBoostCard = (opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "discardBoostCard",
  ...withBind(opts.bind),
});
export const friendlyCharacterAttacks = (
  attacker: TargetRef,
  player: PlayerRef = you,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({ kind: "friendlyCharacterAttacks", attacker, player, ...withBind(opts.bind) });
/**
 * "That player makes a basic attack or thwart with a character they control. That character gets +1 THW and +1 ATK for
 * this use." (Cell Phone, `jubilee` 47019; docs/phase7-wave8.md §3.64): `basicPowerBy(chosenPlayer("player"),
 * ["attack", "thwart"], { bonus: { thw: 1, atk: 1 } })`. `player` chooses a ready character of theirs, one of `powers`
 * and a legal target, and the ordinary basic power is made, on anyone's turn: the character exhausts, guard, crisis,
 * patrol and "cannot" rules hold, a stunned or confused character loses the status card instead, "basic" triggers hear
 * it, an ally takes its consequential damage. `bonus` is on that character for that use only. Not optional; with no
 * legal use nothing happens, so gate the ability and the player choice with `canUseBasicPower`.
 */
export const basicPowerBy = (
  player: PlayerRef,
  powers: readonly ("attack" | "thwart")[],
  opts: { readonly bonus?: { readonly thw?: number; readonly atk?: number } } = {},
): EffectSpec => {
  if (powers.length === 0) throw new Error("basicPowerBy needs at least one power");
  return { kind: "basicPowerBy", player, powers, ...(opts.bonus ? { bonus: opts.bonus } : {}) };
};
export const enemyAttacksEnemy = (
  attacker: TargetRef,
  target: TargetRef,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({ kind: "enemyAttacksEnemy", attacker, target, ...withBind(opts.bind) });
/**
 * "Choose a minion. That minion attacks another enemy of your choice." — both choices, then the attack. The first
 * choice only offers a card with another enemy it could attack (`canAttackOneOf`), so an ability with none has no
 * valid target (RRG 1.8 "Target", pp. 42–43); pair the action with `while: enemyCanAttackAnother(...)` so it cannot be
 * initiated (and its cost paid) for nothing. `attackers` is the printed "a minion"; the target is any other enemy the
 * chosen one may attack.
 */
export const enemyToAttack = (
  attackers: TargetQuery,
  opts: { readonly attackerSlot?: string; readonly targetSlot?: string; readonly bind?: string } = {},
): EffectSpec[] => {
  const attackerSlot = opts.attackerSlot ?? "attacker";
  const targetSlot = opts.targetSlot ?? "attacked";
  const who: TargetRef = { kind: "slot", slot: attackerSlot };
  return [
    chooseTarget(attackerSlot, { ...attackers, canAttackOneOf: { categories: ["enemy"] } }),
    chooseTarget(targetSlot, { categories: ["enemy"], attackableBy: who, excluding: who }),
    enemyAttacksEnemy(who, { kind: "slot", slot: targetSlot }, opts.bind ? { bind: opts.bind } : {}),
  ];
};
/** The `while` for `enemyToAttack`: some card `attackers` matches has another enemy it could attack. */
export const enemyCanAttackAnother = (attackers: TargetQuery): Predicate => ({
  kind: "exists",
  query: { ...attackers, canAttackOneOf: { categories: ["enemy"] } },
});
/**
 * `extraBoostCards` accepts a live `Amount`, not just a literal number — "give him an additional boost card for
 * each side scheme in play" (Master Strategist, `trors`, docs/phase7-wave2.md §3.11) needs `countOf(query
 * ("sideScheme"))`, and the engine's own `EffectSpec` (`packages/engine/src/spec.ts`) already types the field as
 * `number | ValueSpec`; this DSL wrapper hadn't been updated to match until Master Strategist needed it.
 */
/**
 * `keywords` — "the attack gains piercing" (Crossfire's Rifle boost, `trors`): the engine reads the granted var only
 * while an *attack* activation is on the stack (`resolve/apply-effect.ts` `case "modifyAttack"` stamps the var
 * unconditionally, but `enemy-activation.ts`'s scheme path never reads it), so "if this boost resolves during an
 * attack" needs no separate condition here — a boost that resolves during a scheme activation harmlessly no-ops.
 */
export const modifyAttack = (change: {
  readonly overkill?: boolean;
  readonly extraBoostCards?: Amount;
  readonly atkBonus?: Amount;
  /**
   * "This attack deals 3 additional damage" (Coup de Grâce, Full Blast, Warrior Skill; docs/phase7-wave6.md §3.29): a
   * player attack in progress (basic, "(attack)" ability or event) deals N more, added after its amount is computed.
   */
  readonly extraDamage?: Amount;
  readonly threatBonus?: Amount;
  /**
   * "This activation removes threat instead of placing it" (Psychic Manipulation 34017; docs/phase7-wave6.md §3.35),
   * from an interrupt to the villain's scheme: its total (SCH, boost icons, `threatBonus`) is removed from the scheme
   * it would have gone on, as this card's removal, so a crisis icon stops it (nothing placed, nothing removed; §4.1 Q17).
   * On a "(thwart)"-labeled ability the removal is a thwart by your identity, and "after you thwart" answers it (RRG
   * 1.8 "Labeled Ability", p. 26; owner decision, 2026-10-03). The ability is then not offered while you cannot thwart
   * the scheme the activation would place threat on (a crisis icon, an engaged patrol minion; RRG 1.8 "Target", p. 43).
   */
  readonly removesThreat?: true;
  /**
   * "Damage from that attack is dealt to the chosen enemy instead of you" (Psychic Misdirection 34033;
   * docs/phase7-wave6.md §3.36), from an interrupt to the enemy attack: the first enemy the ref names, other than the
   * attacker, takes the attack's damage instead, as attack damage from the attacker without being attacked (§4.1 Q18).
   */
  readonly damageTo?: TargetRef;
  /**
   * "That attack removes threat from the main scheme instead of dealing damage" (Determined Defense, `mut_gen` 32189),
   * from an interrupt to the enemy attack or to a defense against it: the attack deals no damage, and the amount it
   * calculated (ATK, boost icons, less a basic defense's DEF) comes off the scheme. `thwart`: the ability is labeled
   * "(thwart)", so the removal is a thwart by your identity ("after you thwart" answers it); a "(thwart)" label
   * on the ability implies it. The scheme is the ability's target: a player cannot trigger the ability while the scheme
   * cannot be affected (a crisis icon; for a thwart, an engaged patrol minion or a "cannot thwart" rule too; RRG 1.8
   * "Target", p. 43), so the attack then deals its damage.
   */
  readonly removesThreatFrom?: { readonly scheme: TargetRef; readonly thwart?: true };
  readonly keywords?: readonly AttackKeyword[];
  /**
   * "Prevent all damage from this attack" (Mockingbird 04004), set from an interrupt at attack *initiation* — before
   * a defender is declared, so `preventDamage()` (which adjusts an already-pushed `dealDamage` frame) can't express
   * it. The flag rides the activation's own event frame through `declareDefender` and the eventual damage step
   * (RRG 1.8 "Prevent", p. 35): the damage is still dealt (for "the attacking character dealt damage" purposes,
   * excess measured), but the target takes none, so no tough card is used.
   */
  readonly preventAllDamage?: boolean;
  /**
   * "Prevent 3 damage from this attack" (Brazen Defense 32178; docs/phase7-wave6.md §3.81), set at attack initiation:
   * up to N of the damage the attack would have its target take is prevented (after constant reductions and a tough
   * status card, RRG 1.8 "Damage", p. 14), announced as `damagePrevented`, and the rest gone with the attack.
   */
  readonly preventDamage?: Amount;
  /** "Use its ATK instead of its DEF for this attack" (The Best Defense…, 25020; docs/phase7-wave4.md §3.22). */
  readonly defenseUsesAtk?: boolean;
  /**
   * "Each boost card turned faceup during this activation gets +N boost icons", for the activation in progress (its
   * next boost card on). From the effect that starts the activation, use `enemyAttack({ boostIconsEach })` (§4.1 Q66).
   */
  readonly boostIconsEach?: Amount;
  /**
   * "Do not give Master Mold a boost card for this activation" (docs/phase7-wave6.md §3.15), from an interrupt to the
   * `enemyScheme`/`enemyAttack` in progress: no automatic boost card and no additional ones. Boost cards dealt to the
   * enemy outside the activation still resolve (RRG 1.8 "Boost", p. 11).
   */
  readonly noBoost?: true;
}): EffectSpec => ({
  kind: "modifyAttack",
  ...(change.overkill ? { overkill: true } : {}),
  ...(change.extraBoostCards !== undefined ? { extraBoostCards: amount(change.extraBoostCards) } : {}),
  ...(change.atkBonus !== undefined ? { atkBonus: amount(change.atkBonus) } : {}),
  ...(change.extraDamage !== undefined ? { extraDamage: amount(change.extraDamage) } : {}),
  ...(change.threatBonus !== undefined ? { threatBonus: amount(change.threatBonus) } : {}),
  ...(change.removesThreat ? { removesThreat: true } : {}),
  ...(change.damageTo ? { damageTo: change.damageTo } : {}),
  ...(change.removesThreatFrom
    ? {
        removesThreatFrom: {
          scheme: change.removesThreatFrom.scheme,
          ...(change.removesThreatFrom.thwart ? { thwart: true as const } : {}),
        },
      }
    : {}),
  ...(change.keywords && change.keywords.length > 0 ? { keywords: change.keywords } : {}),
  ...(change.preventAllDamage ? { preventAllDamage: true } : {}),
  ...(change.preventDamage !== undefined ? { preventDamage: amount(change.preventDamage) } : {}),
  ...(change.defenseUsesAtk ? { defenseUsesAtk: true } : {}),
  ...(change.boostIconsEach !== undefined ? { boostIconsEach: amount(change.boostIconsEach) } : {}),
  ...(change.noBoost ? { noBoost: true } : {}),
});
/**
 * "That thwart removes 1 additional threat" (Operative Skill, `gambit` 37013; docs/phase7-wave6.md §3.55), from an
 * interrupt to a thwart in progress (`on.thwarts(...)`): the thwart (basic, "(thwart)" ability or event) removes N more
 * as part of its one removal, so a crisis icon or patrol still stops all of it and its "after" responses see the
 * total. Outside a thwart it does nothing.
 */
export const modifyThwart = (change: { readonly extraThreat: Amount }): EffectSpec => ({
  kind: "modifyThwart",
  extraThreat: amount(change.extraThreat),
});
/**
 * "Declare Valkyrie the defender without exhausting her" (Shieldmaiden, 25011) / "declare him the defender without
 * exhausting him" (Colossus, Bamf!) / "Exhaust it and declare it the defender" (Mutant Protectors, `{ exhaust: true
 * }`): docs/phase7-wave4.md §3.22. A hero declared this way makes a basic defense (its DEF reduces the damage).
 */
export const declareDefender = (character: TargetRef, opts: { readonly exhaust?: boolean } = {}): EffectSpec => ({
  kind: "declareDefender",
  character,
  ...(opts.exhaust ? { exhaust: true } : {}),
});
/**
 * "Resolve this attack against each minion engaged with that player" (Thor, 25013; docs/phase7-wave4.md §3.22): the
 * player attack in progress also hits every other card `targets` names, as additional resolutions of one attack.
 */
/**
 * "Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck" (The Hood: Making
 * Connections 1A's Setup, The Hood II/III, Promised Prosperity, Crime State, Field Recruitment; docs/phase7-wave4.md
 * §3.18). `bind`: `<bind>.made`.
 */
export const shuffleInSetAsideModularSet = (bind?: string): EffectSpec => ({
  kind: "shuffleInSetAsideModularSet",
  ...withBind(bind),
});
/**
 * "Choose 1 set-aside encounter set at random, reveal its SHOW environment and …" (docs/phase7-wave6.md §3.62): a random
 * set-aside modular set (seeded), whose card matching `reveal` the first player reveals from the set-aside area (full
 * reveal procedure; not "revealed from the encounter deck", so a SHOW environment does not surge), after which the rest
 * of the set joins the encounter deck. `placement`:
 * - `"shuffleIn"` (the default): "shuffle its remaining cards into the encounter deck" (MojoMania 1B, `mojo` 39025b);
 * - `"shuffledOnTop"`: "Shuffle the rest of that modular set and place it on top of the encounter deck" (Wheel of
 *   Genres, Stopped, 39026b).
 *
 * `bind`: `<bind>.made`, 1 when a set was chosen, 0 with none left set aside (`setAsideModularSetCount` asks first).
 */
export const revealFromSetAsideModularSet = (
  reveal: TargetQuery,
  opts: { readonly placement?: "shuffleIn" | "shuffledOnTop"; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "shuffleInSetAsideModularSet",
  ...withBind(opts.bind),
  reveal,
  ...(opts.placement ? { placement: opts.placement } : {}),
});
/**
 * "When Crossfire attacks, he attacks the friendly character with the fewest remaining hit points" (Crossfire, `hood`
 * 24026; docs/phase7-wave4.md §3.21): the enemy attack being initiated is against that character instead, and its
 * controller is the attacked player. A new attack against a character is `enemyAttack`'s `targetCharacter` (Speed
 * Demon: "Speed Demon attacks that character").
 */
export const retargetAttack = (character: TargetRef): EffectSpec => ({ kind: "retargetAttack", character });
/**
 * "Change the target of this attack to a friendly character of your choice" (docs/phase7-wave7.md §3.66), from an
 * interrupt to a player's attack: the innermost player attack that has not dealt its damage is against `character`
 * instead, with the same attacker, damage, keywords and source. Choose `character` among `canTakeThisAttack`
 * candidates (RRG 1.8 "Target", p. 43); one that cannot take the damage is never the new target.
 */
export const retargetPlayerAttack = (character: TargetRef): EffectSpec => ({
  kind: "retargetAttack",
  attack: "player",
  character,
});
export const resolveAttackAgainst = (targets: TargetRef): EffectSpec => ({ kind: "resolveAttackAgainst", targets });
export const atEndOfAttack = (...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "atEndOfAttack",
  effects: flatten(effects),
});
export const atEndOfRound = (...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "atEndOfRound",
  effects: flatten(effects),
});
/**
 * "After that thwart ends, …" (Making an Entrance, `vnm` 20013) — the generic sibling of `atEndOfAttack` for
 * either an attack or a scheme/thwart activation (`EffectSpec atEndOfActivation`, already landed for a Boost
 * ability's own "after this activation ends"; this is its first DSL wrapper for a player-side interrupt). Reads
 * `currentActivationFrameId`, which already matches a `thwart` event frame alongside `attack`/`enemyAttack`/
 * `enemyScheme`, so an interrupt to `basicPowerUsing` on a thwart still finds the right frame to defer onto.
 */
export const atEndOfActivation = (...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "atEndOfActivation",
  effects: flatten(effects),
});
/**
 * "Until the end of the turn, heal 2 damage from Rocket Raccoon **each time** you deal any amount of damage to an
 * enemy." (Schadenfreude, `gmw` 16032; docs/phase7-wave3.md §3.17, §3.30): a lasting "each time …" effect. Every
 * event matching `on` until `until` resolves `effects` — mandatory, before that event's responses (RRG 1.8 "Delayed
 * Effect", p. 15), matched with this card as "self" and its controller as "you". `on` is any `EventPattern`
 * (`on.youDealDamage(ENEMY)` for Schadenfreude). Not created outside the period it names (RRG 1.8 "Lasting
 * Effects", p. 26).
 */
export const eachTimeUntil = (
  until: "endOfPhase" | "endOfRound" | "endOfTurn",
  on: EventPattern,
  ...effects: readonly EffectArg[]
): EffectSpec => ({ kind: "eachTimeUntil", until, on, effects: flatten(effects) });
/** "Prevent N of that damage" (absent = all of it). */
/**
 * "Prevent [N of] that damage". `{ bind }`: `<bind>.amount` is how much was prevented ("the amount prevented this way",
 * Deflection; "if 2 or more damage was prevented this way", Telekinetic Force Field; docs/phase7-wave4.md §3.20).
 */
export const preventDamage = (n?: Amount, opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "preventDamage",
  ...(n !== undefined ? { amount: amount(n) } : {}),
  ...withBind(opts.bind),
});
/**
 * "Increase that amount by N" on an interrupted damage event (Beast Mode, `hood` 24014: "When a stunned or confused
 * friendly character would take any amount of damage, increase that amount by 1"; Controller, 24024: "… by that
 * character's ATK"). The mirror of `preventDamage`. docs/phase7-wave4.md §3.52.
 */
export const increaseDamage = (n: Amount): EffectSpec => ({ kind: "increaseDamage", amount: amount(n) });
/**
 * "… If [condition], repeat this effect" (Out for Blood, `hood` 24023): `effects` resolve, then `condition` is read with
 * what they bound, and while it holds they resolve again, each time with their own bindings cleared.
 * docs/phase7-wave4.md §3.54.
 */
export const repeatWhile = (condition: Predicate, ...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "repeatWhile",
  effects: flatten(effects),
  while: condition,
});
export const preventThreat = (n?: Amount): EffectSpec =>
  n === undefined ? { kind: "preventThreat" } : { kind: "preventThreat", amount: amount(n) };
/** "… instead": the interrupted event doesn't happen; these resolve in its place (RRG "Replacement Effect"). */
export const instead = (...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "replaceTriggeringEvent",
  with: flatten(effects),
});
/** RRG "Cancel": the interrupted event doesn't resolve. */
export const cancelIt = (): EffectSpec => ({ kind: "cancelTriggeringEvent" });
/** "Cancel its 'When Revealed' effects". */
export const cancelWhenRevealed = (): EffectSpec => ({ kind: "cancelWhenRevealed" });
/** "Cancel the effects of that card and discard it". */
export const cancelRevealedCard = (): EffectSpec => ({ kind: "cancelRevealedCard" });

// ---------------------------------------------------------------------------
// Lasting effects
// ---------------------------------------------------------------------------

/**
 * "Until …, X gets +N [stat]" on fixed targets. `{ nextBasic: ["attack", "thwart"] }` is "that ally gets +2 THW and
 * +2 ATK for its next basic thwart or attack action this phase" (Psychic Kicker, 34034; docs/phase7-wave6.md §3.39,
 * §4.1 Q23): the bonus waits for the target's next basic power of those kinds, applies to that use and ends with it
 * (or at the end of the phase). Two `modifyStat`s with the same `nextBasic` end together on the first such power.
 */
export const modifyStat = (
  stat: StatName | "hp" | "handSize",
  n: Amount,
  target: TargetRef,
  until: LastingUntil | { readonly nextBasic: NextBasicPowerUntil["powers"] },
): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: amount(n),
  target,
  until: typeof until === "string" ? until : { kind: "nextBasicPower", powers: until.nextBasic },
});
/** "Each character that player controls gets +N [stat] until …" — a live query that also catches later arrivals. */
export const modifyStatOf = (
  stat: StatName | "hp" | "handSize",
  n: Amount,
  affects: TargetQuery,
  until: LastingUntil,
): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: amount(n),
  affects,
  until,
});
/**
 * "She gains retaliate 1 until the end of the phase." (Pulsar Shield, `mts` 21009; Cuts Both Ways, `cw` 56050):
 * `gainKeywordUntil({ name: "retaliate", value: 1 }, yourIdentity, "endOfPhase")`. docs/phase7-wave4.md §3.39.
 */
export const gainKeywordUntil = (keyword: KeywordInstance, target: TargetRef, until: LastingUntil): EffectSpec => ({
  kind: "grantKeywordUntil",
  keyword,
  target,
  until,
});
export const gainTraitUntil = (t: Trait, target: TargetRef, until: LastingUntil): EffectSpec => ({
  kind: "grantTraitUntil",
  trait: t,
  target,
  until,
});
/**
 * "You gain each of the attached character's TRAITS until the end of the round." (Skin Contact, `rogue` 38001a; Energy
 * Transfer, 38007; docs/phase7-wave6.md §3.50): `target` gains every trait `source`'s characters have, printed and
 * granted, read live (they follow the source's trait changes), never its keywords or text. `source` is fixed as this
 * resolves.
 *
 * `{ whileAttached }` is the owner's decision §4.1 Q28, "Rogue's copied traits are live, for as long as Touched stays
 * on that character": the grant also ends once that card is no longer attached to `source` (or to `to`, when given),
 * whichever of that and `until` comes first. Rogue's two cards, after the attach that binds the host to slot `host`
 * and Touched to slot `touched`:
 * `gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") })`.
 */
export const gainTraitsOfUntil = (
  source: TargetRef,
  target: TargetRef,
  until: LastingUntil,
  options: { readonly whileAttached?: TargetRef; readonly to?: TargetRef } = {},
): EffectSpec => ({
  kind: "grantTraitUntil",
  traitsOf: source,
  target,
  until,
  ...(options.whileAttached ? { whileAttached: { card: options.whileAttached, to: options.to ?? source } } : {}),
});
/**
 * "Treat your identity's text box as if it were blank (except for [TRAITS]) until the next villain phase begins"
 * (Pestilence, `aoa` 45083; Plague and Pestilence 45088; docs/phase7-wave8.md §3.13):
 * `blankTextBoxUntil(identityOf(you), "nextVillainPhaseBegins")`; "until the end of the phase" on any card (Edison's
 * Giant Robot). On an identity the whole card is blank, both faces and its keywords, traits and the stat line kept
 * (RRG 1.8 "Text Box", p. 44; "Traits", p. 45), as under the constant `blanksTextBox`.
 */
export const blankTextBoxUntil = (target: TargetRef, until: LastingUntil): EffectSpec => ({
  kind: "blankTextBox",
  target,
  until,
});
/**
 * A `RuleSpec` restriction that outlives its own card — "You cannot change form until your next turn ends." (Care
 * for Cassie, `ant` 12025) / "You cannot ready your identity until your next turn ends." (Need for Speed, `qsv`
 * 14024): both discard themselves in the same breath that imposes the restriction, so it has to survive as a
 * lasting effect rather than a constant ability (RRG 1.8 "Lasting Effects", p. 26). `until` also accepts the
 * ordinary phase/round/turn boundaries any other lasting effect does; `"endOfNextTurn"` is the one both printed
 * obligations need (docs/phase7-wave2.md §22 — the reading of "your next turn" when created during that player's
 * own turn: the turn after this one, never zero-length). `player` names whose turn `"endOfNextTurn"` waits for;
 * absent, the rule's own player, then the ability's controller. `cannotChangeFormUntil`/`cannotReadyUntil` below
 * are the two named conveniences the pool's own cards need; reach for `applyRuleUntil` directly for any other
 * `RuleSpec`.
 *
 * `"endOfAttack"` is "until after that attack resolves": the attack in progress, or with `{ attack: "initiated" }`
 * the one the next `enemyAttack` of the same ability initiates — put this effect **before** that `enemyAttack` (In
 * Cold Blood, `sm` 27029; engine spec.ts `applyRuleUntil`).
 *
 * `"endOfPaidFor"` is "that attack" on a resource ability: the rule lasts until the ability or card the payment paid
 * for (slot `paidFor`) finishes resolving, so a later use is untouched (docs/phase7-wave6.md §3.30; see
 * `thatAttackGainsKeywords`).
 */
export const applyRuleUntil = (
  rule: RuleSpec,
  until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn" | "endOfAttack" | "endOfPaidFor",
  player?: PlayerRef,
  options: { readonly attack?: "current" | "initiated" } = {},
): EffectSpec => ({
  kind: "applyRuleUntil",
  rule,
  until,
  ...(player ? { player } : {}),
  ...(options.attack ? { attack: options.attack } : {}),
});
/**
 * "Generate a [energy] resource for your 'Optic Blast' ability. **That attack** gains piercing and ranged" (Ruby
 * Quartz Visor 33003; docs/phase7-wave6.md §3.30): an effect of a `resource(...)` ability. The attack made by the
 * ability or card the payment paid for (slot `paidFor`) gains `keywords`, for that one use only.
 */
export const thatAttackGainsKeywords = (keywords: readonly AttackKeyword[]): EffectSpec =>
  applyRuleUntil({ kind: "attackKeywords", keywords, via: { inSlot: "paidFor" } }, "endOfPaidFor");
/**
 * "Ignore each boost icon ([boost]) and each 'Boost' ability for this attack" (Aerial Agility, `angel` 42004;
 * docs/phase7-wave7.md §3.67): an effect of an interrupt to the enemy's attack ("When an enemy attacks"), or of
 * anything else that resolves during it. Every boost card of that attack is still turned faceup and discarded, adds 0
 * and resolves no "Boost" ability; nothing is canceled (RRG 1.8 "Ignore", p. 23). Ends with the attack. Not
 * `modifyAttack({ noBoost: true })`, which deals no boost card at all. Outside an attack or activation it does nothing.
 */
export const ignoreBoostForThisAttack = (): EffectSpec => applyRuleUntil({ kind: "ignoreBoost" }, "endOfAttack");
/** "You cannot change form until your next turn ends." */
export const cannotChangeFormUntil = (
  until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn",
  player: PlayerRef = you,
): EffectSpec => applyRuleUntil({ kind: "cannotChangeForm", player }, until, player);
/** "You cannot ready [target] until your next turn ends." */
export const cannotReadyUntil = (
  target: TargetQuery,
  until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn",
  player?: PlayerRef,
): EffectSpec => applyRuleUntil({ kind: "cannotReady", target }, until, player);
/**
 * "Until the end of the round, you may look at the top card of the encounter deck at any time." (Sector Scan;
 * docs/phase7-wave5.md §3.28): `mayLookAtTopOfEncounterDeckUntil("endOfRound")`. A lasting rule frozen to the
 * resolving player; no game state changes, and only that player's view (`faceVisible` with a viewer) shows the card.
 */
export const mayLookAtTopOfEncounterDeckUntil = (
  until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn",
  player: PlayerRef = you,
): EffectSpec => applyRuleUntil({ kind: "mayLookAtTopOfEncounterDeck", player }, until);
/**
 * "Reduce the cost of the next card that player plays this phase/round by N." `cardFilter` narrows which played
 * card consumes it — "the next Avenger ally played this phase" (Avengers Tower, `cap` pack): `{ trait: AVENGER,
 * categories: ["ally"] }`. Omit for the unfiltered "next card" (Helicarrier).
 */
export const reduceNextCardCost = (
  player: PlayerRef,
  n: Amount,
  duration: NextCardCostDuration,
  cardFilter?: TargetQuery,
  /**
   * "Reduce the cost of the next ally played to the mission this phase by 2." (Mission Team, `aoa` 45171a;
   * docs/phase7-wave8.md §3.35) → `reduceNextCardCost(you, 2, "phase", query("ally"), { into: INTO_THE_MISSION,
   * anyPlayer: true })`. `into`: only a play into that in-play scenario area uses the reduction. `anyPlayer`: "the
   * next ally played", whoever plays it.
   */
  opts: { readonly into?: { readonly scenarioPlayArea: string }; readonly anyPlayer?: true } = {},
): EffectSpec => ({
  kind: "reduceNextCardCost",
  player,
  amount: amount(n),
  duration,
  ...(cardFilter ? { cardFilter } : {}),
  ...(opts.into ? { into: opts.into } : {}),
  ...(opts.anyPlayer ? { anyPlayer: true as const } : {}),
});
/**
 * "Assign each of the discarded cards to a different ally at the mission. If a resource icon on the ally matches a
 * resource icon on the card assigned to it, that ally participates." (MC45 p. 6, steps 1 and 2 of a mission attempt;
 * docs/phase7-wave8.md §3.36) → `pairCards(chosenCards("discarded"), ALLY_AT_THE_MISSION, "pairing")`. The player
 * assigns each card of `cards` to a different card `characters` matches; a [wild] on either side matches any icon.
 * Binds `<bind>.matched` (the characters whose card matches, a slot), `<bind>.paired` (every character given a card),
 * `<bind>.pairs` and `<bind>.count` (how many pairs were made, and how many match).
 */
export const pairCards = (
  cards: TargetRef,
  characters: TargetQuery,
  bind: string,
  opts: { readonly chooser?: PlayerRef; readonly limit?: PairLimit } = {},
): EffectSpec => ({
  kind: "pairCards",
  cards,
  with: characters,
  chooser: opts.chooser ?? you,
  match: "resourceIcon",
  wild: "either",
  ...(opts.limit ? { limit: opts.limit } : {}),
  bind,
});
/**
 * How long a "the next card you play …" cost change waits. `"untilPlayed"` is the unbounded form — no phase or
 * round limit at all, however many rounds it takes ("The **next** event you play costs 3 additional resources",
 * Physical Toll, `drs` pack). Use `"phase"`/`"round"` only when the card prints that bound.
 */
export type NextCardCostDuration = "phase" | "round" | "turn" | "untilPlayed";
/**
 * "The next [card] you play costs N additional resources" (Physical Toll, `drs` pack) — the mirror of
 * `reduceNextCardCost`, which the engine stores as the same signed lasting effect. The price is floored at 0.
 */
export const increaseNextCardCost = (
  player: PlayerRef,
  n: number,
  duration: NextCardCostDuration,
  cardFilter?: TargetQuery,
): EffectSpec => ({
  kind: "reduceNextCardCost",
  player,
  amount: amount(-n),
  duration,
  ...(cardFilter ? { cardFilter } : {}),
});
/**
 * "Discard this obligation after you play an event" (Physical Toll, `drs` pack): a delayed effect whose timing
 * point is the next matching card that player plays, the sibling of `atEndOfRound`/`atEndOfAttack`. Fires once,
 * after that card's play has finished resolving, whatever round that is.
 */
export const afterNextCardPlayed = (
  player: PlayerRef,
  cardFilter: TargetQuery | undefined,
  ...effects: readonly EffectSpec[]
): EffectSpec => ({
  kind: "afterNextCardPlayed",
  player,
  effects,
  ...(cardFilter ? { cardFilter } : {}),
});

// ---------------------------------------------------------------------------
// Cards outside play, form, sequences
// ---------------------------------------------------------------------------

/**
 * A player's own zone(s): "your deck", "your discard pile", or several searched as one pool ("search your deck
 * **and** discard pile for a Doctor Strange card" — Mystical Studies, For Asgard!, Agent Coulson, Hail Hydra!;
 * docs/phase7-wave1.md §3.16). `z` is one zone or a list.
 */
export const zone = (
  z: PlayerZone | readonly PlayerZone[],
  player: PlayerRef = you,
  opts: {
    readonly filter?: TargetQuery;
    readonly top?: Amount;
    readonly topmostOnly?: boolean;
    /** "The bottommost [X] from your discard pile" (Conditioning Room, `gam` 18008): `zone`'s mirror of `topmostOnly`. */
    readonly bottommostOnly?: boolean;
    readonly random?: Amount;
  } = {},
): CardSelector => ({
  kind: "zone",
  zone: z,
  player,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.top !== undefined ? { top: amount(opts.top) } : {}),
  ...(opts.topmostOnly ? { topmostOnly: true } : {}),
  ...(opts.bottommostOnly ? { bottommostOnly: true } : {}),
  ...(opts.random !== undefined ? { random: amount(opts.random) } : {}),
});
/** "The top N cards of your deck". */
export const topOfDeck = (n: Amount, player: PlayerRef = you): CardSelector => zone("deck", player, { top: n });
export const cards = (ref: TargetRef, filter?: TargetQuery): CardSelector => ({
  kind: "ref",
  ref,
  ...(filter ? { filter } : {}),
});
/**
 * "The encounter deck" (and/or its discard pile): the active villain's. `deckOf` names another villain's deck where
 * the card text does ("Reveal the top card of *his* deck"; docs/phase7-wave1.md §4.2, open). The third argument is the
 * deck's `top` N, or options: `{ topmostOnly: true }` is "the topmost [X] in the encounter discard pile", the first
 * match only (Sentinel Mark VIII, Master of Magnetism, Zola's Experiments; docs/phase7-wave6-handoff.md §3.76).
 */
export const encounterCards = (
  zones: readonly ("deck" | "discard")[],
  filter?: TargetQuery,
  topOrOpts?: Amount | { readonly top?: Amount; readonly topmostOnly?: boolean; readonly random?: Amount },
  deckOf?: TargetRef,
): CardSelector => {
  const opts: { readonly top?: Amount; readonly topmostOnly?: boolean; readonly random?: Amount } =
    topOrOpts === undefined
      ? {}
      : typeof topOrOpts === "number" || "kind" in topOrOpts
        ? { top: topOrOpts }
        : topOrOpts;
  return {
    kind: "encounter",
    zones,
    ...(filter ? { filter } : {}),
    ...(opts.top !== undefined ? { top: amount(opts.top) } : {}),
    ...(deckOf ? { deckOf } : {}),
    ...(opts.topmostOnly ? { topmostOnly: true } : {}),
    // "A random [X] from the encounter deck" (docs/phase7-wave8.md §3.15): that many of the matches, by the seeded RNG.
    ...(opts.random !== undefined ? { random: amount(opts.random) } : {}),
  };
};
/** Scenario cards set aside at setup (a signature side scheme before Breakout 1A puts it into play). */
/** `opts.random`: that many of the matching cards, picked by the game's seeded RNG (also "one copy" of a card with
 * several identical set-aside copies, e.g. "a copy of the Norn Stone upgrade", `mts` 21186a). */
export const encounterSetAside = (filter?: TargetQuery, opts: { readonly random?: Amount } = {}): CardSelector => ({
  kind: "encounterSetAside",
  ...(filter ? { filter } : {}),
  ...(opts.random !== undefined ? { random: amount(opts.random) } : {}),
});
/** "Place the active counter on Wrecker" / "Move the active counter to …" (The Wrecking Crew insert). */
export const setActiveVillain = (villain: TargetRef): EffectSpec => ({ kind: "setActiveVillain", villain });
/** The removed-from-game area: "search … set-aside area, and removed-from-game area for …" (Loose Ends, 27135). */
export const removedFromGameCards = (filter?: TargetQuery): CardSelector => ({
  kind: "removedFromGame",
  ...(filter ? { filter } : {}),
});
/**
 * The victory display, the one the players share (docs/phase7-wave7.md §3.49): "put a side scheme from the victory
 * display into play" (Temporal Leap, 40013) is `chooseCards(slot, victoryDisplayCards(query("sideScheme")), …)`, and
 * "Search your deck, discard pile, hand, and victory display for X" (40031) is `anyOfCards(zone(["deck", "discard",
 * "hand"], you, { filter }), victoryDisplayCards(filter))` followed by `shuffleDeck()`, since the deck was searched.
 */
export const victoryDisplayCards = (filter?: TargetQuery): CardSelector => ({
  kind: "victoryDisplay",
  ...(filter ? { filter } : {}),
});
/**
 * "Add [this card] and that side scheme to the victory display" (Forced Amnesia, 40010; docs/phase7-wave7.md §3.49):
 * `moveCards(from, "victoryDisplay")`. A card in play leaves play without being defeated (no When Defeated, no "after
 * … is defeated" response); a card in a discard pile is moved; one already there stays.
 */
export const addToVictoryDisplay = (from: CardSelector, bind?: string): EffectSpec =>
  moveCards(from, "victoryDisplay", bind);
export const setAside = (player: PlayerRef = you, filter?: TargetQuery): CardSelector => ({
  kind: "setAside",
  player,
  ...(filter ? { filter } : {}),
});
/**
 * The cards in a scenario out-of-play area, e.g. "The Collection" (docs/phase7-wave3.md §3.14): `scenarioArea(name)`
 * as a `CardSelector` ("discard 1 card from The Collection"); `{ scenarioArea: name }` is already a valid
 * `CardDestination` for `moveCards`' own `to`, with no wrapper needed ("put it faceup into The Collection").
 */
export const scenarioArea = (name: string, filter?: TargetQuery): CardSelector => ({
  kind: "scenarioArea",
  name,
  ...(filter ? { filter } : {}),
});
/** "Create '[name]' game area" (The Grand Collection 1A, docs/phase7-wave3.md §3.14). Empty; a no-op if it exists. */
export const createScenarioArea = (name: string): EffectSpec => ({ kind: "createScenarioArea", name });
/**
 * An empty scenario area that is in play and under no player's control (the mission area, MC45 p. 5;
 * docs/phase7-wave8.md §3.33). `closed` (the default): its cards "cannot be affected by card abilities unless the
 * ability refers to" the area, which a script does with `inScenarioPlayArea` on a query or `reaches` on the ability.
 * Cards go there with `putIntoPlay(card, player, { into: { scenarioPlayArea: name } })`.
 */
export const createScenarioPlayArea = (name: string, opts: { readonly closed?: boolean } = {}): EffectSpec => ({
  kind: "createScenarioPlayArea",
  name,
  closed: opts.closed ?? true,
});
export const tuckedUnder = (under: TargetRef): CardSelector => ({ kind: "tucked", under });
/**
 * "Search the encounter deck, discard pile, **and set-aside area** for X" (Kang's Wrath 4B, 11013b; docs/phase7-
 * wave2.md §10.1/§17.1): every card any listed selector names, each once, in the order listed — one pool across
 * several zones for a single `selectCards`/`chooseCards`, rather than searching each zone as a separate effect.
 */
export const anyOfCards = (...of: readonly CardSelector[]): CardSelector => ({ kind: "anyOf", of });
/**
 * "Search … for at most N of X": the first `n` cards `from` names, in its own order (an encounter search: the deck
 * top-down, then the discard pile). Fewer or none is not an error. The copies not taken stay where they were
 * (docs/phase7-wave3.md §3.50). For a pick that matters to the player, use `chooseCards` with `max` instead.
 */
export const atMost = (n: Amount, from: CardSelector): CardSelector => ({ kind: "atMost", count: amount(n), of: from });
/**
 * "Search … for **one copy** of X" / "for **a copy** of X" / "for X and reveal **it**": `atMost(1, from)`. A card
 * with several printed copies is several instances, and a plain selector would name every one of them.
 */
export const oneCopyOf = (from: CardSelector): CardSelector => atMost(1, from);

/**
 * "Find Touched and set it aside" / "find Touched and attach it to another character" (Rogue; docs/phase7-wave6.md
 * §3.48): the first card `find(q, { owner })` names goes to `to` — a `CardDestination`, or `{ attachTo: host }`. A card
 * already there stays put; each deck searched is shuffled after (RRG 1.8 "Search", p. 39), also when nothing was found
 * (§4.1 Q77), which leaves the text before a "then" unresolved. `bind`: the found card, in that slot.
 */
export const findCard = (
  q: TargetQuery,
  to: CardDestination | { readonly attachTo: TargetRef },
  opts: { readonly owner?: PlayerRef; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "findCard",
  query: q,
  ...(opts.owner ? { owner: opts.owner } : {}),
  to,
  ...withBind(opts.bind),
});
export const moveCards = (from: CardSelector, to: CardDestination, bind?: string): EffectSpec => ({
  kind: "moveCards",
  cards: from,
  to,
  ...withBind(bind),
});
/**
 * "Each player shuffles 1 copy of Shawarma into their deck" (Save the Shawarma Place, `mts` 21182a): `from` is an
 * unowned, shared pool (`encounterSetAside`), so `to` needs an owner to send the card to; `player` supplies it
 * (`EffectSpec.moveCards.assignOwnerTo`, docs/phase7-wave4.md §3.10's own campaign-card family).
 */
export const grantOwnedCards = (from: CardSelector, to: CardDestination, player: PlayerRef = you): EffectSpec => ({
  kind: "moveCards",
  cards: from,
  to,
  assignOwnerTo: player,
});
/**
 * "Shuffle the top card of the encounter deck into each player's deck" (Mysterio II, `sm` 27085), "place that card in
 * your discard pile" (Mysterio I): `to` means `player`'s hand, deck or discard pile, whoever owns the cards. An
 * encounter card stays unowned there, facedown in a deck and faceup in a discard pile (MC27 p. 13; docs/phase7-wave5.md
 * §3.5).
 */
export const moveCardsInto = (
  from: CardSelector,
  to: CardDestination,
  player: PlayerRef,
  bind?: string,
): EffectSpec => ({
  kind: "moveCards",
  cards: from,
  to,
  into: player,
  ...withBind(bind),
});
export const chooseCards = (
  slot: string,
  from: CardSelector,
  opts: { readonly min: number; readonly max: number; readonly chooser?: PlayerRef; readonly distinctNames?: boolean },
): EffectSpec => ({
  kind: "chooseCards",
  slot,
  from,
  chooser: opts.chooser ?? you,
  min: opts.min,
  max: opts.max,
  ...(opts.distinctNames ? { distinctNames: true } : {}),
});
export const shuffleDeck = (player: PlayerRef = you): EffectSpec => ({ kind: "shuffleDeck", player });
/** Shuffle a player's separate deck after searching it ("Choose a support from the WEATHER deck", wave 6 §3.46). */
export const shuffleSeparateDeck = (name: string, player: PlayerRef = you): EffectSpec => ({
  kind: "shuffleDeck",
  player,
  separateDeck: name,
});
export const changeForm = (player: PlayerRef = you, to?: "hero" | "alterEgo"): EffectSpec => ({
  kind: "changeForm",
  player,
  ...(to ? { to } : {}),
});
/**
 * "Change to your other hero form" (Resize, Swarm Tactics, `ant`/`wsp`; docs/phase7-wave2.md §3.2): a three-sided
 * identity's own hero-to-hero change. Never uses the voluntary once-per-round change — that's the *command* path
 * (a player choosing to change form), not a card effect (insert, "Rules Clarifications": "If a card ability causes
 * a player to change form, it does not count against the one voluntary form change").
 */
export const changeToOtherHeroForm = (player: PlayerRef = you): EffectSpec => ({
  kind: "changeForm",
  player,
  heroForm: "other",
});
/** "Change to your [Giant] hero form" (Rapid Growth, `wsp`) — the face printed with `t`. */
export const changeToHeroFormWithTrait = (t: Trait, player: PlayerRef = you): EffectSpec => ({
  kind: "changeForm",
  player,
  heroForm: { withTrait: t },
});
/**
 * "Change to [Archangel] form" (docs/phase7-wave7.md §3.62): the hero face with that title, for an identity whose hero
 * faces print the same traits. A title names one face only (RRG 1.8 "Identity", p. 23); a player already showing it
 * does not change form.
 */
export const changeToHeroFormNamed = (name: string, player: PlayerRef = you): EffectSpec => ({
  kind: "changeForm",
  player,
  heroForm: { named: name },
});
export const resolveSpecials = (cardsQuery: TargetQuery): EffectSpec => ({
  kind: "resolveSpecials",
  cards: cardsQuery,
});
/**
 * `resolveSpecials` for a card named by reference rather than found by query — "attach this card to Nebula and
 * resolve its 'Special' ability" (Nebula's Technique attachments, `gmw` 16094–16098): `self` is this exact
 * instance, not "any Technique attachment in play" (which could match a different already-attached copy of the
 * same non-unique card). The engine's `EffectSpec resolveSpecials` already carries an `of` field for this
 * (`separate-deck.test.ts`'s own Invocation-deck usage); this is its first DSL exposure.
 */
/**
 * "Resolve the 'Special' ability of [ref]"; `player`: "[that player] must resolve …" (docs/phase7-wave4.md §3.46).
 * `opts.bind`: what the Specials' own effects bind comes back as `<bind>.<slot>` / `<bind>.<var>`, and `<bind>.count` is
 * how many resolved: Sandslide's "If at least 1 Sandman card was discarded this way" reads
 * `countAmong(chosen("<bind>.discarded"), …)` when Surging Sands binds its discard as `"discarded"`
 * (docs/phase7-wave5.md §3.7).
 * `opts.abilities`: only these abilities, by id, when the text names one of several Specials on the card: "resolve
 * Spider-Man's 'Venom Blast' ability" (Web-Shot, `sm` 27034) is `{ abilities: ["27030a.spider-man-constant"] }`, and
 * "Spider Camouflage" (the other Special on 27030a) doesn't resolve. Absent: every Special on the card
 * (docs/phase7-wave5.md §4.1 Q63).
 */
export const resolveSpecialsOf = (
  ref: TargetRef,
  player?: PlayerRef,
  opts: { readonly bind?: string; readonly abilities?: readonly string[] } = {},
): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  ...(player ? { player } : {}),
  ...(opts.bind ? { bind: opts.bind } : {}),
  ...(opts.abilities ? { abilities: opts.abilities.map(abilityId) } : {}),
});
/**
 * "Resolve this card's 'When Revealed' ability" (`of: self`; the boost of Out for Blood, Double Trouble, Sandslide),
 * "Resolve each 'When Revealed' ability on each side scheme in play" (`of: each(query("sideScheme"))`; Citywide Crisis,
 * `hood` 24059). Printed When Revealed abilities only, by default (the user's reading of Citywide Crisis, §4 Q23);
 * `includeKeywords` also resolves incite and surge (RRG 1.8: each is "equivalent to" a When Revealed ability). `bind`:
 * `<bind>.count`, how many were resolved. docs/phase7-wave4.md §3.56.
 */
export const resolveWhenRevealedOf = (
  ref: TargetRef,
  opts: { readonly bind?: string; readonly includeKeywords?: boolean } = {},
): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  trigger: "whenRevealed",
  ...(opts.includeKeywords ? { includeKeywords: true } : {}),
  ...withBind(opts.bind),
});
/**
 * "Resolve the 'When Defeated' ability of each [Acolyte] minion engaged with you" (Zeal for the Cause, `mut_gen` 32164):
 * `of: each(query("minion", { trait: trait("ACOLYTE"), engagedWith: "you" }))`. Each card's printed When Defeated
 * abilities resolve with the card still in play; "the player who defeated [this card]" (`defeatingPlayer`) inside them
 * is the resolving player (`player`, else this ability's "you"; docs/phase7-wave6.md §4.1 Q10). `bind`: `<bind>.count`,
 * how many were resolved. docs/phase7-wave6.md §3.17.
 */
export const resolveWhenDefeatedOf = (
  ref: TargetRef,
  opts: { readonly bind?: string; readonly player?: PlayerRef } = {},
): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  trigger: "whenDefeated",
  ...(opts.player ? { player: opts.player } : {}),
  ...withBind(opts.bind),
});
/**
 * "Resolve the 'Forced Response' on the active villain as if it has at least 1 hit point and attacked you" (Rough
 * Riders, `aoa` 45096; docs/phase7-wave8.md §3.11): `resolveForcedResponseOf(theVillain, { remainingHpAtLeast: 1 })`.
 * Each card's printed Forced Response abilities resolve with the resolving player (`player`, else this ability's "you")
 * as "you". Nothing attacks: no boost card, no damage of an attack, and no "after [enemy] attacks" of another card.
 * `remainingHpAtLeast`: while each resolves, its card is considered to have at least that many hit points (§3.10).
 * `abilities`: only these, by id. `bind`: `<bind>.count`, how many were resolved.
 */
export const resolveForcedResponseOf = (
  ref: TargetRef,
  opts: {
    readonly bind?: string;
    readonly player?: PlayerRef;
    readonly abilities?: readonly string[];
    readonly remainingHpAtLeast?: number;
  } = {},
): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  trigger: "forcedResponse",
  ...(opts.player ? { player: opts.player } : {}),
  ...(opts.abilities ? { abilities: opts.abilities.map(abilityId) } : {}),
  ...(opts.remainingHpAtLeast !== undefined ? { asIf: { remainingHpAtLeast: opts.remainingHpAtLeast } } : {}),
  ...withBind(opts.bind),
});
/**
 * "For each [CELESTIAL] attachment in play, resolve its effect as if the attached villain just schemed against you and
 * attacked you" (Celestial Tech, `aoa` 45158; docs/phase7-wave8.md §3.28): `resolveForcedInterruptOf(each(query))`.
 * Each card's printed Forced Interrupts whose condition is an enemy attacking or scheming resolve with the resolving
 * player (`player`, else this ability's "you") as "you", as if the card they are attached to (or the card itself, for
 * "when this enemy attacks") had just done so. Nothing activates: no boost card, no attack or scheme, and no other
 * card's "when [enemy] attacks" hears it. `abilities`: only these, by id. `bind`: `<bind>.count`, how many resolved.
 */
export const resolveForcedInterruptOf = (
  ref: TargetRef,
  opts: { readonly bind?: string; readonly player?: PlayerRef; readonly abilities?: readonly string[] } = {},
): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  trigger: "forcedInterrupt",
  ...(opts.player ? { player: opts.player } : {}),
  ...(opts.abilities ? { abilities: opts.abilities.map(abilityId) } : {}),
  ...withBind(opts.bind),
});
/** Records `value` now as var `name`, for a comparison later in the same ability (docs/phase7-wave4.md §3.46). */
export const setVar = (name: string, value: Amount): EffectSpec => ({ kind: "setVar", name, value: amount(value) });
/**
 * "Discard N cards from your hand". `player` may be `eachPlayer`: each chooses from their own hand, in player order.
 *
 * `filter` narrows which hand cards count: "1 resource of any type" (Power Drain) is `{ filter: ANY_RESOURCE }`, a
 * card with a printed resource icon of any of the four types. A player holding fewer matching cards than `n`
 * discards every matching one they hold.
 */
export const discardFromHand = (
  n: Amount,
  player: PlayerRef = you,
  opts: { readonly random?: boolean; readonly filter?: TargetQuery } = {},
): EffectSpec => ({
  kind: "discardFromHand",
  player,
  amount: amount(n),
  ...(opts.random ? { random: true } : {}),
  ...(opts.filter ? { filter: opts.filter } : {}),
});

/**
 * "A resource of any type": a card with a printed resource icon of any of the four types RRG 1.8 "Resource" (p. 37)
 * lists. Printed icons only — the bottom-left corner, not a resource an ability generates (ruling, Jan 11, 2026 (3)).
 */
export const ANY_RESOURCE: TargetQuery = { anyPrintedResource: ["physical", "mental", "energy", "wild"] };
/**
 * "An aspect card": a player card printing one of the four core aspects (Finesse 04033, Jessica Drew's Apartment
 * 04034, Superhuman Agility 04031a — docs/phase7-wave2.md §1.2, `TargetQuery.anyAspect`). Matches `printedAspect` as
 * well as `aspect`, the same as `aspect` itself does, so an identity-specific card that prints an aspect but belongs
 * to a hero's own signature set (Spider-Woman's Venom Blast) still counts. Player card categories only — a hero/
 * alter-ego identity has no printed aspect of its own.
 */
export const ANY_ASPECT_CARD: TargetQuery = query(["ally", "event", "upgrade", "support"], {
  anyAspect: ["aggression", "justice", "leadership", "protection"],
});
/** "Discard 1 card at random from your hand". */
export const discardAtRandom = (n: Amount = 1, player: PlayerRef = you): EffectSpec =>
  discardFromHand(n, player, { random: true });
/**
 * `bind`: the cards that entered play, and `<bind>.count` ("If no minion was put into play this way", §3.59). An
 * upgrade enters play as playing it would (RRG 1.8 "Play, Put into Play", p. 32): on its controller's identity, or on
 * the host its "attach to" text allows. `facedown`: the text puts it into play facedown, so no host is read and it is
 * placed loose in the play area; follow with `turnFacedown`.
 */
export const putIntoPlay = (
  card: TargetRef,
  controller: PlayerRef = you,
  opts: {
    readonly bind?: string;
    readonly facedown?: boolean;
    /**
     * An in-play scenario area nobody controls instead ("add Agent of Apocalypse to the mission area", MC45 p. 5;
     * docs/phase7-wave8.md §3.33): a card out of play enters play there, a card in play is moved there without leaving
     * play. `controller` is then only who the entry is attributed to.
     */
    readonly into?: { readonly scenarioPlayArea: string };
  } = {},
): EffectSpec => ({
  kind: "putIntoPlay",
  card,
  controller,
  ...withBind(opts.bind),
  ...(opts.facedown ? { facedown: true as const } : {}),
  ...(opts.into ? { into: opts.into } : {}),
});
/**
 * "Setup: Put [your permanent card] into play" (RRG 1.8 "Permanent", p. 32: permanent cards are set aside before setup
 * step 1, docs/phase7-wave6.md §3.74): every card of yours in your set-aside area that `filter` matches, bound to
 * `slot`, put into play under your control (an upgrade as playing it would, `putIntoPlay`), and attached to `attachTo`
 * when given. Faceup on its front. `facedown`: "put … into play, facedown": no host is read, the cards are placed loose
 * in your play area and then turned facedown.
 */
export const putIntoPlayFromSetAside = (
  slot: string,
  filter: TargetQuery,
  opts: { readonly attachTo?: TargetRef; readonly facedown?: boolean } = {},
): EffectSpec[] => [
  selectCards(slot, setAside(you, filter)),
  putIntoPlay(chosen(slot), you, opts.facedown ? { facedown: true } : {}),
  ...(opts.attachTo ? [attachCard(chosen(slot), opts.attachTo)] : []),
  ...(opts.facedown ? [turnFacedown(chosen(slot))] : []),
];
/** "Put the top card of your deck into play facedown, engaged with you as a [Drone] minion." */
export const putIntoPlayFacedown = (player: PlayerRef, as: FacedownRole, count?: Amount): EffectSpec => ({
  kind: "putIntoPlayFacedown",
  player,
  as,
  ...(count !== undefined ? { count: amount(count) } : {}),
});
export const AS_DRONE: FacedownRole = { kind: "minion", traits: [TRAIT.DRONE] };
/** "… puts the top card of their deck into play facedown, engaged with them as a Drone minion." */
export const droneFromDeck = (player: PlayerRef = you, count?: Amount): EffectSpec =>
  putIntoPlayFacedown(player, AS_DRONE, count);

// ---------------------------------------------------------------------------
// Encounter deck and scenario flow
// ---------------------------------------------------------------------------

export const selectCards = (slot: string, from: CardSelector): EffectSpec => ({
  kind: "selectCards",
  slot,
  cards: from,
});
/**
 * "Look at the top card of …" with no decision attached: `viewer` sees the cards (a `lookAt` prompt they acknowledge)
 * and nothing moves (RRG 1.8 "Look, Looked-At", p. 27). `bind` also records them in that slot and `<bind>.count`, like
 * `selectCards`, for text that goes on to act on what was seen. Not for a look that then chooses among the cards —
 * that is a `chooseCards`, whose own prompt already shows them.
 */
export const lookAt = (
  from: CardSelector,
  opts: { readonly bind?: string; readonly viewer?: PlayerRef } = {},
): EffectSpec => ({
  kind: "lookAt",
  cards: from,
  viewer: opts.viewer ?? you,
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
export const revealCard = (target: TargetRef, player: PlayerRef = you): EffectSpec => ({
  kind: "revealCard",
  cards: target,
  player,
});
/**
 * "One player may reveal him" (the MojoMania campaign's setup, Longshot from the set-aside cards; ruling Apr 30, 2026
 * (3) #1): `player` reveals each set-aside card matching `filter`, which resolves in full, When Revealed and surge
 * included (docs/phase7-wave6.md §3.71, §4 Q42). An ally with an encounter back enters play under that player's control
 * and stays the scenario's.
 */
export const revealSetAside = (filter: TargetQuery, player: PlayerRef = you, slot = "revealed"): EffectSpec[] => [
  selectCards(slot, encounterSetAside(filter)),
  revealCard({ kind: "slot", slot }, player),
];
export const shuffleEncounterDeck = (): EffectSpec => ({ kind: "shuffleEncounterDeck" });
export const discardEncounterUntil = (filter: TargetQuery, bind: string): EffectSpec => ({
  kind: "discardEncounterUntil",
  filter,
  bind,
});
/**
 * "Discard cards from the top of your deck until you discard a Ms. Marvel card, then add that card to your hand"
 * (Teen Spirit): follow it with `moveCards(cards(chosen(bind)), "hand")`. The match is left in the discard pile, and
 * nothing is bound when the deck runs out first (RRG 1.8 "Player Deck", p. 33 — see `EffectSpec.discardDeckUntil`).
 */
export const discardDeckUntil = (
  filter: TargetQuery,
  bind: string,
  /** Whose deck, or the options: `bindAll` and, with it, `player`. */
  playerOrOpts: PlayerRef | DiscardDeckUntilOptions = you,
): EffectSpec => {
  const opts: DiscardDeckUntilOptions = "kind" in playerOrOpts ? { player: playerOrOpts } : playerOrOpts;
  return {
    kind: "discardDeckUntil",
    player: opts.player ?? you,
    filter,
    bind,
    ...(opts.bindAll !== undefined ? { bindAll: opts.bindAll } : {}),
  };
};
export interface DiscardDeckUntilOptions {
  readonly player?: PlayerRef;
  /**
   * A slot for every card the effect discarded, the match included and last (docs/phase7-wave8.md §3.71): "for each
   * card discarded by it" is `varValue`-style `<bindAll>.count`, "if you discarded at least 1 [mental]" is
   * `varAtLeast("<bindAll>.mental")`. Also `.physical`, `.energy`, `.wild`, `.boostIcons`, `.starIcons`. Hand it to the
   * cards that answer with `raiseMoment(name, you, [bindAll])`.
   */
  readonly bindAll?: string;
}
export const tuckCards = (from: CardSelector, under: TargetRef, facedown = false): EffectSpec => ({
  kind: "tuckCards",
  cards: from,
  under,
  ...(facedown ? { facedown: true } : {}),
});
export const assignDamage = (n: Amount, among: TargetQuery, chooser: PlayerRef = you): EffectSpec => ({
  kind: "assignDamage",
  amount: amount(n),
  among,
  chooser,
});
/**
 * "Deal damage from this pool to enemies at the mission one at a time until there is no damage in the pool or there
 * are no enemies remaining at the mission." (MC45 p. 6, step 4 of a mission attempt; docs/phase7-wave8.md §3.37) →
 * `dealPoolOneAtATime(pool, MINION_AT_THE_MISSION)`. The chooser picks one character that can take damage and how
 * much of the pool it takes; that is dealt and settled, a defeat included, before the next pick; what nobody can
 * take is lost. Not an attack. `bind`: `<bind>.amount`, `<bind>.dealt`, `<bind>.lost`.
 */
export const dealPoolOneAtATime = (
  n: Amount,
  among: TargetQuery,
  opts: { readonly chooser?: PlayerRef; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "assignDamage",
  amount: amount(n),
  among,
  chooser: opts.chooser ?? you,
  sequential: true,
  ...withBind(opts.bind),
});
export const dealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "dealEncounterCard", player });
/**
 * "Deal that card to yourself as a facedown encounter card" (You Dare Oppose Me?, `ron` 90005): deals the card(s)
 * `cards` names, already identified, rather than the encounter deck's top card (docs/phase7-wave3.md §3.47). A card in
 * play is dealt from play: it leaves play, not defeated, and enters play as a new card when revealed; a card that
 * cannot leave play is not dealt (docs/phase7-wave8.md §3.75). `dealAsEncounterCard(find(...), player)` is "finds X
 * and deals him to themself": the Find itself, logged, its decks shuffled.
 */
export const dealAsEncounterCard = (cards: TargetRef, player: PlayerRef = you): EffectSpec => ({
  kind: "dealAsEncounterCard",
  cards,
  player,
});
/**
 * "Pass that facedown encounter card to the next player" (The Crazy Gang, `ncrawler` 48033; docs/phase7-wave8.md
 * §3.75): the facedown dealt card(s) `cards` names move from `from`'s dealt encounter cards to the back of `to`'s,
 * still facedown, for that player to reveal: `passEncounterCard(eventTarget, eventPlayer, nextAfter(eventPlayer))`.
 * Nothing moves when `to` names nobody (`nextAfter` in a one-player game) or the card is not facedown in front of
 * `from`.
 */
export const passEncounterCard = (cards: TargetRef, from: PlayerRef, to: PlayerRef): EffectSpec => ({
  kind: "passEncounterCard",
  cards,
  from,
  to,
});
export const revealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "revealEncounterCard", player });
/**
 * "Give the villain 1 facedown boost card" (Hired Gun 02007, Intimidation 02035): dealt outside an activation, it
 * stays facedown on that enemy and is flipped at its next activation, before and in addition to the automatic one
 * (RRG 1.8 "Boost, Boost Icon", p. 11). Not "1 additional boost card **for this activation**" — that is
 * `modifyAttack({ extraBoostCards })`, and the validator rejects this builder inside a Boost ability.
 *
 * Any card in play can hold one: "place 1 facedown boost card on your identity" is `giveBoostCard(yourIdentity)`
 * (Venom, `sm` 27073; docs/phase7-wave5.md §3.6), held until `moveBoostCards` moves it on.
 *
 * `giveBoostCard(theVillain, { card })` gives that card instead of the encounter deck's top: "Take the topmost
 * [Magnetic] card in the encounter discard pile and give it to Magneto as a facedown boost card" (Master of Magnetism
 * 32151; docs/phase7-wave6.md §3.16), with `card` a slot an earlier `selectCards` bound. Only a card out of play is
 * given; none found, nothing given.
 */
export const giveBoostCard = (
  enemy: TargetRef = theVillain,
  countOrCard: Amount | { readonly card: TargetRef } = 1,
): EffectSpec => {
  if (typeof countOrCard === "object" && "card" in countOrCard)
    return { kind: "giveBoostCard", enemy, card: countOrCard.card };
  return countOrCard === 1
    ? { kind: "giveBoostCard", enemy }
    : { kind: "giveBoostCard", enemy, count: amount(countOrCard) };
};
/**
 * "Swap her with [Version 2] Ironheart" (Level Up!, `ironheart` 29001a/29002a; docs/phase7-wave5.md §3.23): the
 * player's progressing identity becomes its next version; dial, counters, statuses, attachments and form stay.
 */
export const swapIdentity = (player: PlayerRef = you): EffectSpec => ({ kind: "swapIdentity", player });
/**
 * "Move each facedown boost card from your identity to Venom" ("Leave Us Alone!" 1B, `sm` 27071b;
 * docs/phase7-wave5.md §3.6): onto the first card `to` names, in the order dealt; moved before an activation's flip
 * step, they resolve in it.
 */
export const moveBoostCards = (from: TargetRef, to: TargetRef): EffectSpec => ({ kind: "moveBoostCards", from, to });
/**
 * "Place 1 acceleration token here" (The Master of Time 2B) / "place one acceleration token on one of the main
 * schemes" (MC21 p. 13's campaign instructions, a multi-main-scheme scenario). `target` absent is the central main
 * scheme (`EffectSpec addAccelerationToken.target`, RRG 1.8 "Acceleration Token", p. 5).
 */
export const addAccelerationToken = (target?: TargetRef): EffectSpec => ({
  kind: "addAccelerationToken",
  ...(target ? { target } : {}),
});
/**
 * "During the Resolve Mulligans step of game setup, each player may take 1 additional mulligan" (MC27 p. 22 reputation
 * node 5, RRG 1.8 p. 67 erratum; docs/phase7-wave5.md §3.27): a campaign instruction resolved at `beforeStartingHands`.
 */
export const grantAdditionalMulligans = (amount = 1): EffectSpec => ({ kind: "grantAdditionalMulligans", amount });
/**
 * "(This card counts towards your hand size.)" (MC45 p. 20; docs/phase7-wave8.md §3.44): after a setup instruction
 * put cards into `player`'s hand before the starting hands are drawn, `countTowardStartingHand(player, count)` makes
 * the starting draw that much smaller. Pass a count of the search's slot so a player who found nothing draws in full.
 */
export const countTowardStartingHand = (player: PlayerRef, count: Amount = 1): EffectSpec => ({
  kind: "countTowardStartingHand",
  player,
  amount: amount(count),
});
/**
 * "Either spend … resources or …": follow with `ifThen(not(made(bind)), …)`.
 *
 * `distinctTypes` (docs/phase7-wave6.md §3.69): "Spend 2 different resources" (Director's Directions, `mojo` 39033) is
 * `spendResources({ generic: 2 }, bind, you, { distinctTypes: 2 })`, or `spendDifferentResources(2, bind)`.
 */
export const spendResources = (
  resources: ResourceRequirement,
  bind: string,
  player: PlayerRef = you,
  opts: { readonly distinctTypes?: number } = {},
): EffectSpec => ({
  kind: "spendResources",
  player,
  resources,
  bind,
  ...(opts.distinctTypes !== undefined ? { distinctTypes: opts.distinctTypes } : {}),
});
/** "Spend N different resources": N resources of N different types, a wild being any one type (§3.69). */
export const spendDifferentResources = (count: number, bind: string, player: PlayerRef = you): EffectSpec =>
  spendResources({ generic: count }, bind, player, { distinctTypes: count });
/**
 * "Choose a card type" (Psychic Override, `next_evol` 40178; docs/phase7-wave7.md §3.33): `player` chooses one of
 * the fifteen card types, any of them whatever they hold (ruling, Jan 26, 2026 (4) answer 4). Later effects of the
 * same ability read it with `ofChosenCardType(bind)` ("of that type") and `notOfChosenCardType(bind)` ("not of that
 * type").
 */
export const chooseCardType = (bind: string, player: PlayerRef = you): EffectSpec => ({
  kind: "chooseCardType",
  player,
  bind,
});
/**
 * "Search your collection for 1 WEAPON upgrade from any aspect" (Armed to the Teeth, `deadpool` 44009;
 * docs/phase7-wave7.md §3.81; RRG 1.8 "Search", p. 39): `player` may pick one card of the game's card pool that
 * `filter` matches and that still has a copy outside the game (§4.1 Q47 = A). It joins the game as a new card they
 * own, out of play, bound as `bind` for the effects that follow (`chosen(bind)`), with `<bind>.count` 1 or 0.
 * `fromAnyAspect` is the "from any aspect" half of a filter.
 */
export const searchCollection = (
  filter: CollectionSearchFilter,
  bind: string,
  player: PlayerRef = you,
): EffectSpec => ({ kind: "searchCollection", player, filter, bind });
/**
 * "From any aspect" in a collection search: the five aspects, which leaves out basic, identity-specific and
 * campaign cards (the Deadpool insert's FAQ on Armed to the Teeth; §4.1 Q47 = A).
 */
export const fromAnyAspect: readonly string[] = ["aggression", "justice", "leadership", "protection", "pool"];
/**
 * A fact from outside the game that is known only when the card resolves (docs/phase7-wave7.md §3.83): `player` is
 * asked to report it, and the report is a recorded answer, never something the engine measures. Read it with
 * `varOf(`${bind}.amount`)`: the number for `"minutesAway"` ("heal 1 damage from each identity for every minute you
 * were away from the game" is `reportFact("minutesAway", "break")` then a heal of `varOf("break.amount")`), 1 for yes
 * and 0 for no for `"talkedThisPhase"` ("if you have not talked this phase" is `not(varAtLeast("talked.amount"))`).
 */
export const reportFact = (fact: ReportedFact, bind: string, player: PlayerRef = you): EffectSpec => ({
  kind: "reportFact",
  fact,
  player,
  bind,
});
/**
 * "You may place any number of ratings counters on The Champion to reduce this damage by 1 for each counter placed
 * this way" (Break a Leg, `mojo` 39009; docs/phase7-wave6.md §3.69): `player` chooses a whole number from `min`
 * (default 0) to `max`. Read it with `varOf(`${bind}.amount`)`. A live `Amount` is read when the effect resolves.
 */
export const chooseNumber = (
  bind: string,
  max: Amount,
  opts: { readonly min?: Amount; readonly player?: PlayerRef } = {},
): EffectSpec => ({
  kind: "chooseNumber",
  player: opts.player ?? you,
  ...(opts.min !== undefined ? { min: amount(opts.min) } : {}),
  max: amount(max),
  bind,
});

/**
 * "Search the encounter deck (and discard pile) for X and reveal it. Shuffle
 * the encounter deck." — X by exact printed name. "Reveal **it**" is one card: a card printed in several copies
 * (Test Subjects, 04123 ×2) reveals one of them, not all (`oneCopyOf`, docs/phase7-wave3.md §3.50).
 */
export const searchAndReveal = (
  name: string,
  zones: readonly ("deck" | "discard")[] = ["deck", "discard"],
  player: PlayerRef = you,
): EffectSpec[] => [
  selectCards("found", oneCopyOf(encounterCards(zones, { name }))),
  revealCard(chosen("found"), player),
  shuffleEncounterDeck(),
];

// ---------------------------------------------------------------------------
// Targeting sugar for the most common printed phrases
// ---------------------------------------------------------------------------

/** "An enemy" (any enemy; for non-attack damage, statuses). */
export const anEnemy = (slot = "enemy", extra: Omit<TargetQuery, "categories"> = {}): EffectSpec =>
  chooseTarget(slot, query("enemy", extra));
/** "An enemy" your identity may attack right now (RRG "Guard"). */
export const anAttackableEnemy = (slot = "enemy", categories: "enemy" | "minion" = "enemy"): EffectSpec =>
  chooseTarget(slot, query(categories, { attackableBy: yourIdentity }));
export const aScheme = (slot = "scheme", extra: Omit<TargetQuery, "categories"> = {}): EffectSpec =>
  chooseTarget(slot, query("scheme", extra));

/** "(attack): Deal N damage to an enemy." */
export const attackAnEnemy = (
  n: Amount,
  opts: { readonly slot?: string; readonly overkill?: boolean; readonly moveDamageFrom?: TargetRef } = {},
): EffectSpec[] => {
  const slot = opts.slot ?? "enemy";
  return [
    anAttackableEnemy(slot),
    attack(n, chosen(slot), {
      ...(opts.overkill ? { overkill: true } : {}),
      ...(opts.moveDamageFrom ? { moveDamageFrom: opts.moveDamageFrom } : {}),
    }),
  ];
};
/** "(thwart): Remove N threat from a scheme." */
export const thwartAScheme = (n: Amount, slot = "scheme"): EffectSpec[] => [aScheme(slot), thwart(n, chosen(slot))];
/** "Deal N damage to an enemy." (not an attack) */
export const damageAnEnemy = (n: Amount, slot = "enemy"): EffectSpec[] => [anEnemy(slot), dealDamage(n, chosen(slot))];
/** "Remove N threat from a scheme." (not a thwart) */
export const removeThreatFromAScheme = (n: Amount, slot = "scheme"): EffectSpec[] => [
  aScheme(slot),
  removeThreat(n, chosen(slot)),
];

// ---------------------------------------------------------------------------
// Wave 2 (cycle 1, docs/phase7-wave2.md) additions
// ---------------------------------------------------------------------------

/**
 * "Deal a total of N damage divided among X you choose" (Wasp Sting) / "Remove a total of N threat from among
 * schemes in play" (Inconspicuous): docs/phase7-wave2.md §3.7. A status name divides status cards: "place a total of 2
 * stun status cards on up to 2 enemies" (Thwip Thwip!) is `divide("stunned", 2, query("enemy"), { maxTargets: 2 })`;
 * see `EffectSpec divide.what` for the one-per-type rule it keeps. `"heal"` divides healing: "heal 3 damage from among
 * characters you control" (Compassion, `mut_gen` 32182) is `divide("heal", 3, query("character", { controller: "you"
 * }))`, no character healed of more than the damage on it. Threat divided by a "(thwart)"-labeled ability is thwarted:
 * the shares are instances of one thwart by your identity (RRG 1.8 "Labeled Ability", p. 26; "Thwart", p. 44), so
 * "after you thwart" answers the whole division once.
 */
export const divide = (
  what: "damage" | "threat" | "heal" | StatusName,
  n: Amount,
  among: TargetQuery,
  opts: {
    readonly chooser?: PlayerRef;
    readonly bind?: string;
    /**
     * "A total of **up to** N" (Agile Flight, `stld` 17029; docs/phase7-wave3.md §3.41): the chooser divides at most
     * N points, possibly none, and is asked even with a single candidate.
     */
    readonly upTo?: boolean;
    /** "… on **up to 2** enemies": the points go to at most this many different cards. */
    readonly maxTargets?: number;
  } = {},
): EffectSpec => ({
  kind: "divide",
  what,
  amount: amount(n),
  among,
  chooser: opts.chooser ?? you,
  ...withBind(opts.bind),
  ...(opts.upTo ? { upTo: true as const } : {}),
  ...(opts.maxTargets !== undefined ? { maxTargets: opts.maxTargets } : {}),
});

/**
 * "Choose two of the following (you may choose the same option twice)" (Double Time, `qsv`/`scw`): the plural form
 * of `chooseOne`, resolving `count` options in the order chosen. `allowRepeat` permits choosing the same option
 * more than once (RRG 1.8 "Choose (Option)", p. 12, forbids it otherwise).
 */
export const chooseOptions = (
  count: number,
  opts: readonly ChoiceOption[],
  config: { readonly chooser?: PlayerRef; readonly allowRepeat?: boolean } = {},
): EffectSpec => ({
  kind: "chooseOne",
  chooser: config.chooser ?? you,
  options: opts,
  count,
  ...(config.allowRepeat ? { allowRepeat: true } : {}),
});

/**
 * "Discard N cards from the encounter deck" (Taskmaster, Crossbones' Machine Gun, Luminous, …): docs/phase7-wave2.md
 * §3.6. `forEachDiscarded` runs its effects once per discarded card, in discard order, that card bound to its slot.
 */
export const discardEncounterCards = (
  n: Amount,
  opts: {
    readonly bind?: string;
    readonly forEachDiscarded?: { readonly slot: string; readonly effects: readonly EffectArg[] };
  } = {},
): EffectSpec => ({
  kind: "discardEncounterCards",
  count: amount(n),
  ...withBind(opts.bind),
  ...(opts.forEachDiscarded
    ? { forEachDiscarded: { slot: opts.forEachDiscarded.slot, effects: flatten(opts.forEachDiscarded.effects) } }
    : {}),
});

/** "Create the [name] deck" (docs/phase7-wave2.md §3.3): moves the matching encounter-deck cards out and shuffles. */
export const buildScenarioDeck = (
  name: string,
  opts: { readonly from?: readonly ScenarioDeckSource[] } = {},
): EffectSpec => ({ kind: "buildScenarioDeck", name, ...(opts.from ? { from: opts.from } : {}) });
/** "Reveal the top card of the [name] deck" — the scenario-deck sibling of `zone`/`encounterCards`. */
export const scenarioDeck = (
  name: string,
  opts: { readonly zones?: readonly ("deck" | "discard")[]; readonly top?: Amount; readonly filter?: TargetQuery } = {},
): CardSelector => ({
  kind: "scenarioDeck",
  name,
  ...(opts.zones ? { zones: opts.zones } : {}),
  ...(opts.top !== undefined ? { top: amount(opts.top) } : {}),
  ...(opts.filter ? { filter: opts.filter } : {}),
});

/**
 * A named scenario deck as `moveCards`' destination, for a card from anywhere (docs/phase7-wave6.md §3.66): "Shuffle
 * this card into the show deck" (Cornered!, `mojo` 39017) is `moveCards(cards(self), toScenarioDeck("show"))`; "place it
 * on the bottom of the show deck instead" (Across the Mojoverse 1B, 39015b) is
 * `instead(moveCards(cards(eventTarget), toScenarioDeck("show", "bottom")))`. The card goes in facedown, and the deck
 * becomes its home when it has a discard pile of its own or none. A player card's ability moves nothing into a deck
 * closed to player cards (`ScenarioSeparateDeck.closedToPlayerCards`), nor selects, looks at or moves its cards.
 */
export const toScenarioDeck = (name: string, at: "top" | "bottom" | "shuffle" = "shuffle"): CardDestination => ({
  scenarioDeck: name,
  at,
});
/**
 * "Look at the top card of the show deck and put it on the top or bottom of that deck" (Erratic Teleportation, `mojo`
 * 39019; docs/phase7-wave6.md §3.66): `viewer` looks (RRG 1.8 "Look, Looked-At", p. 27), then chooses where the card
 * goes. Putting it back on top is logged as a move too, so the log shows which was chosen. An empty deck shows nothing
 * and asks nothing.
 */
export const lookAtTopOfScenarioDeckThenPlace = (name: string, viewer: PlayerRef = you): readonly EffectSpec[] => {
  const seen = `${name}.seen`;
  const place = (at: "top" | "bottom"): EffectSpec => moveCards(cards(chosen(seen)), toScenarioDeck(name, at));
  return [
    lookAt(scenarioDeck(name, { top: 1 }), { bind: seen, viewer }),
    ifThen(
      valueAtLeast(varOf(`${seen}.count`), 1),
      chooseOneBy(
        viewer,
        option(`Put it on top of the ${name} deck`, place("top")),
        option(`Put it on the bottom of the ${name} deck`, place("bottom")),
      ),
    ),
  ];
};

/**
 * "The player who defeated it takes that ally into their hand" (Captured by Hydra, `trors` pack): docs/phase7-wave2.md
 * §3.10; the taker becomes the card's owner. `keepOwner`: the card goes to `player`'s hand and stays its owner's
 * (Plot Convenience, `deadpool` 44050, used by a player who does not own the attached card; docs/phase7-wave7.md §4.1
 * Q53): discarded or spent from that hand, or played as an event, it goes to its owner's discard pile (RRG 1.8
 * "Ownership and Control", p. 31).
 */
export const takeIntoHand = (
  from: CardSelector,
  player: PlayerRef = you,
  opts: { readonly keepOwner?: true } = {},
): EffectSpec => ({
  kind: "takeIntoHand",
  cards: from,
  player,
  ...(opts.keepOwner ? { keepOwner: true as const } : {}),
});

/**
 * "Increase the amount of damage that event deals by 2" (Embiggen!, `msm` 05010) / "… the amount of threat that event
 * removes" (Shrink, 05011): a bonus on the card being played, added to each damage / threat removal it produces while
 * it resolves (docs/phase7-wave1.md §3.13).
 *
 * `note` (docs/phase7-wave6.md §3.52) records a number on that card's play, read by `playNote` while the card
 * resolves: Throw de Card (Gambit 37001a, "remove up to 3 charge counters from here → that event deal +1 damage for
 * each counter removed") is `modifyCardEffect(eventTarget, { damage: varOf("removed"), note: { name: "throwDeCard",
 * value: varOf("removed") } })` with `removeUpToCounters("charge", 3, { bind: "removed" })`, and Charged Card (37006)
 * reads `playNote("throwDeCard", 1 | 2 | 3)`. The note is written even when no bonus is given.
 */
export const modifyCardEffect = (
  card: TargetRef,
  opts: {
    readonly damage?: Amount;
    readonly threatRemoved?: Amount;
    readonly note?: { readonly name: string; readonly value: Amount };
  },
): EffectSpec => ({
  kind: "modifyCardEffect",
  card,
  ...(opts.damage !== undefined ? { damage: amount(opts.damage) } : {}),
  ...(opts.threatRemoved !== undefined ? { threatRemoved: amount(opts.threatRemoved) } : {}),
  ...(opts.note ? { note: { name: opts.note.name, value: amount(opts.note.value) } } : {}),
});

/**
 * "Return that event to your hand after resolving its effects" (Avian Anatomy, `angel` 42008;
 * docs/phase7-wave7.md §3.68): the played event `card` names goes to its owner's hand, not the discard pile, once its
 * effects have resolved. `card` is the event paid for: `eventTarget` in a response to `on.youSpendThis({ toPlay })`,
 * `chosen("paidFor")` in a `resource(...)` ability's effects. A canceled event is still discarded, and one its own
 * text moved stays where that put it.
 */
export const returnToHandAfterResolving = (card: TargetRef): EffectSpec => ({
  kind: "afterResolving",
  card,
  to: "hand",
});

/**
 * "Play a card from your hand, ignoring its resource cost." (Chaos Magic, `scw` pack): docs/phase7-wave2.md §3.8.
 *
 * docs/phase7-wave6.md §3.42 (Wolverine's Claws 35002: "… → play that event, ignoring its resource cost. That attack
 * gains piercing"): `card` is a card picked already (`chooseCardCost`), played without asking; `via` records the
 * ability's card on the play for `playedVia` ("If you exhausted Wolverine's Claws to play this card"); `whileResolving`
 * are rules lasting exactly while the played card resolves, read in this ability's context.
 */
export const playFromHandIgnoringCost = (
  player: PlayerRef = you,
  opts: {
    readonly filter?: TargetQuery;
    readonly optional?: boolean;
    readonly card?: TargetRef;
    readonly via?: TargetRef;
    readonly whileResolving?: readonly RuleSpec[];
  } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player,
  ignoreCost: true,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
  ...(opts.card ? { card: opts.card } : {}),
  ...(opts.via ? { via: opts.via } : {}),
  ...(opts.whileResolving && opts.whileResolving.length > 0 ? { whileResolving: opts.whileResolving } : {}),
});
/**
 * "Play a card from your hand […], reducing its resource cost by N" (Team-Building Exercise, `ant`/`spiderham`/
 * `iceman`; docs/phase7-wave2.md §9). The reduction-carrying sibling of `playFromHandIgnoringCost` — exactly one
 * of the two is set, never both (an unaffordable card, after the reduction, is not offered; RRG 1.8 "Initiating
 * Abilities", p. 24, step 3 — §9.2.1).
 */
export const playFromHandReducingCost = (
  n: Amount,
  player: PlayerRef = you,
  opts: {
    readonly filter?: TargetQuery;
    readonly optional?: boolean;
    /**
     * The effect's text instructs the play of an event with an Action ability ("play an event with a 'Hero Action'
     * ability from your hand", Warpath 42013): the event may be played outside a player's turn. Everything else about
     * playing it still applies (`EffectSpec playFromHand.ignoreActionTiming`).
     */
    readonly ignoreActionTiming?: boolean;
  } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player,
  costReduction: amount(n),
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
  ...(opts.ignoreActionTiming ? { ignoreActionTiming: true as const } : {}),
});
/**
 * "Play the set-aside Death-Glow upgrade as if it were in your hand" (Valkyrie's Death Perception, 25001a;
 * docs/phase7-wave4.md §3.22): a card from your set-aside area, played and paid for as from hand (its host chosen if
 * it has several). `playSetAside(query("upgrade", { name: "Death-Glow" }))`.
 */
export const playSetAside = (filter?: TargetQuery, player: PlayerRef = you): EffectSpec => ({
  kind: "playFromHand",
  player,
  from: "setAside",
  costReduction: amount(0),
  ...(filter ? { filter } : {}),
});
/**
 * "Search their deck for a card and play that card, ignoring its resource cost. (Shuffle.)" (Fetch Quest, 39045,
 * erratum RRG 1.8 p. 69; docs/phase7-wave6.md §3.70): the whole deck is searched, only a card the player could legally
 * play now is offered (never a Requirement card), and the deck is shuffled once the played card has resolved, or at
 * once if none was played. "You may" by default. "In player order, each player may …" is
 * `forEachPlayer(eachPlayer, playFromDeckIgnoringCost(thatPlayer))`.
 */
export const playFromDeckIgnoringCost = (
  player: PlayerRef = you,
  opts: { readonly filter?: TargetQuery; readonly optional?: boolean } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player,
  from: "deck",
  ignoreCost: true,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional === false ? {} : { optional: true }),
});

/**
 * "Play the ally here as if it was in your hand. It enters play exhausted." (Med Lab, 38028; docs/phase7-wave6.md
 * §3.57): a card tucked under `under` (default this card) is played as if from hand. Its cost is paid normally unless
 * `ignoreCost`; every play restriction applies, it counts as played ("after you play an ally" responses fire) and the
 * ally limit is checked as it enters play. `entersExhausted` places it exhausted. Required by default, so an action
 * ability made only of this cannot be initiated while nothing tucked there could be played and paid for. Med Lab's
 * Alter-Ego Action is `playTuckedCard({ entersExhausted: true })` behind an exhaust-self cost.
 */
export const playTuckedCard = (
  opts: {
    readonly under?: TargetRef;
    readonly filter?: TargetQuery;
    readonly entersExhausted?: boolean;
    readonly ignoreCost?: boolean;
    readonly optional?: boolean;
    readonly player?: PlayerRef;
  } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player: opts.player ?? you,
  from: { tuckedUnder: opts.under ?? self },
  ...(opts.ignoreCost ? { ignoreCost: true as const } : {}),
  ...(opts.entersExhausted ? { entersExhausted: true as const } : {}),
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
});

/** "Advance the main scheme to stage N" (docs/phase7-wave2.md §1.6/§3.4). */
export const advanceMainScheme = (
  opts: { readonly to?: { readonly stageNumber: number; readonly name?: string }; readonly scheme?: TargetRef } = {},
): EffectSpec => ({
  kind: "advanceMainScheme",
  ...(opts.to ? { to: opts.to } : {}),
  ...(opts.scheme ? { scheme: opts.scheme } : {}),
});
/**
 * "Shuffle all copies of main scheme 2A and stack them under this scheme." (The Brotherhood Strikes! 1A;
 * docs/phase7-wave6.md §3.18): the stages from `fromStageIndex` on are walked in a seeded random order.
 */
export const shuffleMainSchemeStages = (
  fromStageIndex: number,
  opts: { readonly stageNumber?: number } = {},
): EffectSpec => ({
  kind: "shuffleMainSchemeStages",
  fromStageIndex,
  ...(opts.stageNumber !== undefined ? { stageNumber: opts.stageNumber } : {}),
});
/**
 * "Advance to a random stage 2A" and, later, "the other stage 2A" (docs/phase7-wave7.md §3.28): only the stages with
 * this number are shuffled, in place, so a later stage stays behind them. Follow it with `advanceMainScheme()`; the
 * default advance walks the order, so a stage's "When Completed: Advance to the other stage 2A. If you cannot, advance
 * to stage 3A" needs no effect of its own (the completion already advances once).
 */
export const shuffleMainSchemeStageGroup = (stageNumber: number): EffectSpec =>
  shuffleMainSchemeStages(0, { stageNumber });
/**
 * "Remove 1 random stage 2 from the game." (docs/phase7-wave7.md §3.28): `random` stages with this number, never the
 * one showing nor one already spent, picked with the seeded RNG. `bind` records how many went as `<bind>.count`.
 */
export const removeMainSchemeStages = (
  stageNumber: number,
  random: Amount = 1,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({
  kind: "removeMainSchemeStages",
  stageNumber,
  random: amount(random),
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
/**
 * "Add this card / this scheme to the victory display" (The Brotherhood Strikes! 1B and its stage 2Bs;
 * docs/phase7-wave6.md §3.19): the current stage goes to the victory display. Put it before the advance.
 */
export const addMainSchemeStageToVictoryDisplay = (scheme?: TargetRef): EffectSpec => ({
  kind: "addMainSchemeStageToVictoryDisplay",
  ...(scheme ? { scheme } : {}),
});
/** "If all the players at this stage are defeated, this stage is complete." (Kang's stage 3 cards). */
export const completeMainScheme = (scheme: TargetRef = theMainScheme): EffectSpec => ({
  kind: "completeMainScheme",
  scheme,
});
/** "The players win/lose the game." (docs/phase7-wave2.md §3.4, used where `Scenario.victory` is `"cardAbility"`). */
export const endGame = (
  result: "win" | "loss",
  reason?: "mainSchemeCompleted" | "allPlayersDefeated" | "cardAbility",
): EffectSpec => {
  // A loss a card's own text scripts is that card's doing, and the Game Over screen names it; a stage's completion
  // passes `"mainSchemeCompleted"` explicitly.
  const why = reason ?? (result === "loss" ? "cardAbility" : undefined);
  return { kind: "endGame", result, ...(why ? { reason: why } : {}) };
};
/** "Add [villain] to the game area" (docs/phase7-wave2.md §3.4). */
/**
 * `row: "shuffled"`: "Shuffle the … villains, then reveal them in a row from left to right. Place the active counter on
 * the leftmost villain" (The Horsemen of Apocalypse 1A, `aoa` 45085a; docs/phase7-wave8.md §3.7): the set-aside villains
 * named enter in a seeded random order, which becomes `GameState.villainRow`, and the leftmost takes the active counter.
 */
export const addVillain = (
  villain: TargetRef,
  opts: { readonly reveal?: boolean; readonly bind?: string; readonly row?: "shuffled" } = {},
): EffectSpec => ({
  kind: "addVillain",
  villain,
  ...(opts.reveal ? { reveal: true } : {}),
  ...(opts.bind ? { bind: opts.bind } : {}),
  ...(opts.row ? { row: opts.row } : {}),
});
/**
 * "Set this villain aside." (the Sinister Six's When Defeated, MC27 p. 15): back to the set-aside area as a new copy,
 * where `addVillain` can bring it back. docs/phase7-wave5.md §3.1.
 */
export const setVillainAside = (villain: TargetRef): EffectSpec => ({ kind: "setVillainAside", villain });
/** "Move the active counter to the next villain in the activation order." (MC27 p. 15; docs/phase7-wave5.md §3.1) */
export const moveActiveCounterToNextVillain: EffectSpec = { kind: "moveActiveCounter", to: "nextInActivationOrder" };
/**
 * "Move the active counter to the next villain" where the villains sit in a row (The Horsemen of Apocalypse 1B, `aoa`
 * 45085b; MC45 p. 11): one place to the right of the villain that holds the counter in `GameState.villainRow`, wrapping
 * to the leftmost; a lone villain keeps it. Always from the holder, whichever villain's activation asked
 * (docs/phase7-wave8.md §3.7, §3.8, §4.1 Q5 = A).
 */
export const moveActiveCounterToNextInRow: EffectSpec = { kind: "moveActiveCounter", to: "nextInRow" };
/**
 * "Move the glider counter to the main scheme with the least threat" (MC27 p. 17): every counter of `counterType`
 * (absent: every type) on the cards `from` names goes to the first card `to` names. docs/phase7-wave5.md §3.3.
 */
export const moveCounters = (from: TargetRef, to: TargetRef, counterType?: string): EffectSpec => ({
  kind: "moveCounters",
  from,
  to,
  ...(counterType !== undefined ? { counterType } : {}),
});
/** "Remove [villain] and this stage from the game." */
export const removeVillain = (villain: TargetRef): EffectSpec => ({ kind: "removeVillain", villain });
/** "Remove [stage] from the game." (a separate game area's own main scheme stage). */
export const removeMainSchemeStage = (scheme: TargetRef): EffectSpec => ({ kind: "removeMainSchemeStage", scheme });
/** "Each player reveals a random stage 3A in turn order" (The Master of Time 2A). */
export const revealMainSchemeStage = (
  player: PlayerRef,
  stageNumber: number,
  opts: { readonly removeUnused?: boolean } = {},
): EffectSpec => ({
  kind: "revealMainSchemeStage",
  player,
  stageNumber,
  ...(opts.removeUnused ? { removeUnused: true } : {}),
});
/** "Create your own game area and place this scheme in it" (Kang's stage 3A cards). */
export const createGameArea = (scheme: TargetRef): EffectSpec => ({ kind: "createGameArea", scheme });
/** "Join another game area" / "combine your game area with another game area." */
export const joinGameArea = (): EffectSpec => ({ kind: "joinGameArea" });
/** "At the end of the phase, …" — the phase counterpart of `atEndOfRound`. */
export const atEndOfPhase = (...effects: readonly EffectArg[]): EffectSpec => ({
  kind: "atEndOfPhase",
  effects: flatten(effects),
});
/**
 * "Flip this card and reveal [the villain's next stage]" / "Remove this card from the game and reveal [it]": the stage
 * change of a defeat with no defeat, at the new stage's full printed hit points, everything on the villain kept
 * (docs/phase7-wave8.md §3.18).
 */
export const revealNextVillainStage = (villain: TargetRef): EffectSpec => ({ kind: "revealNextVillainStage", villain });
/**
 * "Change Apocalypse to [Giant] form" — a three-sided villain's face change, resolved as a flip. `{ reveal: false }`:
 * the change is not a reveal (MC45 p. 19; docs/phase7-wave8.md §3.26), so the new face's reveal step does not run;
 * "after [the villain] changes to this form" (`cardFlipped`) still does.
 */
export const changeVillainForm = (
  villain: TargetRef,
  toFaceWithTrait: Trait,
  options: { readonly reveal?: false } = {},
): EffectSpec => ({
  kind: "changeVillainForm",
  villain,
  toFaceWithTrait,
  ...(options.reveal === false ? { reveal: false as const } : {}),
});
/**
 * "Flip [card]" (RRG 1.8 "Flip"). `{ reveal: true }`: "Flip this card and reveal it" / "flip this card and reveal
 * [its other face]" on an encounter card, whose new face then goes through the reveal (its When Revealed, the "when
 * revealed" windows, incite, peril, surge; docs/phase7-wave7.md §3.14, §3.34). Without it a flip is not a reveal.
 */
export const flipCard = (target: TargetRef, options: { readonly reveal?: boolean } = {}): EffectSpec => ({
  kind: "flipCard",
  target,
  ...(options.reveal ? { reveal: true } : {}),
});
/**
 * "Change to Gamma energy form" → `changeAdditionalForm("energy", { toName: "Gamma" })`; "flip that card faceup to change
 * to that energy form" → `{ to: chosen("form") }`; "Change mass form by flipping your mass form upgrade over" →
 * `changeAdditionalForm("mass")` (docs/phase7-wave4.md §3.1). One single-faced form card of a type shows at a time; a
 * double-sided one flips. Never the once-per-round form change; "You cannot change energy forms" stops it.
 */
export const changeAdditionalForm = (
  formType: string,
  opts: { readonly to?: TargetRef; readonly toName?: string; readonly player?: PlayerRef } = {},
): EffectSpec => ({
  kind: "changeAdditionalForm",
  player: opts.player ?? you,
  formType,
  ...(opts.to !== undefined ? { to: opts.to } : {}),
  ...(opts.toName !== undefined ? { toName: opts.toName } : {}),
});
/**
 * "Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in play"
 * (Under Siege 1A, Tower Defense, `mts` 21098a; docs/phase7-wave4.md §3.2).
 */
export const putMainSchemeStageIntoPlay = (stageNumber: number, name?: string): EffectSpec => ({
  kind: "putMainSchemeStageIntoPlay",
  stageNumber,
  ...(name !== undefined ? { name } : {}),
});
/**
 * "Swap Loki with a random set-aside Loki villain" (The Trickster, Casket of Ancient Winters, `mts`; Stories and Lies,
 * `tt`): RRG 1.8 "'Swap'" (p. 42), everything on the villain stays, dial included (docs/phase7-wave4.md §3.7).
 */
export const swapVillain = (villain: TargetRef = { kind: "villain" }): EffectSpec => ({ kind: "swapVillain", villain });
/**
 * Raises a named moment other cards answer with `on.moment(name)` (docs/phase7-wave8.md §3.39): "After you resolve a
 * mission attempt", "After you resolve Bishop's 'Energy Absorption' ability". Put it where the thing it names is done:
 * the effects before it have resolved when the answers resolve, and the ones after it wait. `player` is the "you" of
 * the moment. The engine reads nothing into the name; a moment nobody answers does nothing.
 *
 * `carry` (§3.71): slots of this ability handed to the answers, with their vars. An answering ability reads the slot
 * `"pulled"` as `chosen("moment.pulled")` and its vars as `"moment.pulled.count"`, `"moment.pulled.mental"`, in its
 * effects and in its `while` condition alike.
 */
export const raiseMoment = (name: string, player: PlayerRef = you, carry: readonly string[] = []): EffectSpec => ({
  kind: "raiseMoment",
  name,
  player,
  ...(carry.length > 0 ? { carry } : {}),
});
/**
 * "Swap your WEATHER support in play with a support of your choice from the WEATHER deck" (Weather Control, `storm`
 * 36001a): RRG 1.8 "'Swap'" (p. 42), each ref naming one card (docs/phase7-wave6.md §3.47). Different titles: the
 * in-play card leaves play into the other's place and the other enters play ready; the same title: nothing enters or
 * leaves play. Follow a search with `shuffleSeparateDeck` / `shuffleDeck`.
 */
export const swapCards = (a: TargetRef, b: TargetRef): EffectSpec => ({ kind: "swapCards", a, b });
/**
 * "When Loki is defeated, advance to a random set-aside Loki villain" (All Hail King Loki 1B): from a forced interrupt
 * to the villain's defeat, `advanceToSetAsideVillain(eventTarget)` (docs/phase7-wave4.md §3.7).
 */
export const advanceToSetAsideVillain = (villain: TargetRef = { kind: "villain" }): EffectSpec => ({
  kind: "advanceToSetAsideVillain",
  villain,
});
/**
 * "The first player detaches Odin from the main scheme and takes control of him" (Hall of Nastrond, `mts` 21141; Find the
 * Senator, `mut_gen` 32065a; docs/phase7-wave4.md §3.8): the card stays in play, under `controller`'s control.
 */
export const detach = (card: TargetRef, controller: PlayerRef = { kind: "firstPlayer" }): EffectSpec => ({
  kind: "detach",
  card,
  controller,
});
/** "Turn all your energy form upgrades facedown" (Monica Rambeau, `mts` 21001b; docs/phase7-wave4.md §3.1). */
export const turnFacedown = (target: TargetRef): EffectSpec => ({ kind: "turnFacedown", target });

/** "Increase or decrease the number of boost icons on that card by 1 for this count" (Crest, `scw` pack). */
export const adjustBoostCount = (delta: Amount): EffectSpec => ({ kind: "adjustBoostCount", delta: amount(delta) });
/** "…discard the top card of the encounter deck and count the number of boost icons on that card instead" (Chaos Control). */
export const replaceBoostCount = (card: TargetRef): EffectSpec => ({ kind: "replaceBoostCount", card });

/** "Attach 1 card from your hand facedown here" (`facedown` for a facedown attach). */
export const attachCard = (card: TargetRef, to: TargetRef, opts: { readonly facedown?: boolean } = {}): EffectSpec => ({
  kind: "attach",
  card,
  to,
  ...(opts.facedown ? { facedown: true } : {}),
});
/** "Engage that enemy" (RRG 1.8 "Engage"). */
export const engage = (minion: TargetRef, player: PlayerRef = you): EffectSpec => ({ kind: "engage", minion, player });
/** "Put the others back in any order" (RRG 1.8 "Deck"). */
export const reorderCards = (from: CardSelector, chooser: PlayerRef = you): EffectSpec => ({
  kind: "reorderCards",
  cards: from,
  chooser,
  to: "encounterDeckTop",
});
/**
 * "Place the rest on the top and/or bottom of the encounter deck in any order" (Take the Fight to Them, `gmw` 16161;
 * docs/phase7-wave3.md §3.48): `chooser` sends each card to the top or the bottom, then orders each pile.
 */
export const placeOnTopOrBottom = (from: CardSelector, chooser: PlayerRef = you): EffectSpec => ({
  kind: "reorderCards",
  cards: from,
  chooser,
  to: "encounterDeckTopOrBottom",
});
/**
 * "Look at the top 4 cards of a player deck … put the others on the top and/or bottom of that deck in any order"
 * (Global Logistics, `sm` 27043; docs/phase7-wave5.md §4.1 Q60): `placeOnTopOrBottom` for `deckOwner`'s player deck.
 */
export const placeOnTopOrBottomOfPlayerDeck = (
  from: CardSelector,
  deckOwner: PlayerRef = you,
  chooser: PlayerRef = you,
): EffectSpec => ({
  kind: "reorderCards",
  cards: from,
  chooser,
  to: "playerDeckTopOrBottom",
  deckOwner,
});
/**
 * "Deal N indirect damage to each player" / "…to you" (RRG 1.8 "Indirect Damage"): each player divides it among the
 * characters they control. `to: "group"` has the first player divide it among every friendly character.
 */
export const dealIndirectDamage = (
  to: PlayerRef | "group",
  n: Amount,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({
  kind: "dealIndirectDamage",
  to,
  amount: amount(n),
  ...withBind(opts.bind),
});
/** "Remove N counters from X" as an effect (not a cost — see `dsl/abilities.ts`'s `removeCounter` for the cost form). */
export const removeCountersFrom = (target: TargetRef, counterType: string, n: Amount = 1): EffectSpec => ({
  kind: "removeCounters",
  target,
  counterType,
  amount: amount(n),
});
/**
 * "Remove all bomb counters from play" (Boom Boom, `mut_gen` 32090): every counter of that type on each card `target`
 * names — `each(query([], { hasCounter: type }))` for "from play". `bind`: `<bind>.amount` removed in all, and
 * `varFor("<bind>.amount", card)` the number removed from that card ("for each bomb counter removed from it").
 */
export const removeEachCounterFrom = (
  target: TargetRef,
  counterType: string,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({
  kind: "removeCounters",
  target,
  counterType,
  ...(opts.bind !== undefined ? { bind: opts.bind } : {}),
});
/**
 * "Discard all counters from X" (Green Gobbler, `spiderham` 30026: "discard all counters from each card you
 * control") — every counter type X currently holds, each fully removed, not one named type by a fixed amount
 * (`removeCountersFrom`'s own shape).
 */
export const removeAllCountersFrom = (target: TargetRef): EffectSpec => ({
  kind: "removeCounters",
  target,
});
/**
 * "Move all threat from the side scheme with the least threat to the side scheme with the most threat" / "move 1
 * threat from a scheme to here" (RRG 1.8 "Move"). `amount` absent moves all of it.
 */
export const moveThreat = (
  from: TargetRef,
  to: TargetRef,
  opts: { readonly amount?: Amount; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "moveThreat",
  from,
  to,
  ...(opts.amount !== undefined ? { amount: amount(opts.amount) } : {}),
  ...withBind(opts.bind),
});

// ---------------------------------------------------------------------------
// Campaign mode (docs/campaign-mode-design.md §6.1, §6.2)
// ---------------------------------------------------------------------------

/**
 * "Shuffle each EXPERIMENTAL attachment recorded in the campaign log into the encounter deck" (MC10 p. 7): the cards
 * a campaign-log field names, wherever they are. A title recorded twice names two cards (ruling June 2, 2026 (3)).
 *
 * `byName` instead names every card printing the name of a recorded card: "each minion with the same name as a
 * villain's name recorded" (MC27 p. 17). Narrow it with `filter`.
 */
export const campaignLogCards = (
  field: string,
  opts: { readonly seat?: PlayerRef; readonly filter?: TargetQuery; readonly byName?: boolean } = {},
): CardSelector => ({
  kind: "campaignLog",
  field,
  ...(opts.seat ? { seat: opts.seat } : {}),
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.byName ? { byName: true } : {}),
});

/**
 * "Record … in the campaign log" from inside a game. The write accumulates in game state and the campaign runner
 * folds it into the log afterwards, whatever the game's outcome (RRG 1.8 p. 29; design §6.2).
 *
 * `mode` defaults to `"set"`; `seat` absent writes the shared field, and `eachPlayer` writes the same value into
 * every seat's column (a different value per seat is `forEachPlayer` around this effect).
 */
export const recordInCampaignLog = (
  field: string,
  value: CampaignLogValueSpec,
  opts: { readonly mode?: LogWriteMode; readonly seat?: PlayerRef } = {},
): EffectSpec => ({
  kind: "recordInCampaignLog",
  field,
  mode: opts.mode ?? "set",
  value,
  ...(opts.seat ? { seat: opts.seat } : {}),
});

/** "Remove it from the campaign log" (MC10 p. 3 card text): by face, per ruling April 30, 2026 (4). */
export const removeFromCampaign = (from: CardSelector): EffectSpec => ({ kind: "removeFromCampaign", cards: from });

/** The value half of `recordInCampaignLog`, one builder per log field kind an in-game sentence can write. */
export const logNumber = (n: Amount): CampaignLogValueSpec => ({ kind: "number", amount: amount(n) });
export const logFlag = (when?: Predicate): CampaignLogValueSpec => ({
  kind: "flag",
  ...(when ? { when } : {}),
});
export const logCardList = (from: CardSelector): CampaignLogValueSpec => ({ kind: "cardList", cards: from });
export const logCardRef = (from: CardSelector, withFace = false): CampaignLogValueSpec => ({
  kind: "cardRef",
  card: from,
  ...(withFace ? { withFace: true } : {}),
});
export const logOption = (option: string): CampaignLogValueSpec => ({ kind: "choice", option });
export const logText = (value: string): CampaignLogValueSpec => ({ kind: "text", value });
