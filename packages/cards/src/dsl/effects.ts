import type {
  CardDestination,
  CardSelector,
  EffectSpec,
  FacedownRole,
  LastingUntil,
  PlayerRef,
  PlayerZone,
  Predicate,
  ResourceRequirement,
  StatName,
  StatusName,
  TargetQuery,
  TargetRef,
} from "@mc/engine";
import type { Trait } from "@mc/content";
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

export const draw = (n: Amount = 1, player: PlayerRef = you): EffectSpec => ({ kind: "draw", player, amount: amount(n) });
export const drawUpTo = (n: Amount, player: PlayerRef = you): EffectSpec => ({ kind: "drawUpTo", player, amount: amount(n) });
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
/** "Remove N threat" — not a thwart (unless the ability is labeled; then use `thwart`). */
export const removeThreat = (n: Amount, target: TargetRef, opts: { readonly bind?: string } = {}): EffectSpec => ({
  kind: "removeThreat",
  target,
  amount: amount(n),
  ...withBind(opts.bind),
});
export const placeDamage = (n: Amount, target: TargetRef): EffectSpec => ({ kind: "placeDamage", target, amount: amount(n) });
/**
 * "Set his hit point dial to N instead" (Captain America's Helmet, `cap` pack): sets the remaining-hit-points dial
 * directly. Not a heal — the card doesn't say "heal" — so it fires no heal event (docs/phase7-wave1.md §3.13).
 */
export const setRemainingHitPoints = (n: Amount, target: TargetRef): EffectSpec => ({ kind: "setRemainingHitPoints", target, amount: amount(n) });

/** The "(attack)" body: resolves as an attack by your identity (guard, retaliate, "after X attacks" apply). */
export const attack = (
  n: Amount,
  target: TargetRef,
  opts: { readonly overkill?: boolean; readonly attacker?: TargetRef; readonly moveDamageFrom?: TargetRef; readonly bind?: string } = {},
): EffectSpec => ({
  kind: "attack",
  target,
  amount: amount(n),
  ...(opts.overkill ? { overkill: true } : {}),
  ...(opts.attacker ? { attacker: opts.attacker } : {}),
  ...(opts.moveDamageFrom ? { moveDamageFrom: opts.moveDamageFrom } : {}),
  ...withBind(opts.bind),
});
/** The "(thwart)" body: resolves as a thwart by your identity (confused and crisis apply). */
export const thwart = (n: Amount, target: TargetRef, opts: { readonly thwarter?: TargetRef; readonly bind?: string } = {}): EffectSpec => ({
  kind: "thwart",
  target,
  amount: amount(n),
  ...(opts.thwarter ? { thwarter: opts.thwarter } : {}),
  ...withBind(opts.bind),
});

// ---------------------------------------------------------------------------
// Statuses, exhaust, counters, discard
// ---------------------------------------------------------------------------

export const giveStatus = (target: TargetRef, status: StatusName): EffectSpec => ({ kind: "giveStatus", target, status });
export const stun = (target: TargetRef): EffectSpec => giveStatus(target, "stunned");
export const confuse = (target: TargetRef): EffectSpec => giveStatus(target, "confused");
/** "Give X a tough status card". */
export const giveTough = (target: TargetRef): EffectSpec => giveStatus(target, "tough");
/**
 * "Remove a [status] card from X" / the removal half of "replace that status card with a different status card"
 * (Vapors of Valtorr, `drs` pack). One card of that type; a character with none is unaffected.
 */
