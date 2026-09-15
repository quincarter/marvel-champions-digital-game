import { trait, type Trait } from "@mc/content";
import type {
  Form,
  PlayerRef,
  Predicate,
  StatName,
  StatusName,
  TargetCategory,
  TargetQuery,
  TargetRef,
  TypedResource,
  ValueSpec,
} from "@mc/engine";

/**
 * Refs, queries, values and predicates — the nouns of the ability DSL. Each
 * helper returns plain engine data (`TargetRef`, `ValueSpec`, …) so a compiled
 * ability is inspectable JSON. Names follow the printed wording: "you",
 * "your hero", "the villain", "an enemy", "each friendly character".
 */

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/** "You": the ability's controller; on encounter cards, the revealing/attacked/engaged player. */
export const you: PlayerRef = { kind: "controller" };
export const firstPlayer: PlayerRef = { kind: "firstPlayer" };
export const eachPlayer: PlayerRef = { kind: "each" };
/** "That player" inside `forEachPlayer`. */
export const thatPlayer: PlayerRef = { kind: "scoped" };
/** The player picked by `choosePlayer(slot)`. */
export const chosenPlayer = (slot = "player"): PlayerRef => ({ kind: "slot", slot });
/** "Each other hero": every player except these. */
export const otherPlayers = (of: PlayerRef = you): PlayerRef => ({ kind: "others", of });
/** "The engaged player" of a minion. */
export const engagedPlayerOf = (of: TargetRef): PlayerRef => ({ kind: "engagedWith", of });
export const ownerOf = (target: TargetRef): PlayerRef => ({ kind: "ownerOf", target });

// ---------------------------------------------------------------------------
// Cards in play
// ---------------------------------------------------------------------------

/** "This card" / the card's own name ("discard Charge", "heal 1 damage from her"). */
export const self: TargetRef = { kind: "self" };
/** "Attached minion/enemy/ally". */
export const host: TargetRef = { kind: "host" };
export const theVillain: TargetRef = { kind: "villain" };
export const theMainScheme: TargetRef = { kind: "mainScheme" };
/** A player's identity, in whichever form it is ("you take 2 damage", "your hero", "Peter Parker"). */
export const identityOf = (player: PlayerRef = you): TargetRef => ({ kind: "identityOf", player });
export const yourIdentity: TargetRef = identityOf(you);
/** The card(s) bound to a slot by an earlier choice. */
export const chosen = (slot: string): TargetRef => ({ kind: "slot", slot });
/** The card that caused the triggering event ("that enemy" after it attacks). */
export const eventSource: TargetRef = { kind: "eventSource" };
/** The card the triggering event happened to ("that minion", "the attacked enemy"). */
export const eventTarget: TargetRef = { kind: "eventTarget" };
/** "Each enemy", "each hero", "each side scheme". */
export const each = (q: TargetQuery): TargetRef => ({ kind: "each", query: q });
/** The card in play with this exact printed name. */
export const named = (name: string): TargetRef => ({ kind: "named", name });

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const query = (
  categories: TargetCategory | readonly TargetCategory[],
  rest: Omit<TargetQuery, "categories"> = {},
): TargetQuery => ({ categories: typeof categories === "string" ? [categories] : categories, ...rest });

/** "Friendly character": any identity or ally (every player's, RRG "Friendly"). */
export const FRIENDLY_CHARACTER: TargetQuery = query(["identity", "ally"]);
/** "Your hero": your identity while it is in hero form. */
export const YOUR_HERO: TargetQuery = query("hero", { controller: "you" });
/** "You" as a card: your identity in either form. */
export const YOUR_IDENTITY: TargetQuery = query("identity", { controller: "you" });

// ---------------------------------------------------------------------------
// Traits used by Core cards (the content schema upper-cases traits)
// ---------------------------------------------------------------------------

export const TRAIT = {
  AERIAL: trait("Aerial"),
  TECH: trait("Tech"),
  DRONE: trait("Drone"),
  HYDRA: trait("Hydra"),
  BLACK_PANTHER: trait("Black Panther"),
  MASTERS_OF_EVIL: trait("Masters of Evil"),
} as const satisfies Record<string, Trait>;

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export type Amount = number | ValueSpec;
export const amount = (value: Amount): ValueSpec => (typeof value === "number" ? { kind: "const", value } : value);

/** "N [per_hero]" (plus an optional flat base). */
export const perHero = (perPlayer: number, base = 0): ValueSpec => ({ kind: "perPlayer", base, perPlayer });
/** A number bound by a cost or an earlier effect (`paid.energy`, `<bind>.amount`, `self.counters.energy`, …). */
export const varOf = (name: string): ValueSpec => ({ kind: "var", name });
export const statOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat });
export const countOf = (q: TargetQuery): ValueSpec => ({ kind: "count", query: q });
/**
 * How many of a bound-slot's cards match a query, wherever they are (unlike `countOf`, not restricted to in play):
 * "for each treachery looked at this way" (Falcon: `countAmong(chosen("looked"), query("treachery"))`).
 */
