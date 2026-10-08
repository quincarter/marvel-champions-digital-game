import { trait, type Trait } from "@mc/content";
import { UNRESOLVED_VAR } from "@mc/engine";
import type {
  BasicPowerName,
  CardIcon,
  CharacterNames,
  Form,
  PlayerRef,
  Predicate,
  ResourceRequirement,
  RulesCardType,
  SetupOutsideFact,
  StatComparison,
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
 * `playerIs` scope so the trigger isn't limited to "you". On a threat removal (`{ on: "removeThreat" }`) it is "the
 * player who removed that threat" (The Search for Spiral, `mojo` 39016): the thwarting player, else the player who used
 * the ability that removed it, an encounter card's own Hero Action included; nobody for an encounter card's forced
 * removal. On a card leaving play it is the card's controller, or for an obligation the player whose play area held it
 * ("After a player discards an obligation, that player …", Mojo in the Middle 39060).
 */
export const eventPlayer: PlayerRef = { kind: "eventPlayer" };
/**
 * "This player, else that one": `first` when it names anyone, otherwise `otherwise`. The Search for Spiral (`mojo`
 * 39016) reveals for `playerOrElse(eventPlayer, firstPlayer)`: the player who removed the threat, or the first player
 * when an encounter card's forced removal took it (owner decision Q64, docs/phase7-wave6-handoff.md).
 */
export const playerOrElse = (first: PlayerRef, otherwise: PlayerRef): PlayerRef => ({
  kind: "orElse",
  first,
  otherwise,
});
/**
 * "The player who defeated this scheme" (Crossbones' Assault 04070, Prison Camps 04141, Hydra Reinforcements
 * 04143): the defeating player recorded on the `schemeDefeated`/`characterDefeated` event a `whenDefeated` ability
 * is reacting to. Empty outside a defeat, and for a defeat no player caused.
 */
export const defeatingPlayer: PlayerRef = { kind: "defeatingPlayer" };
/**
 * "The attacked player" (RRG 1.8 "Attack (Enemy Activation)", p. 8; "Attacks Against Allies", p. 10): the player the
 * enemy attack in progress was initiated against, whoever defends it; the controller of an attacked ally. Nobody
 * outside an enemy attack. `attackedPlayer(self)` on an enemy's own constant is the "you" of "While [this enemy] is
 * attacking you, he gets +X ATK, where X is … in your hand": only that enemy's attack counts, so the bonus is 0 while
 * it is not attacking. With no attacker: the innermost attack on the stack.
 */
export const attackedPlayer = (attacker?: TargetRef): PlayerRef => ({
  kind: "attackedPlayer",
  ...(attacker ? { attacker } : {}),
});
export const ownerOf = (target: TargetRef): PlayerRef => ({ kind: "ownerOf", target });
/**
 * "The player who controls that identity" / "the player who controls the Power Stone" (docs/phase7-wave3.md §3.39):
 * the players who control the cards `target` names, in player order. An encounter card is controlled by the scenario
 * (RRG 1.8 "Ownership and Control", p. 31), so it names nobody. The Power Stone, read as "attached to your identity"
 * (§4 Q11), is `controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" }))))`.
 */
export const controllerOf = (target: TargetRef): PlayerRef => ({ kind: "controllerOf", target });
/**
 * "The next player" (RRG 1.8 "In Player Order", p. 24; docs/phase7-wave8.md §3.75): the next clockwise player after
 * `player` who is still in the game, wrapping around the table. Nobody in a one-player game, where a card's "if there
 * is more than 1 player in the game" keeps the effect from being reached.
 */
export const nextAfter = (player: PlayerRef): PlayerRef => ({ kind: "nextAfter", of: player });
/**
 * "Any player whose alter-ego has the [MUTANT] trait" (X-Mansion, `mut_gen` 32049; docs/phase7-wave6.md §3.11): the
 * players in `among` (default each player) for whom `predicate` holds, each read as `thatPlayer`:
 * `playersWhere(hasTrait(identityOf(thatPlayer), "Mutant"))`. "You" inside the predicate stays the ability's
 * controller.
 */
export const playersWhere = (predicate: Predicate, among?: PlayerRef): PlayerRef => ({
  kind: "where",
  predicate,
  ...(among ? { among } : {}),
});

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
/**
 * The enemy whose activation (attack or scheme) is in progress, innermost first, while it is in play ("give him an
 * additional boost card for this activation" only when he is the one activating). Works in a Boost ability.
 */
export const activatingEnemy: TargetRef = { kind: "activatingEnemy" };
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
/**
 * "Touched", wherever it is (docs/phase7-wave6.md §3.48): every card matching `q` in the game areas a "find" searches
 * (RRG 1.8 "Find", p. 19), owned by `owner` when given, in search order (in play first, decks last). A read: it moves
 * and shuffles nothing; the instruction "find X and …" is `findCard` (`dsl/effects.ts`).
 */
export const find = (q: TargetQuery, opts: { readonly owner?: PlayerRef } = {}): TargetRef => ({
  kind: "find",
  query: q,
  ...(opts.owner ? { owner: opts.owner } : {}),
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
 * "… with a printed cost of N or more": `query("event", printedCostAtLeast(3))` is "each event with a printed cost of
 * 3 or more" (Practiced Maneuvers, `next_evol` 40194b, as a `costModifier`'s `appliesTo`). The upper bound has no
 * builder: write `maxPrintedCost` in the same query, and the two select a band. The printed cost is compared, after
 * the per player icon multiplies it and never after a cost modifier; a dash, an X and a card with no cost read as 0
 * (see `TargetQuery.minPrintedCost`). docs/phase7-wave7.md §3.47.
 */
export const printedCostAtLeast = (bound: number | ValueSpec): Pick<TargetQuery, "minPrintedCost"> => ({
  minPrintedCost: bound,
});
/**
 * "… that shares a trait with your hero" (Team-Building Exercise, `ant` 12024): `query(categories, sharesTraitWith(
 * identityOf(you)))`. Both sides are read live through `traitsOf` — a granted trait counts on either end (RRG 1.8
 * "Gains", p. 21) — and a ref naming nothing, or naming only trait-less cards, matches nothing (there is no trait
 * to share). docs/phase7-wave2.md §20.1.
 */
export const sharesTraitWith = (ref: TargetRef): Pick<TargetQuery, "sharesTraitWith"> => ({ sharesTraitWith: ref });
/**
 * "… that can be attached to Deathlok" (`next_evol` 40025): `query("upgrade", canAttachTo(self))`, over cards anywhere
 * (a discard pile, a hand). The card's own printed host decides, as when it is played: the hosts its "attach to" text
 * allows, a "Max N per …" and a "cannot have attachments" rule included, and for an upgrade with no "attach to" text
 * only its controller's identity. "You" in that text is the player who would control the card there (the host's
 * controller, RRG 1.8 "Ownership and Control", p. 31). A ref naming several hosts matches a card that fits any of them.
 * The `attach` effect does not check this itself (RRG 1.8 "Attach To", p. 8), so the choice has to.
 */
export const canAttachTo = (host: TargetRef): Pick<TargetQuery, "canAttachTo"> => ({ canAttachTo: host });
/**
 * "… chooses 1 set-aside SPECIALIZATION upgrade and puts it into play under their control" (`x23` 43021), as a choice
 * among the cards the unique rule lets enter play: `query("upgrade", { trait, ...canEnterPlay(thatPlayer) })`. A unique
 * card that matches a card already in play "cannot be played or put into play" (RRG 1.8 "Unique Icon", pp. 45–46), so
 * it is not offered; the engine decides with the check `putIntoPlay` makes. The player is who it would enter play under.
 */
export const canEnterPlay = (player: PlayerRef): Pick<TargetQuery, "canEnterPlay"> => ({ canEnterPlay: player });
/**
 * "Flip 1 PSI-ENERGY upgrade", "you may flip this card", as a choice among the cards that can be flipped:
 * `query("upgrade", { trait: PSI_ENERGY, controller: "you", ...canFlip })`. A card a `cannotFlip` rule names is left
 * out, so an optional ability whose only candidates cannot flip is not offered (docs/phase7-wave7.md §3.64).
 */
export const canFlip: Pick<TargetQuery, "canFlip"> = { canFlip: true };
/**
 * "Each minion that shares a title with the top villain", "the minion with the same title as the villain":
 * `query("minion", sharesTitleWith(villain))`. Titles only, each as the card shows it now (a villain's current side, a
 * flipped card's other face); a subtitle is not read, a parenthetical is part of the title, a facedown card has no
 * title, and a card shares a title with itself. A ref naming several cards matches a card sharing a title with any of
 * them; a ref naming nothing matches nothing. For "does not share a title with", wrap it in `notMatching`.
 * docs/phase7-wave7.md §3.8.
 */
export const sharesTitleWith = (ref: TargetRef): Pick<TargetQuery, "sharesTitleWith"> => ({ sharesTitleWith: ref });
/**
 * The negation of a query filter, for one with no `without…` sibling: "a minion that does not share a title with a
 * card in play" is `query("minion", notMatching(sharesTitleWith(each(…))))`. The categories stay outside, so they still
 * narrow the candidates. (`not` is the `Predicate` negation; this is the `TargetQuery` one.) docs/phase7-wave7.md §3.8.
 */
export const notMatching = (excluded: TargetQuery): Pick<TargetQuery, "not"> => ({ not: excluded });
/**
 * "A character that can be given a [stunned / confused / tough] status card": one given to it now would be placed,
 * which is the check the give itself makes (RRG 1.8 "Status Cards", p. 41: one of each type, a second stunned or
 * confused for steady, none of those for stalwart or under a "cannot be stunned" rule, a `statusLimit` for tough). An
 * encounter card's "choose: • Confuse a character you control. • …" offers that option only if it can be carried out
 * in full (docs/phase7-wave7.md §4.1 Q8 = A): with `const able = query("character", { controller: "you",
 * ...canTakeStatus("confused") })`, the option is `option("…", { when: exists(able) }, chooseTarget("target", able),
 * confuse(chosen("target")))`. For "that cannot take one", wrap it in `notMatching`. docs/phase7-wave7.md §3.11.
 */
export const canTakeStatus = (status: StatusName): Pick<TargetQuery, "canTakeStatus"> => ({ canTakeStatus: status });
/**
 * "… a card from the [X] Nemesis set" (Yellowjacket's Plan, `ant` 12029): `query(categories, encounterSetOf(self))`
 * — every printed "a card from the <X> set" in cycle 1 sits on a card that is itself a member of that set, so
 * `self` says it without naming the set anywhere in `@mc/cards`. Reads `encounterSetIds` off card data, so it
 * matches wherever the card is (deck, discard, set aside, in play). docs/phase7-wave2.md §20.2.
 */
export const encounterSetOf = (ref: TargetRef): Pick<TargetQuery, "encounterSetOf"> => ({ encounterSetOf: ref });
/**
 * "Each card of the chosen type" (Psychic Override, `next_evol` 40178; docs/phase7-wave7.md §3.33): the card's type
 * is the one `chooseCardType(bind)` bound earlier in the same ability. `handCountOf(you, ofChosenCardType("type"))`.
 */
export const ofChosenCardType = (bind: string): Pick<TargetQuery, "cardTypeIs"> => ({ cardTypeIs: { chosen: bind } });
/** "Each card … that is not of that type": every card the chosen type does not match. */
export const notOfChosenCardType = (bind: string): Pick<TargetQuery, "not"> => ({ not: ofChosenCardType(bind) });
/**
 * "… an event that belong's to the same classification as that character (identity-specific, aspect, or basic)"
 * (Superpower Adaptation, `rogue` 38009): `query("event", sameClassificationAs(host))`. RRG 1.8 "Classifications"
 * (p. 12): an identity is identity-specific, the five aspects are one classification (docs/phase7-wave6.md §4.1 Q29),
 * encounter cards have none of the three. Read off card data, so it matches wherever the card is. §3.51.
 */
export const sameClassificationAs = (ref: TargetRef): Pick<TargetQuery, "sameClassificationAs"> => ({
  sameClassificationAs: ref,
});
/**
 * "An enemy whose SCH is less than Mirage's THW" (Mirage, `storm` 36015): `query("enemy", statCompare("sch", "lt",
 * statOf(self, "thw")))`. The card's current stat (or `{ printed: true }`, its printed one) against a value re-read
 * every check; a card with no stats never matches, a dash reads 0 (RRG 1.8 "Dash (Value)", p. 15).
 */
export const statCompare = (
  stat: StatName,
  op: StatComparison["op"],
  against: Amount,
  opts: { readonly printed?: true } = {},
): Pick<TargetQuery, "statCompare"> => ({
  statCompare: { stat, op, value: amount(against), ...(opts.printed ? { printed: true as const } : {}) },
});
/**
 * "Search the 'Sinister Assault' (158-163) modular set" (MC27 p. 17): the encounter set named by id, for a campaign
 * instruction that has no card of that set to point `encounterSetOf` at. Matches wherever the card is.
 */
export const inEncounterSet = (setId: string): Pick<TargetQuery, "inEncounterSet"> => ({ inEncounterSet: setId });
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

/**
 * RRG 1.8 "Encounter Card" (p. 17): "There are eight encounter card types" — villain, main scheme, side scheme, minion,
 * treachery, attachment, environment and obligation — controlled by no player. "Each encounter card gains peril" (The
 * One with the Breakup, `mojo` 39064) is `gainsKeyword({ name: "peril" }, ENCOUNTER_CARD)`; "each other encounter card
 * gains incite 1" (Dial M for Mojo, 39035) adds `{ self: false }`. A keyword grant over it also reaches a card while it
 * is being revealed, before it is in play, and a villain's new face (docs/phase7-wave6.md §3.65; FAQ #35, RRG 1.8 p. 64).
 */
export const ENCOUNTER_CARD_CATEGORIES: readonly TargetCategory[] = [
  "villain",
  "mainScheme",
  "sideScheme",
  "minion",
  "treachery",
  "attachment",
  "environment",
  "obligation",
];
export const encounterCard = (rest: Omit<TargetQuery, "categories" | "controller"> = {}): TargetQuery =>
  query(ENCOUNTER_CARD_CATEGORIES, { controller: "encounter", ...rest });
export const ENCOUNTER_CARD: TargetQuery = encounterCard();

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
/**
 * "A friendly character of your choice" as the new target of the player attack in progress (`retargetPlayerAttack`;
 * docs/phase7-wave7.md §3.66): every identity and ally in play that can take that attack's damage (RRG 1.8 "Target",
 * p. 43; ruling Mar 19, 2026 (2)), the attacker and other players' characters included (§4.1 Q40).
 */
export const CAN_TAKE_THIS_ATTACK: TargetQuery = { ...FRIENDLY_CHARACTER, canTakeAttackInProgress: "player" };
/**
 * "A resource of the named type" (docs/phase7-wave7.md §3.66): a card with a printed icon of `type`, the reading of a
 * printed wild icon said each time. `"anyType"`: a wild icon is a resource of whatever type was named (§4.1 Q40 = B).
 * `"ownType"`: a wild icon is only wild (RRG 1.8 "Wild Resource", p. 48), which is `{ printedResource: type }`.
 */
export const hasNamedResource = (
  type: "physical" | "mental" | "energy" | "wild",
  wild: "ownType" | "anyType",
): TargetQuery => ({ printedResourceNamed: { type, wild } });
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
/**
 * A number recorded per card: `varFor("removed.amount", chosen("affected"))` is how many counters
 * `removeEachCounterFrom(…, { bind: "removed" })` removed from that card (summed when `of` names several).
 */
export const varFor = (name: string, of: TargetRef): ValueSpec => ({ kind: "var", name, of });
export const statOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat });
/**
 * A character's printed stat (RRG 1.8 "Printed", p. 35), modifiers ignored; a "—" or star reads 0: "where X is that
 * minion's printed SCH" (Marvel Girl, 34015) is `printedStatOf(chosen("minion"), "sch")` (docs/phase7-wave6.md §3.33).
 */
export const printedStatOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat, printed: true });
/**
 * A character's base stat (RRG 1.8 "Base Value", p. 10): printed, or what a "has a base … of" ability defines, with no
 * other modifier. "Copies the base ATK and THW" of an ally whose star is defined by its text reads that definition
 * (ruling January 17, 2026 - Ruling 1; docs/phase7-wave7.md §3.25).
 */