export const removeStatus = (target: TargetRef, status: StatusName): EffectSpec => ({ kind: "removeStatus", target, status });
export const exhaust = (target: TargetRef): EffectSpec => ({ kind: "exhaust", target });
export const ready = (target: TargetRef): EffectSpec => ({ kind: "ready", target });
/** "Discard X" for a card in play. */
export const discard = (target: TargetRef): EffectSpec => ({ kind: "discardFromPlay", target });
export const addCounters = (counterType: string, n: Amount, target: TargetRef = self): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: amount(n),
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
export const chooseOneBy = (chooser: PlayerRef, ...options: readonly ChoiceOption[]): EffectSpec => ({ kind: "chooseOne", chooser, options });
/** "Choose a player." Refer to them with `chosenPlayer(slot)`. */
export const choosePlayer = (slot = "player", chooser: PlayerRef = you): EffectSpec => ({ kind: "choosePlayer", slot, chooser });
/** "Each player …": the effects run once per player with `thatPlayer`. */
export const forEachPlayer = (players: PlayerRef, ...effects: readonly EffectArg[]): EffectSpec => ({ kind: "forEachPlayer", players, effects: flatten(effects) });
export const chooseTarget = (
  slot: string,
  q: TargetQuery,
  opts: { readonly chooser?: PlayerRef; readonly optional?: boolean; readonly count?: Amount } = {},
): EffectSpec => ({
  kind: "chooseTarget",
  slot,
  query: q,
  chooser: opts.chooser ?? you,
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
  opts: { readonly against?: PlayerRef; readonly bind?: string; readonly additionalResolution?: boolean; readonly atkBonus?: Amount } = {},
): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
  ...(opts.additionalResolution ? { additionalResolution: true } : {}),
  ...(opts.atkBonus !== undefined ? { atkBonus: amount(opts.atkBonus) } : {}),
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
export const modifyAttack = (change: { readonly overkill?: boolean; readonly extraBoostCards?: number; readonly atkBonus?: Amount; readonly threatBonus?: Amount }): EffectSpec => ({
  kind: "modifyAttack",
  ...(change.overkill ? { overkill: true } : {}),
  ...(change.extraBoostCards !== undefined ? { extraBoostCards: change.extraBoostCards } : {}),
  ...(change.atkBonus !== undefined ? { atkBonus: amount(change.atkBonus) } : {}),
  ...(change.threatBonus !== undefined ? { threatBonus: amount(change.threatBonus) } : {}),
});
export const atEndOfAttack = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "atEndOfAttack", effects: flatten(effects) });
export const atEndOfRound = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "atEndOfRound", effects: flatten(effects) });
/** "Prevent N of that damage" (absent = all of it). */
export const preventDamage = (n?: Amount): EffectSpec => (n === undefined ? { kind: "preventDamage" } : { kind: "preventDamage", amount: amount(n) });
export const preventThreat = (n?: Amount): EffectSpec => (n === undefined ? { kind: "preventThreat" } : { kind: "preventThreat", amount: amount(n) });
/** "… instead": the interrupted event doesn't happen; these resolve in its place (RRG "Replacement Effect"). */
export const instead = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "replaceTriggeringEvent", with: flatten(effects) });
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
export const modifyStat = (stat: StatName | "hp" | "handSize", n: Amount, target: TargetRef, until: LastingUntil): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: amount(n),
  target,
  until,
});
/** "Each character that player controls gets +N [stat] until …" — a live query that also catches later arrivals. */
export const modifyStatOf = (stat: StatName | "hp" | "handSize", n: Amount, affects: TargetQuery, until: LastingUntil): EffectSpec => ({
  kind: "modifyStatUntil",
  stat,
  amount: amount(n),
  affects,
  until,
});
export const gainTraitUntil = (t: Trait, target: TargetRef, until: LastingUntil): EffectSpec => ({ kind: "grantTraitUntil", trait: t, target, until });
/**
 * "Reduce the cost of the next card that player plays this phase/round by N." `cardFilter` narrows which played
 * card consumes it — "the next Avenger ally played this phase" (Avengers Tower, `cap` pack): `{ trait: AVENGER,
 * categories: ["ally"] }`. Omit for the unfiltered "next card" (Helicarrier).
 */
