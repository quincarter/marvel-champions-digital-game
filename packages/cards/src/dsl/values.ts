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
/**
 * "They" in "After **a player** changes to hero form, they …" (Taskmaster I–III, 04093–04095): the player the
 * triggering event itself is about, paired with `on.playerChangesForm` (`dsl/abilities.ts`), which sets no
 * `playerIs` scope so the trigger isn't limited to "you".
 */
export const eventPlayer: PlayerRef = { kind: "eventPlayer" };
/**
 * "The player who defeated this scheme" (Crossbones' Assault 04070, Prison Camps 04141, Hydra Reinforcements
 * 04143): the defeating player recorded on the `schemeDefeated`/`characterDefeated` event a `whenDefeated` ability
 * is reacting to. Empty outside a defeat, and for a defeat no player caused.
 */
export const defeatingPlayer: PlayerRef = { kind: "defeatingPlayer" };
export const ownerOf = (target: TargetRef): PlayerRef => ({ kind: "ownerOf", target });

// ---------------------------------------------------------------------------
// Cards in play
// ---------------------------------------------------------------------------

/** "This card" / the card's own name ("discard Charge", "heal 1 damage from her"). */
export const self: TargetRef = { kind: "self" };
/** "Attached minion/enemy/ally". */
export const host: TargetRef = { kind: "host" };
export const theVillain: TargetRef = { kind: "villain" };
/**
 * "The defending character" of the enemy attack in progress (Energy Projectiles' boost, 07027), while it is in play.
 * Empty for an undefended attack or outside an enemy attack. Works in a Boost ability, which has no triggering event.
 */
export const defendingCharacter: TargetRef = { kind: "defendingCharacter" };
export const theMainScheme: TargetRef = { kind: "mainScheme" };
/**
 * The central main scheme stage, outside every separate game area (docs/phase7-wave2.md §3.1): "place 1 set-aside
 * Kang's Dominion facedown under stage 4A" while game areas are still split. Distinct from `theMainScheme`, which
 * resolves inside the *current* context's own area.
 */
export const centralMainScheme: TargetRef = { kind: "mainScheme", of: "central" };
/**
 * "Each face down [card] under this stage/card" (Kang's Wrath 4A, 11013a): the cards tucked under what `of` names,
 * still out of play (RRG 1.8 "Tuck", p. 45) — the `TargetRef` sibling of the `tuckedUnder` `CardSelector` (`dsl/
 * effects.ts`), needed anywhere a ref is required (`revealCard`'s `cards`, above all) rather than a selector.
 */
export const tuckedUnderRef = (of: TargetRef, filter?: TargetQuery): TargetRef => ({
  kind: "tuckedUnder",
  of,
  ...(filter ? { filter } : {}),
});
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
/**
 * "The X with the highest/lowest Y" (Mad Genius, Clash of the Titans, Time-Travel Hijinks' "the highest-cost card
 * you control"): each candidate in `among` is measured once, with itself bound to `slot` (default `"candidate"`) so
 * `measure` can read the candidate's own values. Ties resolve to every tied card by default (`ties: "all"`) since a
 * ref is resolved with nobody to ask; an effect that needs exactly one breaks the tie itself (`bindTargets` this,
 * then `chooseTarget({ inSlot })`). Several packs (`wave1/{gob,hlk,twc,bkw,drs}/local.ts`) carry an identical
 * per-pack copy of this builder predating its centralization here — not deduplicated by this change, since doing so
 * safely means touching every one of those packs' own files.
 */
export const superlative = (
  order: "highest" | "lowest",
  among: TargetRef,
  measure: ValueSpec,
  opts: { readonly ties?: "all" | "first"; readonly slot?: string } = {},
): TargetRef => ({ kind: "superlative", among, order, measure, ...opts });

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const query = (
  categories: TargetCategory | readonly TargetCategory[],
  rest: Omit<TargetQuery, "categories"> = {},
): TargetQuery => ({ categories: typeof categories === "string" ? [categories] : categories, ...rest });

/**
 * "… that shares a trait with your hero" (Team-Building Exercise, `ant` 12024): `query(categories, sharesTraitWith(
 * identityOf(you)))`. Both sides are read live through `traitsOf` — a granted trait counts on either end (RRG 1.8
 * "Gains", p. 21) — and a ref naming nothing, or naming only trait-less cards, matches nothing (there is no trait
 * to share). docs/phase7-wave2.md §20.1.
 */