export const baseStatOf = (of: TargetRef, stat: StatName): ValueSpec => ({ kind: "stat", of, stat, base: true });
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
/** How many different cards a ref names, wherever they are, with no query asked of them. */
export const refCount = (of: TargetRef): ValueSpec => ({ kind: "refCount", of });
/**
 * "The number of cards tucked under [card]" (Med Lab, `rogue` 38028: "(Limit 1 ally at a time.)"): the count of
 * `tuckedUnderRef(of, filter)`. Tucked cards are out of play (RRG 1.8 "Tuck", p. 45), so `countOf` cannot see them.
 */
export const tuckedCount = (of: TargetRef = self, filter?: TargetQuery): ValueSpec =>
  refCount(tuckedUnderRef(of, filter));
/**
 * "For each tough status card on Colossus" (Titanium Muscles, `mut_gen` 32005; docs/phase7-wave6.md §3.78): how many
 * `status` cards are on the card(s) `of` names (their total when it names several). `hasStatus` only says whether
 * there is one; Colossus can hold two tough status cards.
 */
export const statusCount = (status: "stunned" | "confused" | "tough", of: TargetRef = yourIdentity): ValueSpec => ({
  kind: "statusCount",
  of,
  status,
});
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
/**
 * "For each acceleration token on the main scheme" (docs/phase7-wave7.md §3.76): `accelerationTokensOn(theMainScheme)`;
 * "on it" for an attachment is `accelerationTokensOn(host)`. Tokens only, never acceleration icons (RRG 1.8
 * "Acceleration Token", p. 5), and only those on the cards named.
 */