export const countAmong = (cardsRef: TargetRef, q: TargetQuery): ValueSpec => ({ kind: "countInRef", cards: cardsRef, query: q });
export const damageOn = (of: TargetRef): ValueSpec => ({ kind: "damage", of });
export const threatOn = (of: TargetRef): ValueSpec => ({ kind: "threat", of });
export const boostIconsOn = (of: TargetRef): ValueSpec => ({ kind: "boostIcons", of });
export const remainingHpOf = (of: TargetRef): ValueSpec => ({ kind: "remainingHp", of });
export const countersOn = (of: TargetRef, counterType: string): ValueSpec => ({ kind: "counters", of, counterType });
/** "For each different resource type discarded this way" (wild counts as its own type). */
export const resourceTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "resourceTypes", cards: cardsRef });
/** "That damage" / "it" in an interrupt: the triggering event's amount. */
export const eventAmount: ValueSpec = { kind: "eventAmount" };
export const eventResult = (key: string): ValueSpec => ({ kind: "eventResult", key });
export const handSizeOf = (player: PlayerRef = you, printed = false): ValueSpec =>
  printed ? { kind: "handSize", player, printed } : { kind: "handSize", player };
/** "The cards in your hand" as a count (distinct from `handSizeOf`, the max-hand-size *stat*): "half of the cards in your hand, rounded down" (Man Out of Time). */
export const handCountOf = (player: PlayerRef = you): ValueSpec => ({ kind: "handCount", player });

/**
 * Arithmetic: "2 damage for each counter (to a maximum of 10)" → `scaled(counters, { times: 2, max: 10 })`;
 * "half of the cards in your hand, rounded down" (Man Out of Time) → `scaled(handCountOf(you), { divide: { by: 2,
 * round: "down" } })`. `divide` applies first. Its `round` is required: RRG 1.8 "Modifiers" (p. 29) rounds fractions
 * up unless the card says otherwise.
 */
export const scaled = (
  value: Amount,
  by: {
    readonly divide?: { readonly by: number; readonly round: "down" | "up" };
    readonly times?: number;
    readonly plus?: number;
    readonly max?: number;
  },
): ValueSpec => ({
  kind: "scaled",
  value: amount(value),
  ...(by.divide !== undefined ? { divide: { by: by.divide.by, round: by.divide.round } } : {}),
  ...(by.times !== undefined ? { times: by.times } : {}),
  ...(by.plus !== undefined ? { plus: by.plus } : {}),
  ...(by.max !== undefined ? { max: by.max } : {}),
});
/** "N (M instead if …)". */
export const ifElse = (condition: Predicate, then: Amount, otherwise: Amount): ValueSpec => ({
  kind: "conditional",
  if: condition,
  then: amount(then),
  else: amount(otherwise),
});

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export const inForm = (form: Form, player: PlayerRef = you): Predicate => ({ kind: "form", player, form });
export const isHero = (player: PlayerRef = you): Predicate => inForm("hero", player);
export const isAlterEgo = (player: PlayerRef = you): Predicate => inForm("alterEgo", player);
export const exists = (q: TargetQuery): Predicate => ({ kind: "exists", query: q });
/** "If Bomb Scare is in play" (exact printed name). */
export const inPlay = (name: string): Predicate => exists({ name });
export const not = (of: Predicate): Predicate => ({ kind: "not", of });
export const allOf = (...of: Predicate[]): Predicate => ({ kind: "and", of });
export const anyOf = (...of: Predicate[]): Predicate => ({ kind: "or", of });
/** "If you paid for this card using a [X] resource". */
export const paidWith = (resource: TypedResource): Predicate => ({ kind: "paidWith", resource });
export const varAtLeast = (name: string, n = 1): Predicate => ({ kind: "varAtLeast", name, amount: n });
/** An event-producing effect with `bind` happened ("if no attacks were made this way" = `not(made(b))`). */
export const made = (bind: string): Predicate => varAtLeast(`${bind}.made`, 1);
export const hasStatus = (of: TargetRef, status: StatusName): Predicate => ({ kind: "hasStatus", of, status });
export const hasTrait = (of: TargetRef, t: Trait): Predicate => ({ kind: "hasTrait", of, trait: t });
/** "If you have the Aerial trait". */
export const youHaveTrait = (t: Trait): Predicate => hasTrait(yourIdentity, t);
/** The ref names a card that is in play and matches the query. */
export const refMatches = (ref: TargetRef, q: TargetQuery): Predicate => ({ kind: "refMatches", ref, query: q });
export const damagedAtLeast = (of: TargetRef, n: number): Predicate => ({ kind: "damagedAtLeast", of, amount: n });
/** A result of the triggering event ("if this attack dealt damage" → `eventDealt("damage")`). */
export const eventDealt = (key: string, n = 1): Predicate => ({ kind: "eventResultAtLeast", key, amount: n });
/** "If the villain is making an undefended attack". */
export const undefendedAttack: Predicate = { kind: "currentAttack", key: "undefended", atLeast: 1 };
/** "If this is the final step of this sequence" (Wakanda Forever!). */
export const finalStep: Predicate = varAtLeast("sequence.final", 1);
/** "During step one of the villain phase". */
export const duringVillainPhaseStepOne: Predicate = { kind: "gameStep", phase: "villain", step: "placeThreat" };
/**
 * "The first [card type] played each round" (Steve Rogers, Living Legend: "Reduce the cost of the first ally
 * played each round by 1"). FAQ "Steve Rogers (#1B)" (RRG 1.8 p. 59): applies to the very first ally that player
 * plays each round, whatever form they're in when it's played — so this reads the round count, not the phase's.
 */
export const firstThisRound = (cardType: string, player: PlayerRef = you): Predicate => ({ kind: "playedThisRound", player, cardType, atMost: 0 });
