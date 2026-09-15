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

export const enemyAttack = (
  enemies: TargetRef,
  opts: { readonly against?: PlayerRef; readonly bind?: string; readonly additionalResolution?: boolean } = {},
): EffectSpec => ({
  kind: "enemyAttack",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
  ...(opts.additionalResolution ? { additionalResolution: true } : {}),
});
export const enemyScheme = (enemies: TargetRef, opts: { readonly against?: PlayerRef; readonly bind?: string } = {}): EffectSpec => ({
  kind: "enemyScheme",
  enemies,
  ...(opts.against ? { against: opts.against } : {}),
  ...withBind(opts.bind),
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
export const reduceNextCardCost = (player: PlayerRef, n: Amount, duration: "phase" | "round", cardFilter?: TargetQuery): EffectSpec => ({
  kind: "reduceNextCardCost",
  player,
  amount: amount(n),
  duration,
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
export const discardFromHand = (n: Amount, player: PlayerRef = you, opts: { readonly random?: boolean } = {}): EffectSpec => ({
  kind: "discardFromHand",
  player,
  amount: amount(n),
  ...(opts.random ? { random: true } : {}),
});
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
export const tuckCards = (from: CardSelector, under: TargetRef, facedown = false): EffectSpec => ({
  kind: "tuckCards",
  cards: from,
  under,
  ...(facedown ? { facedown: true } : {}),
});
export const assignDamage = (n: Amount, among: TargetQuery, chooser: PlayerRef = you): EffectSpec => ({ kind: "assignDamage", amount: amount(n), among, chooser });
export const dealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "dealEncounterCard", player });
export const revealEncounterCard = (player: PlayerRef = you): EffectSpec => ({ kind: "revealEncounterCard", player });
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