export const accelerationTokensOn = (on: TargetRef): ValueSpec => ({ kind: "accelerationTokens", on });
/**
 * "For each [crisis], [acceleration], [amplify], and [hazard] in play" (docs/phase7-wave7.md §3.77): every such icon
 * cards in play show, or only the listed types ("if [crisis] is on 1 or more cards in play" is
 * `valueAtLeast(encounterIconsInPlay(["crisis"]), 1)`). Acceleration tokens are not icons.
 */
export const encounterIconsInPlay = (icons?: readonly CardIcon[]): ValueSpec => ({
  kind: "iconsInPlay",
  ...(icons ? { icons } : {}),
});
export const boostIconsOn = (of: TargetRef): ValueSpec => ({ kind: "boostIcons", of });
export const remainingHpOf = (of: TargetRef): ValueSpec => ({ kind: "remainingHp", of });
/** A card's own printed resource cost (0 for a card that prints none): "the highest-cost card you control". */
export const printedCostOf = (of: TargetRef): ValueSpec => ({ kind: "printedCost", of });
/**
 * A character's printed hit points (RRG 1.8 "Printed", p. 35): "Play only if your identity has at least 14 printed hit
 * points" is `playOnlyIf(valueAtLeast(printedHpOf(yourIdentity), 14))` (Limitless Stamina, `spdr` 31023).
 */
