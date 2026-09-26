import { trait, type Trait } from "@mc/content";
import { UNRESOLVED_VAR } from "@mc/engine";
import type {
  CharacterNames,
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
/**
 * "The player who is engaged with the fewest minions" (Drang III, `gmw` 16060; docs/phase7-wave3.md §3.35): the
 * player(s) in `among` (default each player) with the lowest/highest `measure`, each measured as `thatPlayer`:
 * `superlativePlayer("lowest", countOf(query("minion", { engagedWithPlayer: thatPlayer })))`. Read fresh each time
 * it is resolved. Ties resolve to every tied player (`ties: "first"`: the first in player order); to make one player
 * pick among them, pass it as `choosePlayer(slot, firstPlayer, { among })` — RRG 1.8 "First Player" (p. 19) gives an
 * encounter card's tie to the first player.
 */
export const superlativePlayer = (
  order: "highest" | "lowest",
  measure: ValueSpec,
  opts: { readonly among?: PlayerRef; readonly ties?: "all" | "first" } = {},
): PlayerRef => ({ kind: "superlative", order, measure, ...opts });
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
/**
 * "The player who controls that identity" / "the player who controls the Power Stone" (docs/phase7-wave3.md §3.39):
 * the players who control the cards `target` names, in player order. An encounter card is controlled by the scenario
 * (RRG 1.8 "Ownership and Control", p. 31), so it names nobody. The Power Stone, read as "attached to your identity"
 * (§4 Q11), is `controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" }))))`.
 */
export const controllerOf = (target: TargetRef): PlayerRef => ({ kind: "controllerOf", target });

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
/** "The attacking enemy" from a trigger that is not the attack's own (Flow Like Water; docs/phase7-wave4.md §3.34). */
export const attackingEnemy: TargetRef = { kind: "attackingEnemy" };
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

/**
 * `categories: []` means "not filtered by category at all" (`TargetQuery.categories` is optional; the engine's own
 * `explainQuery`, `packages/engine/src/select.ts`, treats *any* array there — including an empty one — as an
 * active filter, so an empty array would otherwise match nothing). `query([], { printedId })` (`campaigns/gmw.ts`'s
 * `revealChallengeSideScheme`/headhunter-ladder queries, the only current callers) means "any category, but this
 * exact printed card" — so an empty list is omitted here rather than sent through as a category filter that can
 * never be satisfied.
 */
export const query = (
  categories: TargetCategory | readonly TargetCategory[],
  rest: Omit<TargetQuery, "categories"> = {},
): TargetQuery => {
  const list = typeof categories === "string" ? [categories] : categories;
  return list.length === 0 ? rest : { categories: list, ...rest };
};

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
/**
 * "An ally **with a weapon attachment upgrade**" (Target Practice, `stld` 17017; docs/phase7-wave3.md §3.40): a query
 * fragment matching a card that has at least one attachment matching `q` — `query("ally", hasAttachment(query(
 * "upgrade", { trait: WEAPON })))`. The other direction of `host`.
 */
export const hasAttachment = (q: TargetQuery): Pick<TargetQuery, "hasAttachment"> => ({ hasAttachment: q });
/**
 * "A facedown energy form upgrade" (Spectrum's Energy Transformation, `mts` 21001a): a query fragment for a card printing
 * the form keyword of `formType` on either face, read even while it is facedown (docs/phase7-wave4.md §3.1) —
 * `query("upgrade", printedForm("energy"), { facedown: true, controller: "you" })`.
 */
export const printedForm = (formType: string): Pick<TargetQuery, "printedForm"> => ({ printedForm: formType });
/**
 * "Each Spell card in your play area" (Ebony Maw I–III, `mts` 21071–21073): a query fragment for cards in that player's
 * play area, controlled by them or not (docs/phase7-wave4.md §3.16).
 */
export const inPlayAreaOf = (player: PlayerRef = you): Pick<TargetQuery, "inPlayAreaOf"> => ({ inPlayAreaOf: player });

/** "Friendly character": any identity or ally (every player's, RRG "Friendly"). */
export const FRIENDLY_CHARACTER: TargetQuery = query(["identity", "ally"]);
/** "Your hero": your identity while it is in hero form. */
export const YOUR_HERO: TargetQuery = query("hero", { controller: "you" });
/** "You" as a card: your identity in either form. */
export const YOUR_IDENTITY: TargetQuery = query("identity", { controller: "you" });

// ---------------------------------------------------------------------------
// Characters named by title — Team-Up cards (docs/phase7-wave3.md §3.34)
// ---------------------------------------------------------------------------

/**
 * The names a Team-Up card's own keyword prints ("Team-Up (Groot and Rocket Raccoon)"), read from the card data so a
 * script never repeats them: `index` 0 or 1 is one of the two, absent is both.
 */
const teamUpNames = (index?: 0 | 1): CharacterNames => ({
  teamUpOf: self,
  ...(index === undefined ? {} : { index }),
});
/**
 * "Groot" / "Cyclops and Phoenix" on a Team-Up card, as a query: the friendly character (identity or ally, whoever
 * controls it) showing that title — an identity by its faceup side only (RRG 1.8 "Identity", p. 23), an ally by its
 * title or subtitle (RRG 1.8 "Team-Up", p. 43). `index` picks name 0 or 1 of the keyword; absent matches either.
 */
export const teamUpCharacter = (index?: 0 | 1): TargetQuery =>
  query(["identity", "ally"], { titled: teamUpNames(index) });
/**
 * "Ready Cyclops and Phoenix" / "place 2 growth counters on Groot" / "Heal 3 damage each from Gwen Stacy and Miles
 * Morales": every friendly character the Team-Up card names (`index`: just one of them), as a ref.
 * "X is the total ATK of Colossus and Wolverine" is `sum(statOf(teamUpCharacters(0), "atk"), statOf(
 * teamUpCharacters(1), "atk"))`.
 */
export const teamUpCharacters = (index?: 0 | 1): TargetRef => each(teamUpCharacter(index));
/**
 * "A Rocket Raccoon upgrade" / "a Cyclops card": a card of the identity-specific set of the identity the Team-Up card
 * names, whoever controls it (RRG 1.8 "Identity-Specific Card", p. 23). A query fragment: `query("upgrade",
 * ofTeamUpSet(1))`, `ofTeamUpSet(0)` over a `zone("discard", you, …)` for "a Cyclops card from your discard pile".
 */
export const ofTeamUpSet = (index?: 0 | 1): Pick<TargetQuery, "identitySetTitled"> => ({
  identitySetTitled: teamUpNames(index),
});
/** A character named by a title written out, for a card that names one without the Team-Up keyword. */
export const titled = (...names: readonly string[]): TargetQuery => query(["identity", "ally"], { titled: { names } });
/** `ofTeamUpSet`'s written-out form: "a <name> card" by identity title. */
export const ofIdentitySetTitled = (...names: readonly string[]): Pick<TargetQuery, "identitySetTitled"> => ({
  identitySetTitled: { names },
});

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
/** "The total ATK of those allies" (Mass Attack, `mts` 21016): the stat summed over every card `of` names (§3.41). */
export const totalStatOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat, total: true });
export const countOf = (q: TargetQuery): ValueSpec => ({ kind: "count", query: q });
/**
 * The total of several values: "for each ally and Persona support in play" (Generation Why?) →
 * `sum(countOf(query("ally")), countOf(query("support", { trait: PERSONA })))`. Use it when one query can't say it:
 * a query's `trait` applies to every category it lists.
 */
