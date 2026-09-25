import type {
  CampaignLogValueSpec,
  CardDestination,
  CardSelector,
  EventPattern,
  EffectSpec,
  FacedownRole,
  LastingUntil,
  LogWriteMode,
  PlayerRef,
  PlayerZone,
  Predicate,
  ResourceRequirement,
  RuleSpec,
  StatName,
  StatusName,
  TargetQuery,
  TargetRef,
} from "@mc/engine";
import type { KeywordInstance, Trait } from "@mc/content";
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
/** "You take N damage" / "Take N damage": your identity takes it. */
export const takeDamage = (n: Amount, player: PlayerRef = you): EffectSpec => dealDamage(n, identityOf(player));
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
 * "Remove a [status] card from X" / the removal half of "replace that status card with a different status card"
 * (Vapors of Valtorr, `drs` pack). One card of that type; a character with none is unaffected.
 */
export const removeStatus = (target: TargetRef, status: StatusName): EffectSpec => ({
  kind: "removeStatus",
  target,
  status,
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
});
/** "The villain schemes" / "Green Goblin schemes with +X SCH" — `enemyAttack`'s `atkBonus`, for a scheme activation. */
export const enemyScheme = (
  enemies: TargetRef,
  opts: { readonly against?: PlayerRef; readonly bind?: string; readonly schBonus?: Amount } = {},
): EffectSpec => ({
  kind: "enemyScheme",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
  ...(opts.schBonus !== undefined ? { schBonus: amount(opts.schBonus) } : {}),
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
  readonly threatBonus?: Amount;
  readonly keywords?: readonly AttackKeyword[];
  /**
   * "Prevent all damage from this attack" (Mockingbird 04004), set from an interrupt at attack *initiation* — before
   * a defender is declared, so `preventDamage()` (which adjusts an already-pushed `dealDamage` frame) can't express
   * it. The flag rides the activation's own event frame through `declareDefender` and the eventual damage step
   * (RRG 1.8 "Prevent", p. 34): the damage is still dealt (for "the attacking character dealt damage" purposes,
   * excess measured), but the target takes none, so no tough card is used.
   */
  readonly preventAllDamage?: boolean;
  /** "Use its ATK instead of its DEF for this attack" (The Best Defense…, 25020; docs/phase7-wave4.md §3.22). */
  readonly defenseUsesAtk?: boolean;
}): EffectSpec => ({
  kind: "modifyAttack",
  ...(change.overkill ? { overkill: true } : {}),
  ...(change.extraBoostCards !== undefined ? { extraBoostCards: amount(change.extraBoostCards) } : {}),
  ...(change.atkBonus !== undefined ? { atkBonus: amount(change.atkBonus) } : {}),
  ...(change.threatBonus !== undefined ? { threatBonus: amount(change.threatBonus) } : {}),
  ...(change.keywords && change.keywords.length > 0 ? { keywords: change.keywords } : {}),
  ...(change.preventAllDamage ? { preventAllDamage: true } : {}),
  ...(change.defenseUsesAtk ? { defenseUsesAtk: true } : {}),
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

/** "Until …, X gets +N [stat]" on fixed targets. */
export const modifyStat = (
  stat: StatName | "hp" | "handSize",
  n: Amount,
  target: TargetRef,
  until: LastingUntil,
): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: amount(n),
  target,
  until,
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
 */
export const applyRuleUntil = (
  rule: RuleSpec,
  until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn",
  player?: PlayerRef,
): EffectSpec => ({
  kind: "applyRuleUntil",
  rule,
  until,
  ...(player ? { player } : {}),
});
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
 * the card text does ("Reveal the top card of *his* deck"; docs/phase7-wave1.md §4.2, open).
 */
export const encounterCards = (
  zones: readonly ("deck" | "discard")[],
  filter?: TargetQuery,
  top?: Amount,
  deckOf?: TargetRef,
): CardSelector => ({
  kind: "encounter",
  zones,
  ...(filter ? { filter } : {}),
  ...(top !== undefined ? { top: amount(top) } : {}),
  ...(deckOf ? { deckOf } : {}),
});
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
/** "Resolve the 'Special' ability of [ref]"; `player`: "[that player] must resolve …" (docs/phase7-wave4.md §3.46). */
export const resolveSpecialsOf = (ref: TargetRef, player?: PlayerRef): EffectSpec => ({
  kind: "resolveSpecials",
  of: ref,
  ...(player ? { player } : {}),
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
export const revealCard = (target: TargetRef, player: PlayerRef = you): EffectSpec => ({
  kind: "revealCard",
  cards: target,
  player,
});
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
 */
export const giveBoostCard = (enemy: TargetRef = theVillain, count: Amount = 1): EffectSpec =>
  count === 1 ? { kind: "giveBoostCard", enemy } : { kind: "giveBoostCard", enemy, count: amount(count) };
/**
 * "Place 1 acceleration token here" (The Master of Time 2B) / "place one acceleration token on one of the main
 * schemes" (MC21 p. 13's campaign instructions, a multi-main-scheme scenario). `target` absent is the central main
 * scheme (`EffectSpec addAccelerationToken.target`, RRG 1.8 "Acceleration Token", p. 5).
 */
export const addAccelerationToken = (target?: TargetRef): EffectSpec => ({
  kind: "addAccelerationToken",
  ...(target ? { target } : {}),
});
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
 * schemes in play" (Inconspicuous): docs/phase7-wave2.md §3.7.
 */
export const divide = (
  what: "damage" | "threat",
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
  } = {},
): EffectSpec => ({
  kind: "divide",
  what,
  amount: amount(n),
  among,
  chooser: opts.chooser ?? you,
  ...withBind(opts.bind),
  ...(opts.upTo ? { upTo: true as const } : {}),
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
export const buildScenarioDeck = (name: string): EffectSpec => ({ kind: "buildScenarioDeck", name });
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

/** "Play a card from your hand, ignoring its resource cost." (Chaos Magic, `scw` pack): docs/phase7-wave2.md §3.8. */
export const playFromHandIgnoringCost = (
  player: PlayerRef = you,
  opts: { readonly filter?: TargetQuery; readonly optional?: boolean } = {},
): EffectSpec => ({
  kind: "playFromHand",
  player,
  ignoreCost: true,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
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
export const addVillain = (villain: TargetRef, opts: { readonly reveal?: boolean } = {}): EffectSpec => ({
  kind: "addVillain",
  villain,
  ...(opts.reveal ? { reveal: true } : {}),
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
 */
export const campaignLogCards = (
  field: string,
  opts: { readonly seat?: PlayerRef; readonly filter?: TargetQuery } = {},
): CardSelector => ({
  kind: "campaignLog",
  field,
  ...(opts.seat ? { seat: opts.seat } : {}),
  ...(opts.filter ? { filter: opts.filter } : {}),
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