export const printedHpOf = (of: TargetRef): ValueSpec => ({ kind: "printedHp", of });
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
/**
 * "The cards in your hand" as a count (distinct from `handSizeOf`, the max-hand-size *stat*): "half of the cards in
 * your hand, rounded down" (Man Out of Time). An optional `filter` counts only the hand cards matching it: "the
 * number of identity-specific cards in the engaged player's hand" (Evil Doppelgänger) is
 * `handCountOf(engagedPlayerOf(self), { identitySetOf: eachPlayer })` (docs/phase7-wave5.md §4.1 Q69).
 */
export const handCountOf = (player: PlayerRef = you, filter?: TargetQuery): ValueSpec => ({
  kind: "handCount",
  player,
  ...(filter ? { filter } : {}),
});
/**
 * "X is the number of cards of the most common type in your hand" (Stryfe, `next_evol`; docs/phase7-wave7.md §3.32):
 * the size of the largest group of cards in that player's hand sharing one of the six player card types MC40 p. 18
 * lists (ally, event, player side scheme, resource, support, upgrade); an encounter card held in hand is not counted
 * (§4.1 Q18 = B). "Each player places X threat … in their hand" is `mostCommonHandTypeCount(thatPlayer)` inside
 * `forEachPlayer`; "at least 3 cards of the same type in their hand" is `valueAtLeast(mostCommonHandTypeCount(p), 3)`.
 */