export const sum = (...values: readonly Amount[]): ValueSpec => ({ kind: "sum", values: values.map(amount) });
/** "N per hero for each X": the product of values read now (Hela, `mts` 21136a; docs/phase7-wave4.md §3.47). */
export const product = (...values: readonly Amount[]): ValueSpec => ({ kind: "product", values: values.map(amount) });
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
/** A villain's "Activation Order X" (The Sinister Six; docs/phase7-wave5.md §3.1): the `superlative` measure. */
export const activationOrderOf = (of: TargetRef): ValueSpec => ({ kind: "activationOrder", of });
export const villainStageNumberOf = (of?: TargetRef): ValueSpec => ({
  kind: "villainStageNumber",
  ...(of ? { of } : {}),
});
export const damageOn = (of: TargetRef): ValueSpec => ({ kind: "damage", of });
export const threatOn = (of: TargetRef): ValueSpec => ({ kind: "threat", of });
/**
 * "X is equal to the main scheme's current stage number" (Collector I/II, `gmw` 16080a/16081a): the central main
 * scheme's own stage number, as it reads now. The `villainStageNumberOf` sibling above.
 */
export const mainSchemeStageNumber: ValueSpec = { kind: "mainSchemeStageNumber" };
export const boostIconsOn = (of: TargetRef): ValueSpec => ({ kind: "boostIcons", of });
export const remainingHpOf = (of: TargetRef): ValueSpec => ({ kind: "remainingHp", of });
/** A card's own printed resource cost (0 for a card that prints none): "the highest-cost card you control". */
export const printedCostOf = (of: TargetRef): ValueSpec => ({ kind: "printedCost", of });
export const countersOn = (of: TargetRef, counterType: string): ValueSpec => ({ kind: "counters", of, counterType });
/** "For each different resource type discarded this way" (wild counts as its own type). */
export const resourceTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "resourceTypes", cards: cardsRef });
/**
 * "For each different aspect discarded this way (Aggression, Justice, Leadership and Protection)" (Karmic Blast, Cosmic
 * Awareness, Regeneration Cycle, `mts`; docs/phase7-wave4.md §3.12).
 */