export const reduceNextCardCost = (player: PlayerRef, n: Amount, duration: NextCardCostDuration, cardFilter?: TargetQuery): EffectSpec => ({
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
export type NextCardCostDuration = "phase" | "round" | "untilPlayed";
/**
 * "The next [card] you play costs N additional resources" (Physical Toll, `drs` pack) — the mirror of
 * `reduceNextCardCost`, which the engine stores as the same signed lasting effect. The price is floored at 0.
 */
export const increaseNextCardCost = (player: PlayerRef, n: number, duration: NextCardCostDuration, cardFilter?: TargetQuery): EffectSpec => ({
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
export const afterNextCardPlayed = (player: PlayerRef, cardFilter: TargetQuery | undefined, ...effects: readonly EffectSpec[]): EffectSpec => ({
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
  opts: { readonly filter?: TargetQuery; readonly top?: Amount; readonly topmostOnly?: boolean; readonly random?: Amount } = {},
): CardSelector => ({
  kind: "zone",
  zone: z,
  player,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.top !== undefined ? { top: amount(opts.top) } : {}),
  ...(opts.topmostOnly ? { topmostOnly: true } : {}),
  ...(opts.random !== undefined ? { random: amount(opts.random) } : {}),
});
/** "The top N cards of your deck". */
export const topOfDeck = (n: Amount, player: PlayerRef = you): CardSelector => zone("deck", player, { top: n });
export const cards = (ref: TargetRef, filter?: TargetQuery): CardSelector => ({ kind: "ref", ref, ...(filter ? { filter } : {}) });
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
export const encounterSetAside = (filter?: TargetQuery): CardSelector => ({ kind: "encounterSetAside", ...(filter ? { filter } : {}) });
/** "Place the active counter on Wrecker" / "Move the active counter to …" (The Wrecking Crew insert). */
export const setActiveVillain = (villain: TargetRef): EffectSpec => ({ kind: "setActiveVillain", villain });
export const setAside = (player: PlayerRef = you, filter?: TargetQuery): CardSelector => ({ kind: "setAside", player, ...(filter ? { filter } : {}) });
export const tuckedUnder = (under: TargetRef): CardSelector => ({ kind: "tucked", under });

export const moveCards = (from: CardSelector, to: CardDestination, bind?: string): EffectSpec => ({ kind: "moveCards", cards: from, to, ...withBind(bind) });
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
export const changeForm = (player: PlayerRef = you, to?: "hero" | "alterEgo"): EffectSpec => ({ kind: "changeForm", player, ...(to ? { to } : {}) });
export const resolveSpecials = (cardsQuery: TargetQuery): EffectSpec => ({ kind: "resolveSpecials", cards: cardsQuery });
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
/** "Discard 1 card at random from your hand". */
export const discardAtRandom = (n: Amount = 1, player: PlayerRef = you): EffectSpec => discardFromHand(n, player, { random: true });
export const putIntoPlay = (card: TargetRef, controller: PlayerRef = you): EffectSpec => ({ kind: "putIntoPlay", card, controller });
/** "Put the top card of your deck into play facedown, engaged with you as a [Drone] minion." */
export const putIntoPlayFacedown = (player: PlayerRef, as: FacedownRole, count?: Amount): EffectSpec => ({
  kind: "putIntoPlayFacedown",
  player,
  as,
  ...(count !== undefined ? { count: amount(count) } : {}),
});
export const AS_DRONE: FacedownRole = { kind: "minion", traits: [TRAIT.DRONE] };
/** "… puts the top card of their deck into play facedown, engaged with them as a Drone minion." */
export const droneFromDeck = (player: PlayerRef = you, count?: Amount): EffectSpec => putIntoPlayFacedown(player, AS_DRONE, count);

// ---------------------------------------------------------------------------
// Encounter deck and scenario flow
// ---------------------------------------------------------------------------

export const selectCards = (slot: string, from: CardSelector): EffectSpec => ({ kind: "selectCards", slot, cards: from });
export const revealCard = (target: TargetRef, player: PlayerRef = you): EffectSpec => ({ kind: "revealCard", cards: target, player });
export const shuffleEncounterDeck = (): EffectSpec => ({ kind: "shuffleEncounterDeck" });
export const discardEncounterUntil = (filter: TargetQuery, bind: string): EffectSpec => ({ kind: "discardEncounterUntil", filter, bind });
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
export const assignDamage = (n: Amount, among: TargetQuery, chooser: PlayerRef = you): EffectSpec => ({ kind: "assignDamage", amount: amount(n), among, chooser });
export const dealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "dealEncounterCard", player });
export const revealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "revealEncounterCard", player });
/**
 * "Give the villain 1 facedown boost card" (Hired Gun 02007, Intimidation 02035): dealt outside an activation, it
 * stays facedown on that enemy and is flipped at its next activation, before and in addition to the automatic one
 * (RRG 1.8 "Boost, Boost Icon", p. 11). Not "1 additional boost card **for this activation**" — that is
 * `modifyAttack({ extraBoostCards })`, and the validator rejects this builder inside a Boost ability.
 */