export const mostCommonHandTypeCount = (player: PlayerRef = you): ValueSpec => ({
  kind: "largestHandTypeGroup",
  player,
});
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
  /** `true`: only a character's basic attack; `false`: only any other attack (docs/phase7-wave6.md §3.43). */
  readonly basic?: boolean;
}): Predicate => ({ kind: "attackInProgress", ...of });
/**
 * Inside a `modifyStatOf` amount: the card whose stat is being read (the engine's `AFFECTED_SLOT`). "While Wolverine
 * or Jubilee is making a basic attack against that enemy, **they** get +2 ATK" (Jubilee 35003; docs/phase7-wave6.md
 * §3.43) is `ifElse(attackInProgress({ attacker: theAffectedCard, target: { inSlot: "enemy" }, basic: true }), 2, 0)`.
 */
export const theAffectedCard: TargetQuery = { inSlot: "affected" };
/**
 * "If you exhausted Wolverine's Claws to play this card" (Lunging Strike 35010; docs/phase7-wave6.md §3.42): the card
 * resolving was played by an ability of a card matching `card` (`playFromHandIgnoringCost({ via })`).
 */
export const playedVia = (card: TargetQuery): Predicate => ({ kind: "playedVia", card });
/**
 * "If Gambit's 'Throw de Card' ability removed at least: • 1 counter, this attack gains ranged. • 2 counters, …"
 * (Charged Card 37006; docs/phase7-wave6.md §3.52): the play of the card resolving carries the note `name`
 * (`modifyCardEffect(…, { note })`, written by an interrupt to that play) of at least `atLeast`.
 */
export const playNote = (name: string, atLeast = 1): Predicate => ({ kind: "playNote", name, atLeast });
/**
 * "If this card was revealed from the encounter deck" (the SHOW environments, `mojo`; docs/phase7-wave6.md §3.64): true
 * during this card's reveal when it began at an encounter deck or at a facedown encounter card dealt from one, false
 * from the show deck, the set-aside area, a search, a discard pile or a player's deck. Written
 * `ifThen(revealedFromEncounterDeck, surge())` inside the When Revealed.
 */
export const revealedFromEncounterDeck: Predicate = { kind: "revealedFromEncounterDeck" };

/**
 * "If the previous stage was advanced by knock counters, …" (Mutant Massacre 2A, `next_evol` 40078a;
 * docs/phase7-wave7.md §3.12): the main scheme reached its current stage by `cause`: `"completed"` (threat reached the
 * target, or a card completed the stage) or `"cardEffect"` (a card's `advanceMainScheme`), from `source` when given.
 * A stage's own "advance to stage 2A" is `mainSchemeAdvancedBy("cardEffect", self)` in the next stage's When Revealed.
 */
export const mainSchemeAdvancedBy = (cause: "completed" | "cardEffect", source?: TargetRef): Predicate => ({
  kind: "mainSchemeAdvancedBy",
  cause,
  ...(source ? { source } : {}),
});
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
/**
 * The top card of `player`'s deck is kept faceup right now by a `playWithTopOfDeckFaceup` constant
 * (docs/phase7-wave8.md §3.48). False in the other form and under a blank text box.
 */
export const topOfDeckIsFaceup = (player: PlayerRef = you): Predicate => ({ kind: "topOfDeckFaceup", player });
/**
 * The faceup top card of `player`'s deck matches `matches`. False when the card is facedown, whatever it is: the game
 * does not read a hidden card to answer a question about it (docs/phase7-wave8.md §4.1 Q26 = B). False on an empty
 * deck.
 */
export const topOfDeckMatches = (matches: TargetQuery, player: PlayerRef = you): Predicate => ({
  kind: "topOfDeckFaceup",
  player,
  matches,
});
/**
 * "If the top card of your deck has a [physical] or [wild] resource icon" (Soulsword 45034, Soul Strike 45039; the
 * [mental] and [energy] siblings 45033, 45035, 45038, 45040; docs/phase7-wave8.md §3.50) → `topOfYourDeckHas(
 * "physical")`. The printed icons of the card showing on top of your deck include `type` or a wild (RRG 1.8 "Wild
 * Resource", p. 48: outside a cost a wild is only a wild, which is why each card names it); two icons of one type
 * count once. As the `while` of a stat modifier it follows the top card with no ability resolving; as an `ifThen`
 * condition it is read when that sentence resolves. A facedown top card, an empty deck and a card with no icon
 * satisfy none (`topOfDeckMatches`).
 */
export const topOfYourDeckHas = (type: TypedResource): Predicate =>
  topOfDeckMatches({ anyPrintedResource: [type, "wild"] });
export const allOf = (...of: Predicate[]): Predicate => ({ kind: "and", of });
export const anyOf = (...of: Predicate[]): Predicate => ({ kind: "or", of });
/**
 * "If you paid for this card using a [X] resource". `of`: another card's play, while it resolves — "When you play an
 * Aggression Attack event, if you paid for that event using a [mental] resource" (Honed Technique 28017) is
 * `paidWith("mental", eventTarget)`.
 */
export const paidWith = (resource: TypedResource, of?: TargetRef): Predicate => ({
  kind: "paidWith",
  resource,
  ...(of !== undefined ? { of } : {}),
});
/**
 * "If you paid for this card using only [X] resources" (Behind Enemy Lines, Grasping Tendrils, Savage Attack,
 * `vnm`; docs/phase7-wave3.md §3.26): something was paid, and every resource paid was that type or a wild
 * declared as it. FAQ "Unstoppable Force (#6)" (RRG 1.8 p. 60): at a cost of 0 it fails. The engine `Predicate`
 * already existed (`play-restrictions.test.ts`'s own SMASH_ACTION); this is its first DSL wrapper. `of` as for `paidWith`.
 */