export const distinctAspectsOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctAspects", cards: cardsRef });
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
 * The cards in a scenario out-of-play area, optionally filtered: "if there are at least 5 cards in The Collection"
 * (The Grand Collection 1B), "for each card in The Collection" (Collector III). docs/phase7-wave3.md §3.14.
 */
export const scenarioAreaCount = (name: string, filter?: TargetQuery): ValueSpec => ({
  kind: "scenarioAreaCount",
  name,
  ...(filter ? { filter } : {}),
});
/**
 * The cards in the victory display, optionally filtered: "Play only if there is a side scheme in the victory display"
 * (Mission Planning, Critical Hit) is `playOnlyIf(valueAtLeast(victoryDisplayCount(query("sideScheme")), 1))`.
 * docs/phase7-wave3.md §3.42.
 */
export const victoryDisplayCount = (filter?: TargetQuery): ValueSpec => ({
  kind: "victoryDisplayCount",
  ...(filter ? { filter } : {}),
});
/** "The victory condition" (All Hail King Loki 1B): `Scenario.victoryCondition` for the modes played (§3.7 of wave 4). */
export const victoryCondition: ValueSpec = { kind: "victoryCondition" };
/**
 * How many modular encounter sets are still set aside: Wheel of Genres (`mojo` 39026a), "if there are no set-aside
 * modular encounter sets remaining" → `valueEquals(setAsideModularSetCount, 0)` (docs/phase7-wave4.md §3.18).
 */
export const setAsideModularSetCount: ValueSpec = { kind: "setAsideModularSetCount" };

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
/**
 * "While attacking the enemy with Death-Glow attached" (Dragonfang, 25006), "while defending against the enemy with
 * Death Glow attached" (Valkyrie's Spear, 25005), "while attacking a character with the [Aerial] trait" (Harpoon): the
 * innermost attack on the stack matches every query given (docs/phase7-wave4.md §3.22). Use it as a stat modifier's
 * condition: `gets("atk", ifElse(attackInProgress({ attacker: YOUR_IDENTITY, target: query("enemy", { hasAttachment:
 * query("upgrade", { name: "Death-Glow" }) }) }), 2, 1), YOUR_IDENTITY)`.
 */
export const attackInProgress = (of: {
  readonly attacker?: TargetQuery;
  readonly target?: TargetQuery;
  readonly defender?: TargetQuery;
}): Predicate => ({ kind: "attackInProgress", ...of });
/**
 * "If you were already in Gamma energy form" (Gamma Blast, `mts` 21007) / "While you are in Dense mass form" / "Play only
 * if Vision is in Intangible mass form" (`vision`): `player` controls a faceup card with the form keyword of `formType`,
 * titled `name` when given (docs/phase7-wave4.md §3.1).
 */
export const inAdditionalForm = (formType: string, name?: string, player: PlayerRef = you): Predicate => ({
  kind: "inAdditionalForm",
  player,
  formType,
  ...(name !== undefined ? { name } : {}),
});
export const isAlterEgo = (player: PlayerRef = you): Predicate => inForm("alterEgo", player);
export const exists = (q: TargetQuery): Predicate => ({ kind: "exists", query: q });
/** "If Bomb Scare is in play" (exact printed name). */
export const inPlay = (name: string): Predicate => exists({ name });
export const not = (of: Predicate): Predicate => ({ kind: "not", of });
export const allOf = (...of: Predicate[]): Predicate => ({ kind: "and", of });
export const anyOf = (...of: Predicate[]): Predicate => ({ kind: "or", of });
/** "If you paid for this card using a [X] resource". */
export const paidWith = (resource: TypedResource): Predicate => ({ kind: "paidWith", resource });
/**
 * "If you paid for this card using only [X] resources" (Behind Enemy Lines, Grasping Tendrils, Savage Attack,
 * `vnm`; docs/phase7-wave3.md §3.26): something was paid, and every resource paid was that type or a wild
 * declared as it. FAQ "Unstoppable Force (#6)" (RRG 1.8 p. 60): at a cost of 0 it fails. The engine `Predicate`
 * already existed (`play-restrictions.test.ts`'s own SMASH_ACTION); this is its first DSL wrapper.
 */
