import type {
  CampaignLogValueSpec,
  CardDestination,
  CardSelector,
  EventPattern,
  EffectSpec,
  FacedownRole,
  LastingUntil,
  NextBasicPowerUntil,
  LogWriteMode,
  PlayerRef,
  PlayerZone,
  Predicate,
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
/** "Deal N damage to X" — not an attack (no guard, no retaliate). */
export const dealDamage = (n: Amount, target: TargetRef, opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: amount(n),
  ...withBind(opts.bind),
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
 * "Remove N threat" — not a thwart (unless the ability is labeled; then use `thwart`). `ignoreCrisis`: "…, ignoring
 * any crisis icons in play" (Cable Arrow, `trors`): steps over the RRG 1.8 "Crisis Icon" (p. 14) check that
 * otherwise stops players removing threat from the main scheme while one is in play.
 */
export const removeThreat = (
  n: Amount,
  target: TargetRef,
  opts: { readonly bind?: string; readonly ignoreCrisis?: boolean } = {},
): EffectSpec => ({
  kind: "removeThreat",
  target,
  amount: amount(n),
  ...(opts.ignoreCrisis ? { ignoreCrisis: true } : {}),
  ...withBind(opts.bind),
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
   */
  readonly removesThreat?: true;
  /**
   * "Damage from that attack is dealt to the chosen enemy instead of you" (Psychic Misdirection 34033;
   * docs/phase7-wave6.md §3.36), from an interrupt to the enemy attack: the first enemy the ref names, other than the
   * attacker, takes the attack's damage instead, as attack damage from the attacker without being attacked (§4.1 Q18).
   */
  readonly damageTo?: TargetRef;
  readonly keywords?: readonly AttackKeyword[];
  /**
   * "Prevent all damage from this attack" (Mockingbird 04004), set from an interrupt at attack *initiation* — before
   * a defender is declared, so `preventDamage()` (which adjusts an already-pushed `dealDamage` frame) can't express
   * it. The flag rides the activation's own event frame through `declareDefender` and the eventual damage step
   * (RRG 1.8 "Prevent", p. 34): the damage is still dealt (for "the attacking character dealt damage" purposes,
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
  ...(change.keywords && change.keywords.length > 0 ? { keywords: change.keywords } : {}),
  ...(change.preventAllDamage ? { preventAllDamage: true } : {}),
  ...(change.preventDamage !== undefined ? { preventDamage: amount(change.preventDamage) } : {}),
  ...(change.defenseUsesAtk ? { defenseUsesAtk: true } : {}),
  ...(change.boostIconsEach !== undefined ? { boostIconsEach: amount(change.boostIconsEach) } : {}),
  ...(change.noBoost ? { noBoost: true } : {}),
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
 * "When Crossfire attacks, he attacks the friendly character with the fewest remaining hit points" (Crossfire, `hood`
 * 24026; docs/phase7-wave4.md §3.21): the enemy attack being initiated is against that character instead, and its
 * controller is the attacked player. A new attack against a character is `enemyAttack`'s `targetCharacter` (Speed
 * Demon: "Speed Demon attacks that character").
 */
export const retargetAttack = (character: TargetRef): EffectSpec => ({ kind: "retargetAttack", character });
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
): EffectSpec => ({
  kind: "reduceNextCardCost",
  player,
  amount: amount(n),
  duration,
  ...(cardFilter ? { cardFilter } : {}),
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
  topOrOpts?: Amount | { readonly top?: Amount; readonly topmostOnly?: boolean },
  deckOf?: TargetRef,
): CardSelector => {
  const opts: { readonly top?: Amount; readonly topmostOnly?: boolean } =
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
/** `bind`: the cards that entered play, and `<bind>.count` ("If no minion was put into play this way", §3.59). */
export const putIntoPlay = (
  card: TargetRef,
  controller: PlayerRef = you,
  opts: { readonly bind?: string } = {},
): EffectSpec => ({
  kind: "putIntoPlay",
  card,
  controller,
  ...withBind(opts.bind),
});
/**
 * "Setup: Put [your permanent card] into play" (RRG 1.8 "Permanent", p. 32: permanent cards are set aside before setup
 * step 1, docs/phase7-wave6.md §3.74): every card of yours in your set-aside area that `filter` matches, bound to
 * `slot`, put into play under your control, and attached to `attachTo` when given (`putIntoPlay` never infers a host
 * from `attachesTo`). Faceup on its front; follow with `turnFacedown(chosen(slot))` for a facedown start.
 */
export const putIntoPlayFromSetAside = (
  slot: string,
  filter: TargetQuery,
  opts: { readonly attachTo?: TargetRef } = {},
): EffectSpec[] => [
  selectCards(slot, setAside(you, filter)),
  putIntoPlay(chosen(slot), you),
  ...(opts.attachTo ? [attachCard(chosen(slot), opts.attachTo)] : []),
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
export const discardDeckUntil = (filter: TargetQuery, bind: string, player: PlayerRef = you): EffectSpec => ({
  kind: "discardDeckUntil",
  player,
  filter,
  bind,
});
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
export const dealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "dealEncounterCard", player });
/**
 * "Deal that card to yourself as a facedown encounter card" (You Dare Oppose Me?, `ron` 90005): deals the card(s)
 * `cards` names, already identified and out of play, rather than the encounter deck's top card (docs/phase7-wave3.md
 * §3.47).
 */
export const dealAsEncounterCard = (cards: TargetRef, player: PlayerRef = you): EffectSpec => ({
  kind: "dealAsEncounterCard",
  cards,
  player,
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
/** "Either spend … resources or …": follow with `ifThen(not(made(bind)), …)`. */
export const spendResources = (resources: ResourceRequirement, bind: string, player: PlayerRef = you): EffectSpec => ({
  kind: "spendResources",
  player,
  resources,
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
 * see `EffectSpec divide.what` for the one-per-type rule it keeps.
 */
export const divide = (
  what: "damage" | "threat" | StatusName,
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

/** "The player who defeated it takes that ally into their hand" (Captured by Hydra, `trors` pack): docs/phase7-wave2.md §3.10. */
export const takeIntoHand = (from: CardSelector, player: PlayerRef = you): EffectSpec => ({
  kind: "takeIntoHand",
  cards: from,
  player,
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
  opts: { readonly filter?: TargetQuery; readonly optional?: boolean } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player,
  costReduction: amount(n),
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
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
export const shuffleMainSchemeStages = (fromStageIndex: number): EffectSpec => ({
  kind: "shuffleMainSchemeStages",
  fromStageIndex,
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
export const endGame = (result: "win" | "loss", reason?: "mainSchemeCompleted" | "allPlayersDefeated"): EffectSpec => ({
  kind: "endGame",
  result,
  ...(reason ? { reason } : {}),
});
/** "Add [villain] to the game area" (docs/phase7-wave2.md §3.4). */
export const addVillain = (
  villain: TargetRef,
  opts: { readonly reveal?: boolean; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "addVillain",
  villain,
  ...(opts.reveal ? { reveal: true } : {}),
  ...(opts.bind ? { bind: opts.bind } : {}),
});
/**
 * "Set this villain aside." (the Sinister Six's When Defeated, MC27 p. 15): back to the set-aside area as a new copy,
 * where `addVillain` can bring it back. docs/phase7-wave5.md §3.1.
 */
export const setVillainAside = (villain: TargetRef): EffectSpec => ({ kind: "setVillainAside", villain });
/** "Move the active counter to the next villain in the activation order." (MC27 p. 15; docs/phase7-wave5.md §3.1) */
export const moveActiveCounterToNextVillain: EffectSpec = { kind: "moveActiveCounter", to: "nextInActivationOrder" };
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
/** "Change Apocalypse to [Giant] form" — a three-sided villain's face change, resolved as a flip. */
export const changeVillainForm = (villain: TargetRef, toFaceWithTrait: Trait): EffectSpec => ({
  kind: "changeVillainForm",
  villain,
  toFaceWithTrait,
});
/** "Flip [card]" (RRG 1.8 "Flip"). */
export const flipCard = (target: TargetRef): EffectSpec => ({ kind: "flipCard", target });
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