export const paidWithOnly = (resource: TypedResource, of?: TargetRef): Predicate => ({
  kind: "paidWithOnly",
  resource,
  ...(of !== undefined ? { of } : {}),
});
/**
 * "If you paid for this event with a resource card" (Concussive Blast `aoa` 45007, Command Authority 45008;
 * docs/phase7-wave8.md §3.51): a card of that type was discarded from a hand to pay and one of its resources was paid.
 * A resource ability is not a resource card (RRG 1.8 "Cost", p. 13); an overpaid card does not count, and at a cost of
 * 0 nothing was paid (§4.1 Q28 = A; FAQ "Unstoppable Force (#6)", p. 60). `of` as for `paidWith`.
 */
export const paidWithCard = (cardType: RulesCardType, of?: TargetRef): Predicate => ({
  kind: "paidWithCard",
  cardType,
  ...(of !== undefined ? { of } : {}),
});
/** "If you paid for this event with a resource card": `paidWithCard("resource")`. */
export const paidWithResourceCard = (of?: TargetRef): Predicate => paidWithCard("resource", of);
/**
 * "The number of different resource types ([energy], [mental], [physical], and [wild]) used to pay for this event" /
 * "for each different resource type … you used to pay for this card" (Blinding Flash 47006, Grand Finale 47009, Three
 * Steps Ahead 47015; docs/phase7-wave8.md §3.62): the types among the resources paid, each wild as its player declared
 * it and a wild left a wild a type of its own. Overpaid resources are not counted, so it is never more than the cost
 * (§4.1 Q34 = A), and 0 at a cost of 0. The ability carries `readsPaidTypes: { count: true }` (or `{ atLeast: n }` when
 * it only compares: "using 2 different resource types" is `atLeast(paidTypeCount(), 2)`).
 *
 * `of`: another card's play, for "used to pay for that event" in an "after you play" response
 * (`paidTypeCount(eventTarget)`), whose card carries `constant(readsPaymentTypesOf(…))`.
 */
export const paidTypeCount = (of?: TargetRef): ValueSpec => ({
  kind: "paidTypeCount",
  ...(of !== undefined ? { of } : {}),
});
/**
 * "If you paid for this event using at least 1 [physical] resource" on a card that reads several named types of one
 * payment (Multitalented 47021; docs/phase7-wave8.md §3.62): a paid resource was that type, or a paid wild was
 * declared as it. A wild left a wild is none of the three, and an overpaid resource was not paid. The ability carries
 * `readsPaidTypes: { types: [...] }` naming every type it reads. For a card that reads one type alone, `paidWith`
 * (under which a wild counts as any type) is unchanged. `of` as for `paidTypeCount`.
 */
export const paidType = (resource: TypedResource, of?: TargetRef): Predicate => ({
  kind: "paidType",
  resource,
  ...(of !== undefined ? { of } : {}),
});
/**
 * Some player `player` names could make a basic attack or thwart among `powers` right now on a card's instruction
 * (engine `canUseBasicPower`, docs/phase7-wave8.md §3.64): a ready hero-form identity or ally of theirs has a legal
 * target, read as `basicPowerBy` will offer it. `canUseBasicPower(["attack", "thwart"], eachPlayer)` is the condition
 * of an ability that chooses the player as a cost; `playersWhere(canUseBasicPower([...], thatPlayer))` is the players
 * who can, for `choosePlayer(slot, you, { among })`.
 */
export const canUseBasicPower = (powers: readonly ("attack" | "thwart")[], player: PlayerRef = you): Predicate => ({
  kind: "canUseBasicPower",
  player,
  powers,
});
/**
 * `player` could pay `spendResources(resources, …, player, { distinctTypes })` right now, from the hand cards and
 * resource abilities that spend would offer them, priced as the spend prices it (engine `canPayResources`). Gates an
 * option on the payment: `option("Spend …", { when: canPayResources({ energy: 1 }) }, spendResources({ energy: 1 },
 * "spent"))`. RRG 1.8 "Choose (Option)" (p. 12) bars a player card's option with "a cost the player cannot pay"; an
 * encounter card's spend option uses it by the pending default Q51 (docs/phase7-wave6.md §3.69).
 */
export const canPayResources = (
  resources: ResourceRequirement,
  player: PlayerRef = you,
  opts: { readonly distinctTypes?: number } = {},
): Predicate => ({
  kind: "canPayResources",
  player,
  resources,
  ...(opts.distinctTypes !== undefined ? { distinctTypes: opts.distinctTypes } : {}),
});
/**
 * Threat can be removed from at least one scheme `scheme` names by this card, in a removal that is not a thwart: no
 * crisis icon (unless `ignoreCrisis`) and no "threat cannot be removed" rule stops it (engine `canRemoveThreatFrom`).
 * Gates an ability whose payment stands between choosing the scheme and the removal, which the engine cannot judge at
 * initiation: `{ while: canRemoveThreatFrom(each(query("scheme", { hasThreat: true }))) }` (Blackout, `deadpool`
 * 44053). An ability that opens with its choice and removal, or a `moveThreat`, needs no gate: the engine judges it.
 */