export const giveBoostCard = (enemy: TargetRef = theVillain, count: Amount = 1): EffectSpec =>
  count === 1 ? { kind: "giveBoostCard", enemy } : { kind: "giveBoostCard", enemy, count: amount(count) };
export const addAccelerationToken = (): EffectSpec => ({ kind: "addAccelerationToken" });
/** "Either spend … resources or …": follow with `ifThen(not(made(bind)), …)`. */
export const spendResources = (resources: ResourceRequirement, bind: string, player: PlayerRef = you): EffectSpec => ({
  kind: "spendResources",
  player,
  resources,
  bind,
});

/**
 * "Search the encounter deck (and discard pile) for X and reveal it. Shuffle
 * the encounter deck." — X by exact printed name.
 */
export const searchAndReveal = (name: string, zones: readonly ("deck" | "discard")[] = ["deck", "discard"], player: PlayerRef = you): EffectSpec[] => [
  selectCards("found", encounterCards(zones, { name })),
  revealCard(chosen("found"), player),
  shuffleEncounterDeck(),
];

// ---------------------------------------------------------------------------
// Targeting sugar for the most common printed phrases
// ---------------------------------------------------------------------------

/** "An enemy" (any enemy; for non-attack damage, statuses). */
export const anEnemy = (slot = "enemy", extra: Omit<TargetQuery, "categories"> = {}): EffectSpec => chooseTarget(slot, query("enemy", extra));
/** "An enemy" your identity may attack right now (RRG "Guard"). */
export const anAttackableEnemy = (slot = "enemy", categories: "enemy" | "minion" = "enemy"): EffectSpec =>
  chooseTarget(slot, query(categories, { attackableBy: yourIdentity }));
export const aScheme = (slot = "scheme", extra: Omit<TargetQuery, "categories"> = {}): EffectSpec => chooseTarget(slot, query("scheme", extra));

/** "(attack): Deal N damage to an enemy." */
export const attackAnEnemy = (n: Amount, opts: { readonly slot?: string; readonly overkill?: boolean; readonly moveDamageFrom?: TargetRef } = {}): EffectSpec[] => {
  const slot = opts.slot ?? "enemy";
  return [
    anAttackableEnemy(slot),
    attack(n, chosen(slot), { ...(opts.overkill ? { overkill: true } : {}), ...(opts.moveDamageFrom ? { moveDamageFrom: opts.moveDamageFrom } : {}) }),
  ];
};
/** "(thwart): Remove N threat from a scheme." */
export const thwartAScheme = (n: Amount, slot = "scheme"): EffectSpec[] => [aScheme(slot), thwart(n, chosen(slot))];
/** "Deal N damage to an enemy." (not an attack) */
export const damageAnEnemy = (n: Amount, slot = "enemy"): EffectSpec[] => [anEnemy(slot), dealDamage(n, chosen(slot))];
/** "Remove N threat from a scheme." (not a thwart) */
export const removeThreatFromAScheme = (n: Amount, slot = "scheme"): EffectSpec[] => [aScheme(slot), removeThreat(n, chosen(slot))];

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
  opts: { readonly chooser?: PlayerRef; readonly bind?: string } = {},
): EffectSpec => ({ kind: "divide", what, amount: amount(n), among, chooser: opts.chooser ?? you, ...withBind(opts.bind) });