export const sharesTraitWith = (ref: TargetRef): Pick<TargetQuery, "sharesTraitWith"> => ({ sharesTraitWith: ref });
/**
 * "… a card from the [X] Nemesis set" (Yellowjacket's Plan, `ant` 12029): `query(categories, encounterSetOf(self))`
 * — every printed "a card from the <X> set" in cycle 1 sits on a card that is itself a member of that set, so
 * `self` says it without naming the set anywhere in `@mc/cards`. Reads `encounterSetIds` off card data, so it
 * matches wherever the card is (deck, discard, set aside, in play). docs/phase7-wave2.md §20.2.
 */
export const encounterSetOf = (ref: TargetRef): Pick<TargetQuery, "encounterSetOf"> => ({ encounterSetOf: ref });

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

/**
 * Mirrors `@mc/engine`'s own `AttackKeyword` (`spec.ts`) structurally: keywords that belong to an *attack* rather
 * than a character (RRG 1.8 "Piercing"/"Ranged"/"Overkill"). `packages/engine/src/index.ts`'s public barrel doesn't
 * export the type itself yet (only the `EffectSpec`/`RuleSpec` shapes that use it), and `@mc/cards` doesn't own that
 * file — this local alias is string-literal-for-string-literal identical, so it's structurally assignable wherever
 * the engine's own type is expected. Replace with a direct import once the barrel catches up.
 */
export type AttackKeyword = "piercing" | "ranged" | "overkill";

/** "N [per_hero]" (plus an optional flat base). */
export const perHero = (perPlayer: number, base = 0): ValueSpec => ({ kind: "perPlayer", base, perPlayer });
/** A number bound by a cost or an earlier effect (`paid.energy`, `<bind>.amount`, `self.counters.energy`, …). */
export const varOf = (name: string): ValueSpec => ({ kind: "var", name });
export const statOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat });
export const countOf = (q: TargetQuery): ValueSpec => ({ kind: "count", query: q });
/**
 * The total of several values: "for each ally and Persona support in play" (Generation Why?) →
 * `sum(countOf(query("ally")), countOf(query("support", { trait: PERSONA })))`. Use it when one query can't say it:
 * a query's `trait` applies to every category it lists.
 */
export const sum = (...values: readonly Amount[]): ValueSpec => ({ kind: "sum", values: values.map(amount) });
/**
 * How many of a bound-slot's cards match a query, wherever they are (unlike `countOf`, not restricted to in play):
 * "for each treachery looked at this way" (Falcon: `countAmong(chosen("looked"), query("treachery"))`).
 */
export const countAmong = (cardsRef: TargetRef, q: TargetQuery): ValueSpec => ({
  kind: "countInRef",
  cards: cardsRef,
  query: q,
});
/**
 * "Where X is equal to the villain's stage number" (Death from Above, Wicked Ambitions, Regenerative Healing,
 * Muster Courage, Running Interference, United We Stand, Browbeat): `of` defaults to the active villain. Several
 * packs (`wave1/gob/local.ts` first) carried an identical per-pack copy of this builder predating its
 * centralization here, the same situation `superlative`/`printedCostOf` were in.
 */
export const villainStageNumberOf = (of?: TargetRef): ValueSpec => ({
  kind: "villainStageNumber",
  ...(of ? { of } : {}),
});
export const damageOn = (of: TargetRef): ValueSpec => ({ kind: "damage", of });
export const threatOn = (of: TargetRef): ValueSpec => ({ kind: "threat", of });
export const boostIconsOn = (of: TargetRef): ValueSpec => ({ kind: "boostIcons", of });
export const remainingHpOf = (of: TargetRef): ValueSpec => ({ kind: "remainingHp", of });
/** A card's own printed resource cost (0 for a card that prints none): "the highest-cost card you control". */
export const printedCostOf = (of: TargetRef): ValueSpec => ({ kind: "printedCost", of });
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
 * "The cards in a player's deck" as a count — the player deck only, never a separate deck. The sibling of
 * `handCountOf`, and what "the top half of their deck" is measured from: `zone("deck", p, { top: scaled(
 * deckCountOf(p), { divide: { by: 2, round: "down" } }) })`. Rounding is the caller's, and required: RRG 1.8
 * "Modifiers" (p. 29) rounds fractional values up unless the text prints otherwise.
 */