export const canRemoveThreatFrom = (scheme: TargetRef, opts: { readonly ignoreCrisis?: boolean } = {}): Predicate => ({
  kind: "canRemoveThreatFrom",
  scheme,
  ...(opts.ignoreCrisis ? { ignoreCrisis: true as const } : {}),
});
/**
 * `player` could pay `spendDifferentResources(count, …)`: `count` resources of `count` different types (a wild being
 * any one type). Director's Directions (`mojo` 39033), pending default Q51: `option("Spend 2 different resources",
 * { when: canSpendDifferentResources(2) }, spendDifferentResources(2, "spent"))`.
 */
export const canSpendDifferentResources = (count: number, player: PlayerRef = you): Predicate =>
  canPayResources({ generic: count }, player, { distinctTypes: count });
export const varAtLeast = (name: string, n = 1): Predicate => ({ kind: "varAtLeast", name, amount: n });
/**
 * A fact from outside the game that `player`'s seat supplied at setup (docs/phase7-wave7.md §3.83); absent is false.
 * "If you did not win your previous game of Marvel Champions" is `not(outsideFact("wonPreviousGame"))`.
 */
export const outsideFact = (fact: SetupOutsideFact, player: PlayerRef = you): Predicate => ({
  kind: "outsideFact",
  fact,
  player,
});
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
 * The face that is up has this title: a villain's side, a flipped encounter card's face, or an identity's face
 * ("When Revealed (Face Name)", docs/phase7-wave1.md §3.3). A title names one face only (RRG 1.8 "Identity", p. 23).
 */
export const faceNamed = (of: TargetRef, name: string): Predicate => ({ kind: "faceNamed", of, name });
/** "If you are [Archangel]" / "in [Archangel] form" (docs/phase7-wave7.md §3.62): your identity's face showing. */
export const youAreNamed = (name: string): Predicate => faceNamed(yourIdentity, name);
/**
 * The scheme a thwart thwarted, as its results report it: `thwartTarget()` is slot `thwart.target` on an ally's
 * consequential damage (`takesConsequentialDamage`'s `if`: "takes -1 consequential damage after thwarting a side
 * scheme", Uncanny X-Force, `next_evol` 40022, is `refMatches(thwartTarget(), query("sideScheme"), { anywhere: true
 * })`), and `thwartTarget(bind)` is `<bind>.target` after a `thwart` effect with that `bind`. A thwart divided across
 * schemes names every one of them. Read it `anywhere`: a side scheme the thwart defeated has left play. The attack's
 * counterpart is `attackTarget`.
 */
export const thwartTarget = (bind = "thwart"): TargetRef => ({ kind: "slot", slot: `${bind}.target` });
/**
 * The character an attack attacked, damaged or not: slot `attack.target` on an ally's consequential damage ("when
 * attacking attached minion", Coordinated Attack, `cyclops` 33016), or `<bind>.target` after an `attack` effect with
 * that `bind`. Read it `anywhere` when the attack may have defeated it.
 */
export const attackTarget = (bind = "attack"): TargetRef => ({ kind: "slot", slot: `${bind}.target` });
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
/**
 * "…add X-23's **matching** power…" (Sisterly Bond 43007): the basic power being used is (one of) these, read off the
 * `basicPowerUsing` event the ability interrupts (the one `modifyBasicPower` reads), so an interrupt to "thwarts or
 * attacks" can give `modifyBasicPower` the matching stat: `ifThen(basicPowerIs("thwart"), modifyBasicPower(statOf(X,
 * "thw")), modifyBasicPower(statOf(X, "atk")))`. False outside a basic-power use.
 */
export const basicPowerIs = (...power: readonly BasicPowerName[]): Predicate => ({
  kind: "basicPowerIs",
  power: power.length === 1 ? power[0]! : power,
});
/** A result of the triggering event ("if this attack dealt damage" → `eventDealt("damage")`). */
export const eventDealt = (key: string, n = 1): Predicate => ({ kind: "eventResultAtLeast", key, amount: n });
/**
 * "If your identity takes any amount of damage from that attack" → `eventDamageTaken(each(YOUR_IDENTITY))`: the triggering
 * attack/activation's damage actually taken by `of` (indirect shares and overkill spill included, prevented damage
 * not), read at its end (`atEndOfAttack`) or in its response window (docs/phase7-wave5.md §4.1 Q65).
 */
export const eventDamageTaken = (of: TargetRef, n = 1): Predicate => ({
  kind: "eventDamageTakenAtLeast",
  of,
  amount: n,
});
/**
 * In a When Defeated / "after X is defeated" ability: the excess damage the defeat recorded, the damage past the
 * character's remaining hit points from whatever damage defeated it (docs/phase7-wave5.md §4.1 Q68). 0 when exactly
 * lethal or defeated by a non-damage effect.
 */
export const defeatExcessDamage: ValueSpec = { kind: "defeatExcessDamage" };
/** "If this minion was defeated with excess damage" (Shifting Apparition, `sm` 27091). */
export const defeatedWithExcessDamage: Predicate = valueAtLeast(defeatExcessDamage, 1);
/**
 * "If she was defeated by taking excess consequential damage" (SP//dr, `spiderham` 30021): excess damage (RRG 1.8
 * "Excess Damage", p. 19) from an ally's own consequential damage (RRG 1.8 "Consequential Damage", p. 13), whether it
 * followed an attack or a thwart. Exactly lethal consequential damage, or excess from any other damage, is not.
 */