/**
 * "Choose two of the following (you may choose the same option twice)" (Double Time, `qsv`/`scw`): the plural form
 * of `chooseOne`, resolving `count` options in the order chosen. `allowRepeat` permits choosing the same option
 * more than once (RRG 1.8 "Choose (Option)", p. 12, forbids it otherwise).
 */
export const chooseOptions = (count: number, opts: readonly ChoiceOption[], config: { readonly chooser?: PlayerRef; readonly allowRepeat?: boolean } = {}): EffectSpec => ({
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
  opts: { readonly bind?: string; readonly forEachDiscarded?: { readonly slot: string; readonly effects: readonly EffectArg[] } } = {},
): EffectSpec => ({
  kind: "discardEncounterCards",
  count: amount(n),
  ...withBind(opts.bind),
  ...(opts.forEachDiscarded ? { forEachDiscarded: { slot: opts.forEachDiscarded.slot, effects: flatten(opts.forEachDiscarded.effects) } } : {}),
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
export const takeIntoHand = (from: CardSelector, player: PlayerRef = you): EffectSpec => ({ kind: "takeIntoHand", cards: from, player });

/** "Play a card from your hand, ignoring its resource cost." (Chaos Magic, `qsv` pack): docs/phase7-wave2.md §3.8. */
export const playFromHandIgnoringCost = (player: PlayerRef = you, opts: { readonly filter?: TargetQuery; readonly optional?: boolean } = {}): EffectSpec => ({
  kind: "playFromHand",
  player,
  ignoreCost: true,
  ...(opts.filter ? { filter: opts.filter } : {}),
  ...(opts.optional ? { optional: true } : {}),
});

/** "Advance the main scheme to stage N" (docs/phase7-wave2.md §1.6/§3.4). */
export const advanceMainScheme = (opts: { readonly to?: { readonly stageNumber: number; readonly name?: string }; readonly scheme?: TargetRef } = {}): EffectSpec => ({
  kind: "advanceMainScheme",
  ...(opts.to ? { to: opts.to } : {}),
  ...(opts.scheme ? { scheme: opts.scheme } : {}),
});
/** "If all the players at this stage are defeated, this stage is complete." (Kang's stage 3 cards). */
export const completeMainScheme = (scheme: TargetRef = theMainScheme): EffectSpec => ({ kind: "completeMainScheme", scheme });
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
export const revealMainSchemeStage = (player: PlayerRef, stageNumber: number, opts: { readonly removeUnused?: boolean } = {}): EffectSpec => ({
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
export const atEndOfPhase = (...effects: readonly EffectArg[]): EffectSpec => ({ kind: "atEndOfPhase", effects: flatten(effects) });
/** "Change Apocalypse to [Giant] form" — a three-sided villain's face change, resolved as a flip. */
export const changeVillainForm = (villain: TargetRef, toFaceWithTrait: Trait): EffectSpec => ({ kind: "changeVillainForm", villain, toFaceWithTrait });
/** "Flip [card]" (RRG 1.8 "Flip"). */
export const flipCard = (target: TargetRef): EffectSpec => ({ kind: "flipCard", target });

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
export const reorderCards = (from: CardSelector, chooser: PlayerRef = you): EffectSpec => ({ kind: "reorderCards", cards: from, chooser, to: "encounterDeckTop" });
/**
 * "Deal N indirect damage to each player" / "…to you" (RRG 1.8 "Indirect Damage"): each player divides it among the
 * characters they control. `to: "group"` has the first player divide it among every friendly character.
 */
export const dealIndirectDamage = (to: PlayerRef | "group", n: Amount, opts: { readonly bind?: string } = {}): EffectSpec => ({
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
export const moveThreat = (from: TargetRef, to: TargetRef, opts: { readonly amount?: Amount; readonly bind?: string } = {}): EffectSpec => ({
  kind: "moveThreat",
  from,
  to,
  ...(opts.amount !== undefined ? { amount: amount(opts.amount) } : {}),
  ...withBind(opts.bind),
});