export const paidWithOnly = (resource: TypedResource): Predicate => ({ kind: "paidWithOnly", resource });
export const varAtLeast = (name: string, n = 1): Predicate => ({ kind: "varAtLeast", name, amount: n });
/**
 * The ability's last required choice found no valid target (RRG 1.8 "Target", pp. 42–43): "If no cards were discarded
 * this way" after a choice that had nothing it could discard.
 */
export const choiceFoundNothing = (): Predicate => varAtLeast(UNRESOLVED_VAR, 1);
/** An event-producing effect with `bind` happened ("if no attacks were made this way" = `not(made(b))`). */
export const made = (bind: string): Predicate => varAtLeast(`${bind}.made`, 1);
export const hasStatus = (of: TargetRef, status: StatusName): Predicate => ({ kind: "hasStatus", of, status });
/**
 * "Attach to X. If you cannot, …" (Goblin Glider; Jetpack, Flamethrower, `hood` 24037–24040): whether the card `of`
 * names is attached right now, read in its own When Revealed after the engine tried its `attachesTo`.
 */
export const isAttached = (of: TargetRef): Predicate => ({ kind: "isAttached", of });
/**
 * "A stunned / confused character" by the rules: with steady, two status cards of the type (RRG 1.8 "Steady", p. 41).
 * `hasStatus` only asks whether a status card is there. docs/phase7-wave4.md §3.52.
 */
export const isStunned = (of: TargetRef): Predicate => ({ kind: "hasStatus", of, status: "stunned", active: true });
export const isConfused = (of: TargetRef): Predicate => ({ kind: "hasStatus", of, status: "confused", active: true });
export const hasTrait = (of: TargetRef, t: Trait): Predicate => ({ kind: "hasTrait", of, trait: t });
/** "If you have the Aerial trait". */
export const youHaveTrait = (t: Trait): Predicate => hasTrait(yourIdentity, t);
/**
 * The ref names a card that is in play and matches the query. `anywhere: true` drops the "in play" requirement
 * ("Look at the top card of your deck. If that card is an attack or thwart event, draw it.", Gamora 18001b): the
 * looked-at card is still on top of the deck, not in play, when this reads it.
 */
export const refMatches = (ref: TargetRef, q: TargetQuery, opts: { readonly anywhere?: boolean } = {}): Predicate => ({
  kind: "refMatches",
  ref,
  query: q,
  ...(opts.anywhere ? { anywhere: true } : {}),
});
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

// ---------------------------------------------------------------------------
// Wave 3 (cycle 2, docs/phase7-wave3.md) additions
// ---------------------------------------------------------------------------

/**
 * "If you have played a [Thwart] event this turn" (Decisive Blow, Forward Momentum, `gam`): at least `atLeast`
 * (default 1) of the cards `player` played this turn match `cards`, wherever those cards are now.
 * docs/phase7-wave3.md §3.24.
 */
export const playedThisTurn = (cards: TargetQuery, opts: { player?: PlayerRef; atLeast?: number } = {}): Predicate => ({
  kind: "playedThisTurn",
  player: opts.player ?? you,
  cards,
  ...(opts.atLeast !== undefined ? { atLeast: opts.atLeast } : {}),
});

/**
 * How many cards (of `cardType`, absent: any) `player` has played this round is at most `atMost`. `firstThisRound`
 * (above) is the wave 1 "first ally played each round" reading (`atMost: 0`, before the card in question); this is
 * the general form wave 3 needs for "If this is the first card you have played this round, return this card to your
 * hand" (Clobber, Impede, `gam`) — `atMost: 1` while the card itself resolves, since it counts as played from the
 * moment it is played (docs/phase7-wave3.md §3.11).
 */
export const playedThisRound = (atMost: number, opts: { cardType?: string; player?: PlayerRef } = {}): Predicate => ({
  kind: "playedThisRound",
  player: opts.player ?? you,
  ...(opts.cardType ? { cardType: opts.cardType } : {}),
  atMost,
});