export const defeatedWithExcessConsequentialDamage: Predicate = valueAtLeast(
  { kind: "defeatExcessDamage", consequential: true },
  1,
);
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
 * The mode of play (docs/phase7-wave5.md §3.11). "In expert mode, this card gains surge and cannot be canceled"
 * (Surprise!, `sm` 27112) is `constant(gainsKeyword({ name: "surge" }, { self: true }, { while: inMode("expert") }),
 * cannotBeCanceled({ self: true }, inMode("expert")))` — an encounter card's own grants apply while it is revealed;
 * "(In expert mode, place 2 threat …)" is `ifThen(inMode("expert"), …)`.
 */
export const inMode = (mode: "standard" | "expert"): Predicate => ({ kind: "inMode", mode });
/**
 * "X is equal to Ironheart's [Version] number" (`ironheart`; docs/phase7-wave5.md §3.23): `traitNumber(yourIdentity,
 * "Version")` reads "VERSION 2" as 2 (from the printed hero face while in alter-ego form).
 */
export const traitNumber = (of: TargetRef, prefix: string): ValueSpec => ({ kind: "traitNumber", of, prefix });
/**
 * "For each resource generated by SP//dr Suit's 'Sync Ratio' ability to pay for her" (VEN#m, `spdr` 31017;
 * docs/phase7-wave5.md §3.16): how much of this card's payment the named resource ability generated, read by the
 * card's own abilities (the `paid.*` vars). `abilityId` is the resource ability's id in the registry.
 */
export const resourcesPaidBy = (abilityId: string): ValueSpec => ({ kind: "var", name: `paid.ability.${abilityId}` });
/** "If you paid for this card using a resource generated by SP//dr Suit's 'Sync Ratio' ability" (Rapid Deployment). */
export const paidUsingResourceFrom = (abilityId: string): Predicate => ({
  kind: "compare",
  left: resourcesPaidBy(abilityId),
  op: "atLeast",
  right: { kind: "const", value: 1 },
});
/**
 * "If this is the first attack this turn" (Venom III, `sm` 27075; docs/phase7-wave5.md §3.12), read in the response
 * to that attack: true when it is the only attack this turn matching `against` (its target) and `by` (its attacker).
 * With neither, every attack of the turn counts (§4 Q16's default); `{ against: { self: true } }` counts only attacks
 * on this card.
 */
export const firstAttackThisTurn = (
  opts: { readonly against?: TargetQuery; readonly by?: TargetQuery } = {},
): Predicate => ({
  kind: "firstAttackThisTurn",
  ...(opts.against ? { against: opts.against } : {}),
  ...(opts.by ? { by: opts.by } : {}),
});
/**
 * "If your hero attacked … this phase" / "… thwarted this phase" (Psychic Inertia, `next_evol` 40173;
 * docs/phase7-wave7.md §3.36, §4.1 Q23): a character matching `character` made an attack, or a thwart, since the
 * phase began, basic or by a labeled ability. "Attacked and thwarted" is `allOf` the two. Ask "your hero" as your
 * identity (`query("identity", { controlledBy: you })`): the record is of the identity card, whatever form it shows
 * now. The player phase is one phase across every player's turn.
 */
export const characterDidThisPhase = (character: TargetQuery, did: "attack" | "thwart"): Predicate => ({
  kind: "characterDidThisPhase",
  character,
  did,
});
/**
 * "If all the players at this stage are defeated" (Kang's stage 3 cards, docs/phase7-wave2.md §3.1): every player
 * in this effect's own game area is defeated (eliminated). False outside a separate game area.
 */
export const areaPlayersDefeated: Predicate = { kind: "areaPlayersDefeated" };
/** "During step one of the villain phase". */
export const duringVillainPhaseStepOne: Predicate = { kind: "gameStep", phase: "villain", step: "placeThreat" };
/**
 * "During your turn" (The Merc with the Mouth, `deadpool` 44032): a player turn is in progress and `player` (default
 * `you`) is the active player (RRG 1.8 "Active Player", p. 6). As a rule's `while`, "you" is the rule's speaker.
 */
export const duringTurnOf = (player: PlayerRef = { kind: "controller" }): Predicate => ({ kind: "turnOf", player });
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
 * discarded to pay its own cost). `types` narrows to some icon types; absent counts all four, wild included. Over the
 * cards an ability discarded from a deck (a `moveCards` bind, a `discardFromDeckSlot` cost), an icon counts as often as
 * a `deckDiscardIconsCount` rule says (docs/phase7-wave7.md §3.56).
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
 * "If you have played another card this phase" (Mulligan, `deadpool` 44048): at least `atLeast` (default 1) of the
 * cards `player` played this phase match `cards`, wherever those cards are now. Unlike `playedThisTurn` it outlasts
 * the turn: the player phase is one phase (RRG 1.8 "Player Phase", p. 34), and an Action event may be played during
 * another player's turn. As a `playOnlyIf` it is read before the card's own play is recorded.
 */
export const playedThisPhase = (
  cards: TargetQuery,
  opts: { player?: PlayerRef; atLeast?: number } = {},
): Predicate => ({
  kind: "playedThisPhase",
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