export const deckCountOf = (player: PlayerRef = you): ValueSpec => ({ kind: "deckCount", player });
/**
 * "For each facedown encounter card in front of you" (Star-Lord's own kit, `stld`: Gutsy Move, Sliding Shot, Jet
 * Boots, Star-Lord's Helmet; docs/phase7-wave3.md §3.10): the count of encounter cards the interrupt-time cost
 * `AbilityCost.dealEncounterCards` (§3.20) has dealt a player, read live wherever it's needed.
 */
export const dealtEncounterCount = (player: PlayerRef = you): ValueSpec => ({ kind: "dealtEncounterCount", player });

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
/**
 * The lowest/highest of two or more values: "remove that many growth counters (up to the number on Groot)" (Flora
 * Colossus, `gmw` 16001a) is `min(eventAmount, countersOn(self, "growth"))`, evaluated fresh wherever it's read —
 * so reading it again after an effect changes one of its inputs (e.g. removing the counters it just measured)
 * gives a different answer. Sequence effects so anything computed from the pre-effect value reads it first.
 */
export const min = (...values: readonly [Amount, Amount, ...Amount[]]): ValueSpec => ({
  kind: "min",
  values: values.map(amount) as [ValueSpec, ...ValueSpec[]],
});
export const max = (...values: readonly [Amount, Amount, ...Amount[]]): ValueSpec => ({
  kind: "max",
  values: values.map(amount) as [ValueSpec, ...ValueSpec[]],
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
/**
 * A numeric comparison between two live values — the general form behind "if there is 10 or more threat here"
 * (Day of Reckoning, Thunderstruck, Pile It On!, Clear the Road): `valueAtLeast(threatOn(self), 10)`. Either side may
 * be any `ValueSpec`, so the threshold can itself be read from the board. Use it for anything the older
 * `damagedAtLeast`/`counterAtLeast`/`varAtLeast` spellings don't already cover.
 */
export const valueAtLeast = (value: Amount, threshold: Amount): Predicate => ({
  kind: "compare",
  left: amount(value),
  op: "atLeast",
  right: amount(threshold),
});
/** "If there is no threat here" / "if you have 2 or fewer cards in hand": the upper-bound half of `valueAtLeast`. */
export const valueAtMost = (value: Amount, threshold: Amount): Predicate => ({
  kind: "compare",
  left: amount(value),
  op: "atMost",
  right: amount(threshold),
});
/** "If X is exactly N". */
export const valueEquals = (value: Amount, threshold: Amount): Predicate => ({
  kind: "compare",
  left: amount(value),
  op: "equalTo",
  right: amount(threshold),
});
/** "If there is N or more threat on <scheme>" — the spelling the Wrecking Crew signature side schemes print. */
export const threatAtLeast = (of: TargetRef, n: Amount): Predicate => valueAtLeast(threatOn(of), n);
/** A result of the triggering event ("if this attack dealt damage" → `eventDealt("damage")`). */
export const eventDealt = (key: string, n = 1): Predicate => ({ kind: "eventResultAtLeast", key, amount: n });
/** "If the villain is making an undefended attack". */
export const undefendedAttack: Predicate = { kind: "currentAttack", key: "undefended", atLeast: 1 };
/**
 * "If this activation is an attack/scheme" (Badoon Warlord, Badoon Lieutenant, `gmw` 16121/16119), readable from a
 * Boost ability body, which has no `context.event` of its own (docs/phase7-wave3.md's `gmw` scenario scripting).
 */
export const activationIs = (activation: "attack" | "scheme"): Predicate => ({
  kind: "currentActivationIs",
  activation,
});
/** "If this is the final step of this sequence" (Wakanda Forever!). */
export const finalStep: Predicate = varAtLeast("sequence.final", 1);
/**
 * "When all the players have joined this game area" is `stateCheck(not(gameAreasSplit))` (The Master of Time 2B,
 * docs/phase7-wave2.md §3.1): true once every player is in the same game area again (or the scenario never split).
 */
export const gameAreasSplit: Predicate = { kind: "gameAreasSplit" };
/**
 * "If all the players at this stage are defeated" (Kang's stage 3 cards, docs/phase7-wave2.md §3.1): every player
 * in this effect's own game area is defeated (eliminated). False outside a separate game area.
 */
export const areaPlayersDefeated: Predicate = { kind: "areaPlayersDefeated" };
/** "During step one of the villain phase". */
export const duringVillainPhaseStepOne: Predicate = { kind: "gameStep", phase: "villain", step: "placeThreat" };
/**
 * "The first [card type] played each round" (Steve Rogers, Living Legend: "Reduce the cost of the first ally
 * played each round by 1"). FAQ "Steve Rogers (#1B)" (RRG 1.8 p. 59): applies to the very first ally that player
 * plays each round, whatever form they're in when it's played — so this reads the round count, not the phase's.
 */
export const firstThisRound = (cardType: string, player: PlayerRef = you): Predicate => ({
  kind: "playedThisRound",
  player,
  cardType,
  atMost: 0,
});

// ---------------------------------------------------------------------------
// Wave 2 (cycle 1, docs/phase7-wave2.md) additions
// ---------------------------------------------------------------------------

/** "The total cost of all allies beneath it" (Hydra Prison, `trors`). */
export const totalPrintedCost = (cardsRef: TargetRef): ValueSpec => ({ kind: "totalPrintedCost", cards: cardsRef });
/**
 * "X is the number of printed resources on that card" (the Hawkeye ally 04011, Kate Bishop, reading a card
 * discarded to pay its own cost). `types` narrows to some icon types; absent counts all four, wild included.
 */
export const totalPrintedResources = (
  cardsRef: TargetRef,
  types?: readonly ("physical" | "mental" | "energy" | "wild")[],
): ValueSpec => ({ kind: "totalPrintedResources", cards: cardsRef, ...(types ? { types } : {}) });

// ---------------------------------------------------------------------------
// Campaign mode (docs/campaign-mode-design.md §6.1)
// ---------------------------------------------------------------------------

/** How a campaign-log read is scoped: whose column, and whether entries are being counted. */
export interface CampaignLogRead {
  /** Absent reads the shared field; a `PlayerRef` reads that seat's column (MC10 p. 7's per-seat hit points). */
  readonly seat?: PlayerRef;
  /** Count a list field's entries ("the number of X recorded") rather than read a number field's value. */
  readonly of?: "count";
}

/**
 * "The number of delay counters recorded in the campaign log" (MC10 p. 15). Reads the snapshot the campaign froze
 * into this game, so it is 0 in a game that is not part of a campaign.
 */
export const campaignLogValue = (field: string, read: CampaignLogRead = {}): ValueSpec => ({
  kind: "campaignLog",
  field,
  ...(read.seat ? { seat: read.seat } : {}),
  ...(read.of ? { of: read.of } : {}),
});

/** "If <card> is in the campaign pool" (MC21 p. 17): the field lists this card id, option or instruction id. */
export const campaignLogHas = (field: string, value: string, read: CampaignLogRead = {}): Predicate => ({
  kind: "campaignLog",
  field,
  has: value,
  ...(read.seat ? { seat: read.seat } : {}),
});

/** "If the <X> box is checked" — and with `set: false`, the printed "if it is not". */
export const campaignLogIsSet = (field: string, set = true, read: CampaignLogRead = {}): Predicate => ({
  kind: "campaignLog",
  field,
  isSet: set,
  ...(read.seat ? { seat: read.seat } : {}),
});

/** "If N or more <X> are recorded in the campaign log". */
export const campaignLogAtLeast = (field: string, n: number, read: CampaignLogRead = {}): Predicate => ({
  kind: "campaignLog",
  field,
  atLeast: n,
  ...(read.seat ? { seat: read.seat } : {}),
  ...(read.of ? { of: read.of } : {}),
});

/** "Each <X> recorded in the campaign log", as a query clause narrowing cards to the ones the field names. */
export const inCampaignLogField = (field: string, seat?: PlayerRef): Pick<TargetQuery, "inCampaignLogField"> => ({
  inCampaignLogField: { field, ...(seat ? { seat } : {}) },
});
