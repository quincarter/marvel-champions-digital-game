import type { CardId, Trait } from "@mc/content";
/**
 * When a lasting effect ends: "until the end of the phase" / "…of the round" / "…of this attack" / "…of this turn".
 *
 * `endOfTurn` (docs/phase7-wave2.md §13): the active player's turn, which is shorter than the player phase once several
 * players take turns inside it (RRG 1.8 "Player Phase", p. 34: "each player (in player order) takes one turn"). It
 * expires the moment that turn ends. Created while no turn is in progress it is not created at all — RRG 1.8 "Lasting
 * Effects" (p. 26): "A lasting effect that expires at the end of a specified time period can only be initiated during
 * that time period."
 */
export type LastingUntil = "endOfPhase" | "endOfRound" | "endOfAttack" | "endOfTurn";
// Type-only, and the only reference spec.ts makes to `abilities.ts` (which imports types back from here):
// `EffectSpec applyRuleUntil` carries the same `RuleSpec` union a constant ability's own `rules` do, so a
// restriction is written once whether a card in play or a lasting effect imposes it (docs/phase7-wave2.md §22).
import type { EventPattern, RuleSpec } from "./abilities.js";
// Type-only, and erased at compile time, so the cycle with `campaign.ts` (which names `EffectSpec` and friends) is
// only in the type graph: the campaign *vocabulary* is data, and the campaign *primitives* are effects.
import type { CampaignLogValueSpec, LogWriteMode } from "./campaign.js";
import type { PlayerId } from "./ids.js";
import type { ResourceRequirement, TypedResource } from "./resources.js";
import type { FacedownRole, Form, GameStep } from "./state.js";

/**
 * The executable effect vocabulary. The Phase 2 ability DSL compiles down to
 * these; the stack knows how to run them and nothing else. Everything here is
 * plain JSON so an ability definition can be inspected, logged, and replayed.
 */

/**
 * The keywords that belong to an *attack* rather than to a character (RRG 1.8 "Piercing", p. 32; "Ranged", p. 35;
 * "Overkill", p. 31). Each is defined as "an attack with the … keyword", so a card may grant one to a single attack
 * without granting it to the attacker: "this attack gains piercing" (Piercing Strike, Vibranium Arrow), "the attack
 * gains piercing" (Crossfire's boost), "each of your [Arrow] attacks gain ranged" (Hawkeye's Bow).
 *
 * Three ways to grant one, all read through the same check when the attack deals its damage
 * (`attackHasKeyword`, `keywords.ts`), so they compose:
 * - the attacker's own printed or granted keyword (the character case, unchanged);
 * - `attack.keywords` / `modifyAttack.keywords`, this activation only;
 * - a constant `RuleSpec attackKeywords`, which matches on the attacker and/or the card making the attack.
 */
export type AttackKeyword = "piercing" | "ranged" | "overkill";

/** Card categories a target query can filter on. Broader than `AnyCard["type"]` on purpose. */
export type TargetCategory =
  | "character"
  | "enemy"
  | "villain"
  | "minion"
  | "ally"
  | "hero"
  | "alterEgo"
  | "identity"
  | "scheme"
  | "mainScheme"
  | "sideScheme"
  | "upgrade"
  | "support"
  | "attachment"
  | "event"
  | "resource"
  | "treachery"
  | "obligation"
  | "environment";

/** A data filter over card instances. `chooseTarget` and constant modifiers both use it. */
export interface TargetQuery {
  readonly categories?: readonly TargetCategory[];
  /** "you" = the ability's controller, "other" = any other player, "encounter" = no controller. */
  readonly controller?: "you" | "other" | "any" | "encounter";
  readonly engagedWith?: "you" | "any";
  readonly trait?: Trait;
  /**
   * Excludes cards that carry this trait (printed or granted): "an Avenger ally" pairs with `trait`, while "if
   * each of your allies has the Avenger trait" (Avengers Tower, `cap` pack) needs its negation — `not(exists(query(
   * "ally", { controller: "you", withoutTrait: AVENGER })))`, i.e. no ally lacks it. New for wave 1: no Core card
   * needed a negative trait filter.
   */
  readonly withoutTrait?: Trait;
  /**
   * At least one of these traits (printed or granted): "an Attack, Thwart, or Defense event" (Morphogenetics, `msm`
   * pack). An OR of traits, where `trait` is a single one. An empty list matches nothing (`@mc/cards`' validator
   * rejects it).
   */
  readonly anyTrait?: readonly Trait[];
  /** Exact printed card name ("the Breakin' & Takin' side scheme", "the Ultron Drones environment"). */
  readonly name?: string;
  /**
   * The exact printed card, by id — for the rare case `name` cannot disambiguate: MC16's Campaign Challenge side
   * schemes print the *same* title on both faces (16178a/16178b "Badoon Blitz", …; docs/phase7-wave3.md §1.4 emits
   * each face as its own card, precisely so this field can tell them apart), and a campaign instruction reveals
   * one specific face by mode, not "a card named X". Prefer `name` wherever it alone is unambiguous — this is for
   * card data's own edge case, not a general substitute for it.
   */
  readonly printedId?: CardId;
  /** The card this card is attached to (true) or anything else (false): "When attached minion is defeated". */
  readonly hostOfSelf?: boolean;
  /**
   * The card is attached to one of the cards this ref names: "exhaust a Weapon upgrade **on your hero**" (Mean
   * Swing, `thor` pack) → `query("upgrade", { trait: WEAPON, host: yourIdentity })`. The mirror of `hostOfSelf`,
   * which asks whether a candidate *is* this card's own host; `host` asks what a candidate is attached *to*, and so
   * works on a card (an event) that is not itself an attachment. An unattached card never matches.
   */
  readonly host?: TargetRef;
  /**
   * The card has at least one card attached to it that matches this query: "When an ally **with a weapon attachment
   * upgrade** makes an attack" (Target Practice, `stld` 17017) is `{ categories: ["ally"], hasAttachment: {
   * categories: ["upgrade"], trait: WEAPON } }`; "the identity the Power Stone is attached to" is `{ categories:
   * ["identity"], hasAttachment: { name: "Power Stone" } }`. The other direction of `host`, which asks what the
   * candidate is attached *to*; this asks what is attached to the candidate. The inner query is read in the same
   * context as the outer one, so its `self`/`you` mean what they mean here. docs/phase7-wave3.md §3.40.
   */
  readonly hasAttachment?: TargetQuery;
  /** In play facedown as something else ("each facedown Drone minion"). */
  readonly facedown?: boolean;
  /**
   * The card's boost area prints a star icon (★), or does not: "If that card has a star icon (★) in the boost area,
   * defeat the attacked minion" (Longshot 35033, `wolv`) is `{ starIcon: true }` over the discarded card.
   *
   * The same printed fact `ValueSpec starIcons` counts, asked as a yes/no (`hasStarIcon`): read from
   * `@mc/content`'s `starIcon` field, not from whether a `boost`-triggered ability is scripted (§18.6). A card with
   * no boost area — any player card — never matches `true`. RRG 1.8 "Boost, Boost Icon" (p. 11): a star is not a
   * boost icon, so this says nothing about the card's pip count.
   */
  readonly starIcon?: boolean;
  /**
   * The card carries the unique (⬡) icon: "against a unique enemy" (Godslayer, `gam` 18018), the printed fact
   * `isUnique` (`unique.ts`) already reads for the deckbuilding unique rule — every hero identity is unique whether
   * or not its own card prints the icon (RRG 1.8 "Unique", p. 46). docs/phase7-wave3.md §3.26.
   */
  readonly unique?: boolean;
  /** Cards with at least one printed icon of this resource type ("each card with a printed [mental] resource"). Wild is its own type. */
  readonly printedResource?: "physical" | "mental" | "energy" | "wild";
  /**
   * Cards with at least one printed icon of **any** of these resource types: "discard a [mental] or a [physical]
   * resource from your hand, if able" (Tombstone, `gob` pack) → `{ anyPrintedResource: ["mental", "physical"] }`.
   * The OR that `printedResource` (exactly one type) can't say, the way `anyTrait` is to `trait`; the two are ANDed if
   * both are given. Printed icons only (ruling, Jan 11, 2026 (3): a "printed resource" is the bottom-left icon), and
   * a wild icon matches only `"wild"`: RRG 1.8 "Wild Resource" (p. 48), "When resources are not being generated for a
   * cost, a wild resource does not have any characteristic other than 'wild resource'".
   */
  readonly anyPrintedResource?: readonly ("physical" | "mental" | "energy" | "wild")[];
  /** The card's owner is the ability's controller ("your discard pile" cards, "cards you own"). */
  readonly owner?: "you";
  /** Player-card aspect, e.g. "aggression" ("while paying for an Aggression card"). */
  readonly aspect?: string;
  /**
   * At least one of these aspects: "an aspect card" (Finesse 04033, Jessica Drew's Apartment 04034) is the OR of the
   * four — `["aggression", "justice", "leadership", "protection"]` — which `aspect` (exactly one) cannot say, the way
   * `anyTrait` is to `trait`. Matches `printedAspect` as well as `aspect` for the same reason `aspect` does
   * (§1.2: Spider-Woman's signature cards print an aspect but belong to her set). ANDed with `aspect` if both are
   * given. An empty list matches nothing.
   */
  readonly anyAspect?: readonly string[];
  readonly exhausted?: boolean;
  readonly hasThreat?: boolean;
  readonly damaged?: boolean;
  readonly hasStatus?: "stunned" | "confused" | "tough";
  /**
   * The character has at least one status card of any type (true), or none at all (false): "choose a status card in
   * play" (Vapors of Valtorr, `drs` pack) is a choice among the characters that have one. An OR over the three
   * status types, which `hasStatus` — exactly one type — cannot say. Both may be given at once (`hasStatus:
   * "stunned"` narrows further); they are ANDed like every other field.
   */
  readonly hasAnyStatus?: boolean;
  /** Restrict to (or exclude) the ability's own card. */
  readonly self?: boolean;
  readonly maxPrintedHp?: number;
  /**
   * Printed resource cost at most this much (events print none, read as 0): "an Avenger ally from your hand with
   * printed cost equal to or less than the number of time counters on Quinjet" (`cap` pack) — a `ValueSpec` bound
   * re-read every check, unlike `maxPrintedHp`'s fixed number, since "the number of time counters on Quinjet"
   * changes over the game.
   */
  readonly maxPrintedCost?: number | ValueSpec;
  /** Only enemies this character is allowed to attack right now (RRG "Guard"). */
  readonly attackableBy?: TargetRef;
  /**
   * The mirror of `attackableBy`: only characters that could attack, right now, at least one *other* card in play this
   * query matches (`canAttack`, so a `cannotAttack` rule counts and guard does not bind an enemy). "Choose a minion.
   * That minion attacks another enemy of your choice" (Moondragon, `drax` 19013) is `{ canAttackOneOf: { categories:
   * ["enemy"] } }` on the minion choice: a minion with no other enemy to attack is not a valid target, because nothing
   * in the ability could affect it (RRG 1.8 "Target", pp. 42–43; docs/phase7-wave3.md §3.23).
   */
  readonly canAttackOneOf?: TargetQuery;
  /** Excludes cards already bound to these slots: "remove 2 threat from a *different* scheme". */
  readonly excludeSlots?: readonly string[];
  /**
   * Excludes whatever this ref names: "discard each **other** environment card in play" (None Shall Pass 1A) is
   * `query("environment", { excluding: eventTarget })` on an ability triggered by one entering. `self: false`
   * already excludes the ability's *own* card; this excludes a card the ability names some other way (the
   * triggering event's subject, a slot an earlier step bound, the host).
   */
  readonly excluding?: TargetRef;
  /** Only cards already bound to this slot: a choice among candidates an earlier step narrowed (tied villains). */
  readonly inSlot?: string;
  /** Controlled by one of these players: "each character *that player* controls" (a chosen player). */
  readonly controlledBy?: PlayerRef;
  /** Engaged with one of these players: "each enemy engaged with *that player*". */
  readonly engagedWithPlayer?: PlayerRef;
  /** A villain's signature side scheme (true) or any other card (false): The Wrecking Crew insert, "Signature Side Schemes". */
  readonly signatureSideScheme?: boolean;
  /**
   * A card of this player's identity set: "a Ms. Marvel card" (Teen Spirit), "a Doctor Strange card" (Mystical
   * Studies). RRG 1.8 "Identity-Specific Card" (p. 23) — the set icon, which the card data carries as
   * `aspect: "hero:<identity card id>"`. Player cards only: the identity card itself is not a card of its own set,
   * and nemesis cards are encounter cards (ruling, Jun 25, 2026 (4): "Nemesis sets belong to that identity", which
   * is about set ownership, not about these deckbuilding filters).
   */
  readonly identitySetOf?: PlayerRef;
  /**
   * The minion of this player's own nemesis set: "each player searches the encounter deck, discard pile, and
   * set-aside area for **their** nemesis minion" (Kang's Wrath 4B, 11013), "search … for **your** nemesis minion"
   * (The Hood's Ambush; Face the Past, `magneto`), "reveal **your** set-aside nemesis minion" (Advance, Core).
   *
   * RRG 1.8 "Nemesis Encounter Set" (p. 30): "An identity's 'nemesis minion' is the minion belonging to that
   * identity's nemesis set. If a nemesis set has multiple minions in it, the 'nemesis minion' is designated by
   * parenthetical text printed on one or more of those minions." Both halves are checked: the card carries the
   * parenthetical (`MinionCard.nemesisMinion`) **and** belongs to an encounter set that is this player's identity's
   * own `nemesisEncounterSetId`.
   *
   * Unlike `identitySetOf` (player cards, read off the set icon in `aspect`), a nemesis set is encounter-side, which
   * is why it needs its own field rather than a wider `identitySetOf` — see the same ruling's set-ownership note
   * (Jun 25, 2026 (4)). Matches wherever the card is: in play, in a deck, in a discard pile or set aside.
   */
  readonly nemesisMinionOf?: PlayerRef;
  /**
   * The card has at least one trait in common with the cards this ref names: "play a card from your hand **that
   * shares a trait with your hero**" (Team-Building Exercise, `ant` 12024) is `{ sharesTraitWith: identityOf(you) }`.
   *
   * `trait`/`anyTrait` name traits the *script* fixes; this one is whatever traits another card happens to have right
   * now, which a generic basic-aspect card played by any hero cannot hardcode. Both sides are read live through
   * `traitsOf`, so a granted trait counts on either end (RRG 1.8 "Gains", p. 21) — with the same `DEFAULT_DEPS` guard
   * §17.5 put on a constant trait grant's own condition, which is what stops a grant whose target uses this field
   * from re-entering the trait scan.
   *
   * A ref that names nothing, or names only cards with no traits, matches nothing: there is no trait to share.
   * docs/phase7-wave2.md §20.1.
   */
  readonly sharesTraitWith?: TargetRef;
  /**
   * The card belongs to an encounter set that the cards this ref names belong to: "discard cards from the encounter
   * deck until a card from the **Ant-Man Nemesis set** is discarded" (Yellowjacket's Plan, `ant` 12029) is
   * `{ encounterSetOf: self }` — the card doing the searching is itself in that set, which is how every printed
   * "a card from the <X> set" in cycle 1 is worded (the card naming the set is always a member of it).
   *
   * Reads `encounterSetIds` off the card data, so it matches wherever the card is (in an encounter deck, a discard
   * pile, set aside, in play). A player card, or an encounter card belonging to no set, never matches.
   *
   * The sibling of `nemesisMinionOf`, which asks a narrower question (that player's nemesis set, *and* the
   * parenthetical) through the same `encounterSetIds` field. docs/phase7-wave2.md §20.2.
   */
  readonly encounterSetOf?: TargetRef;
  /**
   * The card's title is recorded in this campaign-log field: "Shuffle each EXPERIMENTAL attachment **recorded in the
   * campaign log** into the encounter deck" (MC10 p. 7) as a *filter*, where the `campaignLog` `CardSelector` is the
   * same fact as a *pool*. `seat` reads a per-seat field (MC10 p. 10's rescued allies); absent reads the shared one.
   *
   * Read from the frozen `GameState.campaign.log` snapshot (design §7.1), never from storage, so it is a fact about
   * card *data* — it matches wherever the card is, and a game with no campaign input matches nothing.
   */
  readonly inCampaignLogField?: { readonly field: string; readonly seat?: PlayerRef };
  /**
   * The character is named by one of these names (docs/phase7-wave3.md §3.34): "Ready Cyclops and Phoenix", "Heal 3
   * damage each from Gwen Stacy and Miles Morales", "Place 2 growth counters on Groot" (the Team-Up cards). An identity
   * matches by the title on its faceup side, any other character by its title or subtitle (RRG 1.8 "Team-Up", p. 43;
   * "Identity", p. 23; `titles.ts`). Whoever controls it — pair with `categories: ["identity", "ally"]` for "friendly".
   */
  readonly titled?: CharacterNames;
  /**
   * The card belongs to the identity-specific set of an identity card named by one of these names, whoever controls
   * it: "a Rocket Raccoon upgrade" (Flora and Fauna), "a Cyclops card from your discard pile" (Psychic Rapport). RRG 1.8
   * "Identity-Specific Card" (p. 23): a card of an identity's "set of accompanying cards", its set icon, which the data
   * carries as `aspect: "hero:<identity card id>"`. Unlike `identitySetOf` (a *player's* identity), this names the
   * identity itself, so a Team-Up card in either player's hand finds the same cards. Docs/phase7-wave3.md §3.34.
   */
  readonly identitySetTitled?: CharacterNames;
}

/**
 * Character names as a card prints them (docs/phase7-wave3.md §3.34). `names` is written out; `teamUpOf` reads them
 * from the Team-Up keyword of the card(s) the ref names (`self` for the Team-Up card itself), so a script never
 * hard-codes a name its card data already carries. `index` picks one of the keyword's two names (0 or 1): "Place 2
 * growth counters on **Groot**" is name 0 of "Team-Up (Groot and Rocket Raccoon)". A name "Hero/Alter-ego" ("Black
 * Panther/T'Challa") names one identity card by both sides (`titles.ts`).
 */
export type CharacterNames =
  | { readonly names: readonly string[] }
  | { readonly teamUpOf: TargetRef; readonly index?: 0 | 1 };

/** Names one instance without knowing its id at authoring time. */
export type TargetRef =
  | { readonly kind: "self" }
  /** The card this card is attached to ("attached minion", "that enemy" on Webbed Up). */
  | { readonly kind: "host" }
  /** Every card in play matching the query: "each enemy", "each friendly character", "each hero". */
  | { readonly kind: "each"; readonly query: TargetQuery }
  /** The card in play with this exact printed name ("Bomb Scare", "the Legions of Hydra side scheme"). */
  | { readonly kind: "named"; readonly name: string }
  | { readonly kind: "slot"; readonly slot: string }
  | { readonly kind: "eventSource" }
  | { readonly kind: "eventTarget" }
  /**
   * "The defending character" (Energy Projectiles' boost, 07027: "Deal 1 damage to the defending character"): the
   * character declared as the defender of the innermost enemy attack on the stack, whether by a basic defense or a
   * "(defense)" ability, while it is still in play. Read from the stack rather than the triggering event because a
   * Boost ability resolves with no event in context, and it keeps working in that attack's "after it attacks" and
   * deferred "after you defend" windows. Empty for an undefended attack, outside an enemy attack (a scheme
   * activation, a player attack), and once the defender has left play: RRG 1.8 "Defend, Defense" (p. 16), "if a
   * defending ally is defeated before damage from the attack is dealt (such as through a 'Boost' ability), the
   * attack is considered undefended".
   */
  | { readonly kind: "defendingCharacter" }
  /**
   * "The villain": the active villain (The Wrecking Crew insert, "The Active Villain": "Any card effect that refers
   * to 'the villain' only refers to the active villain."). "A villain" is `each`/`chooseTarget` over the
   * `villain` category, which matches every villain in play.
   */
  | { readonly kind: "villain" }
  /**
   * "The main scheme": in a separate game area, that area's own stage; `of: "central"` is the central stage outside
   * every area ("place 1 set-aside Kang's Dominion facedown under stage 4A"; docs/phase7-wave2.md §3.1).
   */
  | { readonly kind: "mainScheme"; readonly of?: "central" }
  | { readonly kind: "identityOf"; readonly player: PlayerRef }
  /** "The villain corresponding to the attached side scheme" (Held Hostage): each undefeated villain whose signature side scheme the ref names. */
  | { readonly kind: "villainOfSideScheme"; readonly scheme: TargetRef }
  /** "His side scheme" / "his corresponding side scheme" (Radioactive Buildup): each named villain's signature side scheme, while in play. */
  | { readonly kind: "signatureSideSchemeOf"; readonly villain: TargetRef }
  /** "Each card attached here" / "the cards attached to that character" (Bruno Carrelli), in attachment order. */
  | { readonly kind: "attachmentsOf"; readonly of: TargetRef; readonly filter?: TargetQuery }
  /**
   * "Each face down Kang's Dominion under this stage" (Kang's Wrath 4A, 11013a): the cards tucked under what `of`
   * names, in tuck order. The `TargetRef` sibling of the `tucked` `CardSelector`, so an effect that takes a ref —
   * `revealCard` above all — can name them. Tucked cards are out of play (RRG 1.8 "Tuck", p. 45), which is exactly
   * why a ref is needed: nothing that scans cards *in play* will find them.
   */
  | { readonly kind: "tuckedUnder"; readonly of: TargetRef; readonly filter?: TargetQuery }
  /**
   * "The X with the highest/lowest Y": the hero with the fewest hit points remaining (Mad Genius), the enemy with
   * the highest ATK (Clash of the Titans), the villain whose side scheme has the most threat (Get Wrecked!), the
   * highest printed cost among cards in hand (Burn Notice).
   *
   * `among` is the pool — `{ kind: "each", query }` for cards in play, or a slot an earlier `selectCards` bound for
   * cards out of play. `measure` is evaluated once per candidate with that candidate bound to `slot` (default
   * `"candidate"`), so any `ValueSpec` can be the measure, including one that reads another card ("the villain
   * *whose side scheme* has the most threat").
   *
   * **Ties resolve to every tied card** (`ties: "all"`, the default), because a ref is resolved without asking
   * anyone. An effect that needs exactly one must break the tie itself: bind this ref with `bindTargets`, then
   * `chooseTarget` over `{ inSlot }` — `chooser: firstPlayer` on an encounter card, which carries
   * `firstPlayerTargets` authority (RRG 1.8 "First Player", p. 19), or `chooser: controller` on a player card.
   * `ties: "first"` takes the first candidate in the pool's stable order, for a card whose text makes the choice
   * irrelevant.
   */
  | {
      readonly kind: "superlative";
      readonly among: TargetRef;
      readonly order: "highest" | "lowest";
      readonly measure: ValueSpec;
      readonly slot?: string;
      readonly ties?: "all" | "first";
    };

export type PlayerRef =
  | { readonly kind: "controller" }
  | { readonly kind: "eventPlayer" }
  | { readonly kind: "firstPlayer" }
  | { readonly kind: "each" }
  | { readonly kind: "id"; readonly playerId: PlayerId }
  /** The player(s) picked by `choosePlayer` into this slot ("choose a player. That player …"). */
  | { readonly kind: "slot"; readonly slot: string }
  /** "That player" inside `forEachPlayer`. */
  | { readonly kind: "scoped" }
  /** The owner of a card ("return each card to its owner's hand"). */
  | { readonly kind: "ownerOf"; readonly target: TargetRef }
  /** Every player except these: "each other hero" (Whirlwind). */
  | { readonly kind: "others"; readonly of: PlayerRef }
  /** The player a card is engaged with: "the engaged player" on a minion's own ability. */
  | { readonly kind: "engagedWith"; readonly of: TargetRef }
  /**
   * The player(s) who control the cards the ref names, in player order: "the player who controls that identity", "a
   * player who controls a [Web-Warrior] character" (a query ref, then `choosePlayer { among }` to pick one), and "the
   * player who controls the Power Stone" (Single-Minded Fury, `gmw` 16114), which names the identity the stone is
   * attached to: `controllerOf(each({ categories: ["identity"], hasAttachment: { name: "Power Stone" } }))`.
   *
   * RRG 1.8 "Ownership and Control" (p. 31): a player controls their identity and the player cards in their play
   * area; "Encounter cards are considered to be under the control of the scenario". So a card no player controls (a
   * minion, an encounter attachment, the villain) names nobody, and an effect aimed at nobody does nothing — the
   * Power Stone on the villain gives Single-Minded Fury no player to attack. Not `ownerOf`, which reads who brought
   * the card into the game and differs once control changes hands. docs/phase7-wave3.md §3.39.
   */
  | { readonly kind: "controllerOf"; readonly target: TargetRef }
  /**
   * "The player who defeated this scheme" (Crossbones' Assault 04070) / "the defeating player" (Mystique's
   * Manipulations, errata RRG 1.8 p. 66): the defeating player recorded on the `schemeDefeated` or
   * `characterDefeated` event in context. Unlike an `on.defeated({ byYou: true })` trigger filter, which is a yes/no
   * gate, this hands the player back as a value a later effect can use. Empty outside a defeat, and for a defeat no
   * player caused (an encounter card's own effect).
   */
  | { readonly kind: "defeatingPlayer" }
  /**
   * "The player who is engaged with the fewest minions" (Drang III, `gmw` 16060), "the player with the most threat
   * on their side schemes", "the hero with the fewest remaining hit points" read as a player: the `TargetRef
   * superlative` for players (docs/phase7-wave3.md §3.35). `measure` is evaluated once per player in `among` (default:
   * each player), with that player as the scoped player — `PlayerRef scoped` (DSL `thatPlayer`) — so "engaged with
   * the fewest minions" is `count({ categories: ["minion"], engagedWithPlayer: { kind: "scoped" } })`.
   *
   * It is read fresh every time the ref is resolved, so "each time a minion is discarded this way, put it into play
   * engaged with the player who is engaged with the fewest minions" re-ranks the players for each minion.
   *
   * **Ties resolve to every tied player** (`ties: "all"`, the default), as the card superlative does: a ref is
   * resolved without asking anyone. An effect that needs one player breaks the tie with `choosePlayer { among }`:
   * RRG 1.8 "First Player" (p. 19), "If an encounter card targets a specific player or card, and there are multiple
   * eligible targets, the first player selects among the eligible options" — `chooser: firstPlayer` on an encounter
   * card; the resolving player on a player card (RRG 1.8 "Choose (Game Element)", p. 12). `ties: "first"` takes the
   * first tied player in player order, for text where the choice cannot matter.
   */
  | {
      readonly kind: "superlative";
      readonly order: "highest" | "lowest";
      readonly measure: ValueSpec;
      readonly among?: PlayerRef;
      readonly ties?: "all" | "first";
    };

export type ValueSpec =
  | { readonly kind: "const"; readonly value: number }
  | { readonly kind: "perPlayer"; readonly base: number; readonly perPlayer: number }
  | { readonly kind: "stat"; readonly of: TargetRef; readonly stat: StatName }
  | { readonly kind: "counters"; readonly of: TargetRef; readonly counterType: string }
  | { readonly kind: "eventAmount" }
  /**
   * A number bound earlier in this ability: "X" from "Spend X [energy]", the
   * count of cards discarded as a cost, `paid.<type>` / `paid.total` for the
   * resources spent on the card, `self.counters.<type>` snapshotted by a
   * discard-self cost.
   */
  | { readonly kind: "var"; readonly name: string }
  /** A result of the triggering event ("for each damage dealt by this attack" → `damage`). */
  | { readonly kind: "eventResult"; readonly key: string }
  /**
   * Arithmetic on another value: "2 damage for each counter (max 10)" → `{ value, times: 2, max: 10 }`; "X is 1 more
   * than" → `plus: 1`; "half of the cards in your hand, rounded down" (Man Out of Time, `cap` pack) → `{ value:
   * handCount(you), divide: { by: 2, round: "down" } }`. `divide` applies first, then `times`, `plus`, `max`.
   *
   * `round` is required. RRG 1.8 "Modifiers" (p. 29) rounds fractional values **up** by default, and cards that
   * print "rounded down" override that. Neither direction is a safe silent default.
   */
  | {
      readonly kind: "scaled";
      readonly value: ValueSpec;
      readonly divide?: { readonly by: number; readonly round: "down" | "up" };
      readonly times?: number;
      readonly plus?: number;
      readonly max?: number;
    }
  /** How many cards in play match: "for each side scheme in play", "for each Drone minion engaged with you". */
  | { readonly kind: "count"; readonly query: TargetQuery }
  /**
   * The total of several values: "for each ally and Persona support in play" (Generation Why?, `msm` pack) is the ally
   * count plus the Persona support count. Two counts rather than one query, because a query's `trait` applies to every
   * category it lists. An empty list is 0 (`@mc/cards`' validator rejects it).
   */
  | { readonly kind: "sum"; readonly values: readonly ValueSpec[] }
  /**
   * The least / greatest of several values: "+1 hand size for each facedown encounter card in front of you (to a maximum
   * of +3 hand size)" (Star-Lord's Helmet, `stld` 17010) is `min(count, 3)`; ruling, Mar 30, 2026 (1): that maximum caps
   * the Helmet's own bonus. docs/phase7-wave3.md §3.10.
   */
  | { readonly kind: "min"; readonly values: readonly [ValueSpec, ...ValueSpec[]] }
  | { readonly kind: "max"; readonly values: readonly [ValueSpec, ...ValueSpec[]] }
  /**
   * The facedown encounter cards dealt to a player and not yet revealed, "in front of" them (RRG 1.8 "Deal", p. 14):
   * "for each facedown encounter card in front of you" (Star-Lord: Gutsy Move, Sliding Shot, Jet Boots, Star-Lord's
   * Helmet, `stld`). docs/phase7-wave3.md §3.10.
   */
  | { readonly kind: "dealtEncounterCount"; readonly player: PlayerRef }
  /**
   * The cards in a scenario out-of-play area, optionally filtered: "If there are at least 5 cards in The Collection" (The
   * Grand Collection 1B), "for each card in The Collection" (Collector III). docs/phase7-wave3.md §3.14.
   */
  | { readonly kind: "scenarioAreaCount"; readonly name: string; readonly filter?: TargetQuery }
  /**
   * The cards in the victory display (docs/phase7-wave3.md §3.4), optionally filtered: "Play only if there is a side
   * scheme in the victory display" (Mission Planning, Critical Hit, Predictable Ploy, Anticipated Attack) is
   * `compare(victoryDisplayCount({ categories: ["sideScheme"] }), "atLeast", 1)` as a `playOnlyIf` (§3.42). The
   * victory display is out of play, which is why `exists`/`count` (cards in play) cannot read it.
   */
  | { readonly kind: "victoryDisplayCount"; readonly filter?: TargetQuery }
  /**
   * How many of the cards a ref names match a query, wherever they are (not restricted to in play, unlike `count`):
   * "for each treachery looked at this way" (Falcon, `cap` pack, over `selectCards`' non-in-play "look") reads the
   * cards bound to a slot. Resolved the same way `resourceTypes`/`distinctCardTypes` already read a ref's cards.
   */
  | { readonly kind: "countInRef"; readonly cards: TargetRef; readonly query: TargetQuery }
  /** A character's remaining hit points (max HP minus damage): "X is equal to Titania's remaining hit points". */
  | { readonly kind: "remainingHp"; readonly of: TargetRef }
  /** "N (M instead if …)": `then` when the predicate holds, `else` otherwise. */
  | { readonly kind: "conditional"; readonly if: Predicate; readonly then: ValueSpec; readonly else: ValueSpec }
  /** Damage on a card: "X is the amount of damage you have sustained" (Gamma Slam). */
  | { readonly kind: "damage"; readonly of: TargetRef }
  /** Threat on a scheme: "X is the amount of threat on Bomb Scare". */
  | { readonly kind: "threat"; readonly of: TargetRef }
  /**
   * The main scheme's printed stage number, as it reads now: "[Collector] gets +X SCH and +X ATK, where X is equal
   * to the main scheme's current stage number" (Collector I/II, `gmw` 16080a/16081a). Defaults to the central main
   * scheme; a separate game area's own stage (Kang's `expertVillains` shape) is unreachable from a card that has no
   * `TargetRef` for "that area's main scheme" yet — none printed needs it.
   */
  | { readonly kind: "mainSchemeStageNumber" }
  /** Boost icons printed on a card: "1 more than the number of boost icons on the discarded card" (with `scaled`). */
  | { readonly kind: "boostIcons"; readonly of: TargetRef }
  /**
   * How many of the cards a ref names print a star icon (★) in the boost area, wherever they are: "For each star icon
   * in the boost area discarded this way, place 1 threat on the main scheme" (Slipping Sanity 15023, `scw`).
   *
   * **A star icon is not a boost icon** — RRG 1.8 "Boost, Boost Icon" (p. 11): "A star icon is not itself considered
   * a boost icon, and does not contribute to the villain's ATK or SCH value." `starIcons` and `boostIcons` are
   * therefore independent counts over the same pile; a card printing both pips and a star contributes to both
   * (docs/phase7-wave2.md §24). A boost area carries at most one star, so each matching card adds exactly 1.
   *
   * Printed data (`hasStarIcon`), read wherever the cards are, and deliberately *not* derived from whether the card
   * has a scripted `boost` ability — see §18.6. The sibling of `totalPrintedResources`; `<bind>.starIcons` is the
   * same number summed over a `moveCards`/`discardEncounterCards` bind.
   */
  | { readonly kind: "starIcons"; readonly cards: TargetRef }
  /** A player's hand size; `printed` ignores modifiers ("draw up to your printed hand size"). */
  | { readonly kind: "handSize"; readonly player: PlayerRef; readonly printed?: boolean }
  /** Cards in a player's hand. */
  | { readonly kind: "handCount"; readonly player: PlayerRef }
  /**
   * Cards in a player's deck — the player deck only, never a separate deck (`PlayerState.separateDecks`) or the
   * encounter deck. The sibling of `handCount`, and the measure "half of their deck" needs: pair it with `scaled`'s
   * `divide` to get the number, then pass that to a `zone` `CardSelector`'s `top` to name the cards ("removes the
   * top half of their deck from the game").
   *
   * `scaled.divide.round` stays required here as everywhere: RRG 1.8 "Modifiers" (p. 29), "Fractional values are
   * rounded up after all modifiers have been applied", so a text that prints no rounding halves *up*, and one that
   * prints "rounded down" says `round: "down"`. This value itself never rounds — it is a plain count.
   */
  | { readonly kind: "deckCount"; readonly player: PlayerRef }
  /** Distinct printed resource types among cards ("for each different resource type discarded this way"). Wild counts as its own type. */
  | { readonly kind: "resourceTypes"; readonly cards: TargetRef }
  /** Distinct card types among cards ("for each different card type discarded this way": Trickster, Leading the Charge). */
  | { readonly kind: "distinctCardTypes"; readonly cards: TargetRef }
  /** A card's printed cost (RRG 1.8 "Printed", p. 35): "equal to its printed cost" (Headbutt, Thoughtcasting). A card with no printed cost is 0. */
  | { readonly kind: "printedCost"; readonly of: TargetRef }
  /** The sum of the printed costs of every card a ref names, wherever they are: "the total cost of all allies beneath it" (Hydra Prison). */
  | { readonly kind: "totalPrintedCost"; readonly cards: TargetRef }
  /**
   * The total printed resource icons on every card a ref names, wherever they are: "X is the number of printed
   * resources on that card" (the Hawkeye ally 04011, counting a card discarded as the ability's own cost).
   *
   * `types` narrows it to some icon types ("each [mental] icon"); absent counts all four, wild included, because a
   * printed wild icon is a printed resource. The sibling of `totalPrintedCost`; unlike `<bind>.<type>`, which reports
   * a pool summed over a `moveCards`/`discardEncounterCards` bind, this reads whatever a `TargetRef` names, so a card
   * bound by a cost's own `discardFromHand` slot (which reports only a count) can be measured.
   */
  | {
      readonly kind: "totalPrintedResources";
      readonly cards: TargetRef;
      readonly types?: readonly ("physical" | "mental" | "energy" | "wild")[];
    }
  /**
   * A villain's printed stage number (Death from Above, Wicked Ambitions): the numeral printed on the stage card
   * (`VillainStage.stageNumber`), not its index in the deck — expert play starts on stage II, whose number is 2.
   * `of` absent is the active villain ("the villain").
   */
  | { readonly kind: "villainStageNumber"; readonly of?: TargetRef }
  /**
   * A number recorded in the campaign log: "Place threat on the main scheme equal to the number of delay counters
   * recorded in the campaign log" (MC10 p. 15), "set each player's hit points to their remaining hit point value"
   * (MC10 p. 7, per seat).
   *
   * Read from `GameState.campaign.log`, the snapshot the campaign runner froze into this game (design §7.1) — the
   * engine never reaches out to a live log, which is what keeps `applyCommand` pure and a saved campaign game
   * replayable while the log keeps evolving underneath it. No campaign input, or no such field, is 0.
   *
   * `seat` names whose column to read (`PlayerRef`; several players resolve to the first, as every other `of` does);
   * absent reads the shared field. `of: "count"` asks for the *number of entries* in a list-valued field
   * ("the number of Rescued Captive allies recorded"), which is the only way to get a number out of one — without
   * it, only a `number` field (its value) and a `flag` field (1/0) read as anything but 0.
   */
  | { readonly kind: "campaignLog"; readonly field: string; readonly seat?: PlayerRef; readonly of?: "count" };

export type StatName = "atk" | "thw" | "def" | "rec" | "sch";

/**
 * A scheme's threat values as modifier keys (docs/phase7-wave1.md §3.8): "Increase the target threat value of attached
 * scheme by 4" (`targetThreat`), Mutagen Cloud 2B's "X is equal to the number of Goblin enemies" (`acceleration` with
 * `setBase`). Read through `mainSchemeValue` / `startingThreatOf`.
 */
export type SchemeValueName = "acceleration" | "targetThreat" | "startingThreat";

export type Predicate =
  | { readonly kind: "form"; readonly player: PlayerRef; readonly form: Form }
  | { readonly kind: "hasStatus"; readonly of: TargetRef; readonly status: "stunned" | "confused" | "tough" }
  | { readonly kind: "exists"; readonly query: TargetQuery }
  | { readonly kind: "counterAtLeast"; readonly of: TargetRef; readonly counterType: string; readonly amount: number }
  | { readonly kind: "damagedAtLeast"; readonly of: TargetRef; readonly amount: number }
  | { readonly kind: "not"; readonly of: Predicate }
  /** "If you paid for this card using a [X] resource" (a wild can be declared as X). */
  | { readonly kind: "paidWith"; readonly resource: TypedResource }
  /** A bound number (see `ValueSpec` `var`) is at least `amount`. */
  | { readonly kind: "varAtLeast"; readonly name: string; readonly amount: number }
  | { readonly kind: "and"; readonly of: readonly Predicate[] }
  | { readonly kind: "or"; readonly of: readonly Predicate[] }
  /** A result of the triggering event is at least `amount` ("if this attack dealt damage"). */
  | { readonly kind: "eventResultAtLeast"; readonly key: string; readonly amount: number }
  /** A result of the attack/activation in progress ("if the villain is making an undefended attack" → `undefended`). */
  | { readonly kind: "currentAttack"; readonly key: string; readonly atLeast: number }
  /** "If you have the Aerial trait" — includes traits gained from abilities and lasting effects. */
  | { readonly kind: "hasTrait"; readonly of: TargetRef; readonly trait: Trait }
  /**
   * Some card the ref names is in play and matches the query: "if this activation
   * deals damage to *you*" (the event target is your identity), and the in-play
   * guard for "stun that character" after it may have been defeated.
   *
   * `anywhere`: read the card wherever it is, in play or not — "each time a Goblin minion is discarded this way"
   * (Wicked Ambitions) asks about a card that is in a discard pile by the time the question is asked.
   */
  | { readonly kind: "refMatches"; readonly ref: TargetRef; readonly query: TargetQuery; readonly anywhere?: boolean }
  /** The game is at this phase (and step): "during step one of the villain phase". */
  | { readonly kind: "gameStep"; readonly phase: GameStep["phase"]; readonly step?: GameStep["kind"] }
  /**
   * The card is attached to something: "If you cannot, this card gains surge" (Goblin Glider) asks whether its
   * "attach to" found a host. RRG 1.8 "Attach To" (p. 8): legality is checked as the card would be attached, and a
   * card that cannot attach is discarded — its "When Revealed" still resolves, and reads this.
   */
  | { readonly kind: "isAttached"; readonly of: TargetRef }
  /**
   * The card's current face has this title: "When Revealed (Green Goblin)" resolves "only if the Green Goblin side of
   * the villain is in play" (Green Goblin insert, Risky Business "New Rules"). Reads a villain's side and a flipped
   * encounter card's other face.
   */
  | { readonly kind: "faceNamed"; readonly of: TargetRef; readonly name: string }
  /**
   * "If you paid for this card using only [physical] resources" (Hulk Smash): something was paid, and every resource was
   * that type or a wild declared as it. FAQ "Unstoppable Force (#6)" (p. 60): at a cost of 0 it fails.
   */
  | { readonly kind: "paidWithOnly"; readonly resource: TypedResource }
  /**
   * "If you have played a [Thwart] event this turn" (Decisive Blow, Forward Momentum, `gam`): at least `atLeast` (default 1)
   * of the cards `player` played this turn (`GameState.playedThisTurn`) match `cards`, read wherever those cards are now.
   * docs/phase7-wave3.md §3.24.
   */
  | {
      readonly kind: "playedThisTurn";
      readonly player: PlayerRef;
      readonly cards: TargetQuery;
      readonly atLeast?: number;
    }
  /**
   * How many cards of a type a player has played this round is at most `atMost`: "the first ally played each round" → 0.
   * `cardType` absent counts every card type: "If this is the first card you have played this round, return this card to
   * your hand" (Clobber, Impede, `gam`) reads `atMost: 1` while the card itself resolves, since it counts as played
   * from the moment it is played (docs/phase7-wave3.md §3.11).
   */
  | {
      readonly kind: "playedThisRound";
      readonly player: PlayerRef;
      readonly cardType?: string;
      readonly atMost: number;
    }
  /**
   * Compares two live values: "if there is 10 or more threat here" (the Wrecking Crew signature side schemes) →
   * `{ left: { kind: "threat", of: self }, op: "atLeast", right: 10 }`.
   *
   * The general numeric comparison, so any `ValueSpec` can be a threshold and the threshold itself can be a value
   * ("if its remaining hit points are less than the number of counters here"). `counterAtLeast`, `damagedAtLeast`
   * and `varAtLeast` are the older, narrower spellings of the `atLeast` case and stay as they are; prefer `compare`
   * for anything new. Both sides are evaluated in this ability's context at the moment the predicate is read.
   */
  | {
      readonly kind: "compare";
      readonly left: ValueSpec;
      readonly op: "atLeast" | "atMost" | "equalTo";
      readonly right: ValueSpec;
    }
  /**
   * The players are split into separate game areas (docs/phase7-wave2.md §3.1). The Master of Time 2B's "When all the
   * players have joined this game area, advance to stage 4A" is a `stateCheck` on `not(gameAreasSplit)`.
   */
  | { readonly kind: "gameAreasSplit" }
  /**
   * Every player in this effect's game area is defeated (eliminated): "If all the players at this stage are defeated,
   * this stage is complete." (Kang's stage 3 cards). False outside a separate game area.
   */
  | { readonly kind: "areaPlayersDefeated" }
  /**
   * A campaign-log field says something: "If Cosmo is in the campaign pool …" (MC21 p. 17) is `has`, "If the
   * 'Trust Established?' box is checked" is `isSet`, "if 3 or more delay counters are recorded" is `atLeast`.
   *
   * Every condition given must hold (they are ANDed, like a `TargetQuery`'s clauses); with none given it asks only
   * whether the field is present at all. `of: "count"` makes `atLeast` count a list's entries rather than read a
   * number (the same switch `ValueSpec campaignLog` has). Reads the frozen `GameState.campaign.log` snapshot, so a
   * game with no campaign input is always false.
   */
  | {
      readonly kind: "campaignLog";
      readonly field: string;
      readonly seat?: PlayerRef;
      /** A card id, an option name or an instruction id the field lists. */
      readonly has?: string;
      readonly atLeast?: number;
      readonly of?: "count";
      readonly isSet?: boolean;
    }
  /**
   * "If this activation is an attack/scheme" (Badoon Warlord, Badoon Lieutenant, `gmw` 16121/16119): reads the
   * enclosing `enemyAttack`/`enemyScheme` event frame (`currentActivationFrameId`), so it also works from inside a
   * Boost ability, which has no `context.event` of its own. False with no such frame on the stack (a player's own
   * attack/thwart is a different event kind and doesn't match either reading).
   */
  | { readonly kind: "currentActivationIs"; readonly activation: "attack" | "scheme" };

export type StatusName = "stunned" | "confused" | "tough";

/**
 * `bind` on an event-producing effect reports what it did into this ability's
 * vars when it finishes: `<bind>.amount` (damage taken / damage healed / threat
 * placed or removed), `<bind>.made` (1 if it happened), and for attacks
 * `<bind>.damage`, `<bind>.defeated`, `<bind>.undefended`, `<bind>.excessDealt`
 * (damage dealt beyond remaining hit points; RRG 1.8 "Excess Damage", p. 19).
 */
export type EffectSpec =
  /**
   * `ignoreTough`: "This damage ignores tough status cards" (Lightning Strike, as errataed on RRG 1.8 p. 65). The
   * damage is taken although a tough status card is on the character, and — unlike piercing, which the RRG defines as
   * discarding it — nothing says the status card is removed, so it stays (RRG 1.8 "Tough", p. 44: a tough card
   * "prevents a character from taking damage"; "Piercing" is the keyword that discards it). Engine reading, flagged
   * in docs/phase7-wave1.md §3.13.
   */
  | {
      readonly kind: "dealDamage";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly fromAttack?: boolean;
      readonly ignoreTough?: boolean;
      readonly bind?: string;
    }
  /** "Heal N damage"; with `bind`, "if no damage was healed this way" reads `<bind>.amount`. */
  | { readonly kind: "heal"; readonly target: TargetRef; readonly amount: ValueSpec; readonly bind?: string }
  | { readonly kind: "placeThreat"; readonly target: TargetRef; readonly amount: ValueSpec; readonly bind?: string }
  /**
   * `ignoreCrisis`: "…, ignoring any crisis icons in play" (Cable Arrow 04008). RRG 1.8 "Crisis Icon" (p. 14) stops
   * *players* removing threat from the main scheme while one is in play; this one effect steps over that check only.
   * It does not touch a `threatCannotBeRemoved` rule, which is a "cannot" (RRG 1.8 "'Cannot'", p. 11) and absolute.
   */
  | {
      readonly kind: "removeThreat";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly ignoreCrisis?: boolean;
      readonly bind?: string;
    }
  /**
   * "(attack)": "Deal N damage to an enemy" resolved as an attack by your
   * identity (or `attacker`): guard, retaliate, "after X attacks" and overkill
   * all apply. Pair with `label: ["attack"]` on the ability. `moveDamageFrom`
   * is "move N damage from your hero to an enemy" (capped by the damage there).
   */
  | {
      readonly kind: "attack";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly attacker?: TargetRef;
      readonly overkill?: boolean;
      /**
       * "This attack gains piercing" (Piercing Strike, Vibranium Arrow): attack keywords for this attack only, not for
       * the attacker. `["overkill"]` is the same as `overkill: true`; both are accepted and unioned.
       */
      readonly keywords?: readonly AttackKeyword[];
      readonly moveDamageFrom?: TargetRef;
      readonly bind?: string;
    }
  /**
   * "That minion attacks another enemy of your choice" (Moondragon, `drax` 19013): an enemy attacks another enemy.
   * docs/phase7-wave3.md §3.23, on §4 Q12 as the user decided it (2026-09-23; no FFG ruling exists): it is **an
   * attack, not an activation**, although RRG 1.8 "Activation" (p. 6) calls an attack a card ability causes an
   * activation. So:
   *
   * - no boost card (villainous or not), and nothing keyed on `enemyAttack` ("when this minion attacks/activates")
   *   fires: this resolves as its own `enemyAttacksEnemy` event, never as an `enemyAttack`;
   * - nobody defends: the target is an enemy, with no controller to defend it or assign its damage;
   * - the attacker's ATK is dealt to the target as attack damage (`dealDamage.fromAttack`) with the attacker's attack
   *   keywords, so the target's tough status, damage reductions and retaliate apply as to any attack, and a
   *   `characterAttacked` event names the target;
   * - overkill follows RRG 1.8 "Overkill" (p. 31) as written, whoever attacks: a minion the attack defeats spills its
   *   excess to the (active) villain; a villain target spills nowhere;
   * - guard does not restrict it: guard binds the engaged *player's* attacks (RRG 1.8 "Guard", p. 21), and an enemy's
   *   attack is nobody's (`canAttack`); an `attacker`- or `target`-scoped `cannotAttack` rule still does;
   * - a stunned attacker removes its stunned status card instead of attacking (RRG 1.8 "Stun", p. 41: "When this
   *   character would attack"), since this is an attack;
   * - a "—" ATK attacker does not attack, as `attack` treats one (RRG 1.8 "Dash (Value)", p. 15).
   *
   * The first card each ref names is used. `bind`: `<bind>.made`, `.damage`, `.damaged`, `.defeated`, as `attack`.
   */
  | {
      readonly kind: "enemyAttacksEnemy";
      readonly attacker: TargetRef;
      readonly target: TargetRef;
      readonly bind?: string;
    }
  /**
   * "(thwart)": "Remove N threat from a scheme" resolved as a thwart by your identity (or `thwarter`). Pair with
   * `label: ["thwart"]`. `ignoreCrisis` is `removeThreat.ignoreCrisis`, carried through to the removal this makes.
   */
  | {
      readonly kind: "thwart";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly thwarter?: TargetRef;
      readonly ignoreCrisis?: boolean;
      readonly bind?: string;
    }
  /**
   * Changes the attack/activation in progress: "the attack gains overkill",
   * "give him 1 additional boost card for this activation", "+N ATK until the
   * end of this attack".
   */
  | {
      readonly kind: "modifyAttack";
      readonly overkill?: boolean;
      /**
       * "The attack gains piercing" / "the attack gains ranged" (Crossfire's boost, Crossfire's Rifle): attack
       * keywords for the activation in progress. `["overkill"]` is the same as `overkill: true`.
       */
      readonly keywords?: readonly AttackKeyword[];
      /**
       * "Prevent all damage from that attack" (Mockingbird 04004), set from an interrupt at attack *initiation* —
       * before a defender is declared and long before a `dealDamage` frame exists, which is why the `preventDamage`
       * effect (an interrupt to one damage event) cannot express it. The flag rides the activation's own event frame
       * and is read when that attack finally deals its damage, so it survives `declareDefender` and the defense
       * arithmetic, and it expires with the attack.
       *
       * RRG 1.8 "Prevent" (p. 34): the damage is still *dealt* (excess damage is measured, and "the attacking
       * character is considered to have dealt damage"), but the target takes none, so no tough status card is used,
       * "attacked and damaged" is false, and the attack's `damage`/`damaged` results stay 0.
       */
      readonly preventAllDamage?: boolean;
      /** A number, or a value: "give him an additional boost card for each side scheme in play" (Master Strategist; §3.11). */
      readonly extraBoostCards?: number | ValueSpec;
      readonly atkBonus?: ValueSpec;
      /** Scheme activations: "reduce the amount of threat placed on the scheme by 1" (Emergency) → `-1`. */
      readonly threatBonus?: ValueSpec;
    }
  /**
   * "Get +N to that power for this use" (Rapid Growth 13005; Venom's Pistol; Scarlet Witch ally `qsv`): a bonus to the
   * basic power currently being used, on the character using it, for that use only.
   *
   * Resolves against the `basicPowerUsing` event on the stack (docs/phase7-wave2.md §17.4), so "that power" is read
   * rather than named — one effect covers ATK, THW and DEF, which is what a card that says "one of your hero's basic
   * powers (THW, ATK, or DEF)" needs from a single ability. It is a `statModifier` on that character for the matching
   * stat, so it composes with every other modifier and is read when the power's value is read, whatever else the same
   * ability did first (a form change, for instance). Its duration is the activation the power belongs to — the
   * attack, the thwart, or the enemy attack a defense answers — so it expires with that use, never carrying into the
   * next one. Outside a basic-power use it does nothing.
   *
   * `amount` is signed: a negative is "reduce your hero's ATK for that attack" (Ultimate Nullifier).
   */
  | { readonly kind: "modifyBasicPower"; readonly amount: ValueSpec }
  /**
   * "Cosmo does not take consequential damage for this use." (Cosmo, `stld` 17020, errata RRG 1.8 p. 67): the pending
   * consequential damage of each target's current attack or thwart is cancelled. Consequential damage is put on the stack
   * with the basic power and resolves after it (RRG 1.8 "Consequential Damage", p. 13), so an interrupt to the attack or
   * thwart finds it still waiting. Does nothing when there is none. docs/phase7-wave3.md §3.21.
   */
  | { readonly kind: "cancelConsequentialDamage"; readonly character: TargetRef }
  /** "At the end of this attack, …" — runs after the current attack's responses. The triggering event carries its `results`. */
  | { readonly kind: "atEndOfAttack"; readonly effects: readonly EffectSpec[] }
  /** "After this activation ends, shuffle this card into the encounter deck" (Goblin Knight's boost): `atEndOfAttack`'s timing, for an attack or a scheme. */
  | { readonly kind: "atEndOfActivation"; readonly effects: readonly EffectSpec[] }
  /**
   * "Cancel the boost icons on that card" (Attacrobatics, Preemptive Strike, Foiled!): the boost card the current
   * activation is resolving. A card with no icons has nothing to cancel (FAQ "Attacrobatics (#6)", p. 59). `bind`:
   * `<bind>.made`, `<bind>.amount` (icons cancelled: "Deal 1 damage … for each boost icon canceled this way").
   */
  | { readonly kind: "cancelBoostIcons"; readonly bind?: string }
  /**
   * "Increase or decrease the number of boost icons on that card by 1 for this count" (Scarlet Witch's Crest): changes
   * the count of the boost card the current activation is about to count (`boostIconsCounting`), for this count only;
   * the total is floored at 0. docs/phase7-wave2.md §3.6.
   */
  | { readonly kind: "adjustBoostCount"; readonly delta: ValueSpec }
  /**
   * "When boost icons on an encounter card would be counted, discard the top card of the encounter deck and count the
   * number of boost icons on that card instead" (Chaos Control): the current activation's boost count reads the first
   * card `card` names (bind the discarded card first). docs/phase7-wave2.md §3.6.
   */
  | { readonly kind: "replaceBoostCount"; readonly card: TargetRef }
  /** "Cancel that card's boost ability" (Target Acquired): only before that ability resolves. `bind`: `<bind>.made`. */
  | { readonly kind: "cancelBoostAbility"; readonly bind?: string }
  /** Interrupt to damage: "prevent N of that damage" (Cosmic Flight) / "prevent all" (Backflip, `amount` absent). */
  | { readonly kind: "preventDamage"; readonly amount?: ValueSpec }
  /** Interrupt to threat being placed: "prevent 1 of that threat" (Jennifer Walters). `amount` absent = all. */
  | { readonly kind: "preventThreat"; readonly amount?: ValueSpec }
  /**
   * RRG "Replacement Effect": "…instead" — the triggering event doesn't happen
   * (no further interrupts or responses to it) and `with` resolves in its place,
   * with the original event as context (`eventAmount`, `eventTarget`, …).
   * "You take it as damage instead", "place it here instead", "heal all damage
   * from it instead".
   */
  | { readonly kind: "replaceTriggeringEvent"; readonly with: readonly EffectSpec[] }
  /** Interrupt to an encounter card being revealed: cancel only its "When Revealed" effects (incite and surge included). */
  | { readonly kind: "cancelWhenRevealed" }
  /** Interrupt to an encounter card being revealed: "cancel the effects of that card and discard it" (Black Widow). */
  | { readonly kind: "cancelRevealedCard" }
  /** "Place N damage here" — damage tokens placed without being dealt (no damage event; Armored Rhino Suit). */
  | { readonly kind: "placeDamage"; readonly target: TargetRef; readonly amount: ValueSpec }
  /** Remembers what a ref points to now under `slot`, for later effects ("that enemy" after this card is discarded). */
  | { readonly kind: "bindTargets"; readonly slot: string; readonly target: TargetRef }
  /**
   * A lasting stat change: "Until the end of the phase, Vision gets +2 ATK"
   * (`target`, fixed now) / "Each character that player controls gets +1 THW
   * until the end of the phase" (`affects`, which also catches cards that
   * enter play later — RRG "Lasting Effects") / "Until the end of his attack,
   * Ultron gets +1 ATK for each Drone" (`until: "endOfAttack"`). `amount` is
   * re-evaluated on every read in the creating ability's context.
   */
  | {
      readonly kind: "modifyStatUntil";
      readonly stat: StatName | "hp" | "handSize";
      readonly amount: ValueSpec;
      readonly target?: TargetRef;
      readonly affects?: TargetQuery;
      readonly until: LastingUntil;
    }
  /** "Until the end of the phase, treat this card's printed text box as if it were blank" (Edison's Giant Robot). */
  | { readonly kind: "blankTextBox"; readonly target: TargetRef; readonly until: LastingUntil }
  /**
   * "You cannot change form **until your next turn ends**" (Care for Cassie, `ant` 12025) / "You cannot ready your
   * identity until your next turn ends" (Need for Speed, `qsv` 14024): a `RuleSpec` with a clock on it, as a
   * `LastingEffectBody ruleGrant`. Both cards discard themselves as they resolve, so there is no card left in play
   * to carry the restriction as a constant ability — the restriction has to outlive its source (RRG 1.8 "Lasting
   * Effects", p. 26). docs/phase7-wave2.md §22.
   *
   * `until`:
   * - `"endOfPhase"` / `"endOfRound"` — the ordinary boundaries;
   * - `"endOfTurn"` — the turn in progress; like every other "this turn" effect it is **not created** outside one
   *   (RRG 1.8 "Lasting Effects", p. 26, and §13.3);
   * - `"endOfNextTurn"` — "until your next turn ends": the first turn `player` *begins* from now on. Created
   *   whenever the effect resolves, including in the villain phase, which is where both obligations resolve.
   *
   * `player` is whose turn `"endOfNextTurn"` waits for; absent, the ability's controller ("**your** next turn").
   * It is read for that duration only.
   *
   * `"endOfAttack"` is deliberately absent: no card prints a restriction scoped to one attack, and an
   * attack-scoped one would have to name the activation frame the way `modifyStatUntil` does.
   */
  | {
      readonly kind: "applyRuleUntil";
      readonly rule: RuleSpec;
      readonly until: "endOfPhase" | "endOfRound" | "endOfTurn" | "endOfNextTurn";
      readonly player?: PlayerRef;
    }
  /**
   * "Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy."
   * (Schadenfreude): a lasting `eachTime` effect — every event matching `on` until then resolves `effects`, after the
   * event and before its responses (docs/phase7-wave3.md §3.17). Like `applyRuleUntil`, "until the end of the turn"
   * outside a turn is not created (RRG 1.8 "Lasting Effects", p. 26).
   */
  | {
      readonly kind: "eachTimeUntil";
      readonly until: "endOfPhase" | "endOfRound" | "endOfTurn";
      readonly on: EventPattern;
      readonly effects: readonly EffectSpec[];
    }
  /** "Gain the Aerial trait until the end of the phase" (Rocket Boots). */
  | {
      readonly kind: "grantTraitUntil";
      readonly trait: Trait;
      readonly target?: TargetRef;
      readonly affects?: TargetQuery;
      readonly until: LastingUntil;
    }
  /** A delayed effect: "At the end of the round, if Nick Fury is still in play, discard him." Fires after round-end lasting effects expire. */
  | { readonly kind: "atEndOfRound"; readonly effects: readonly EffectSpec[] }
  /**
   * Moves cards between zones (in or out of play): "discard the top 2 cards of
   * your deck" (`zone: deck, top: 2 → discard`), "add each card with a printed
   * [mental] resource to your hand", "return the topmost Tech upgrade in their
   * discard pile to their hand", "shuffle them into your deck", "return Hellcat
   * to your hand". `bind` records the moved cards in slot `bind`, their count in
   * var `<bind>.count` and their printed resource icons in `<bind>.<type>`.
   */
  | { readonly kind: "moveCards"; readonly cards: CardSelector; readonly to: CardDestination; readonly bind?: string }
  /** Choose cards outside play ("look at the top 3 … add 1", "search your deck for an upgrade", "choose up to 3 different cards in your discard"). */
  | {
      readonly kind: "chooseCards";
      readonly slot: string;
      readonly from: CardSelector;
      readonly chooser: PlayerRef;
      readonly min: number;
      readonly max: number;
      /** "different cards": no two with the same name. */
      readonly distinctNames?: boolean;
    }
  /** Shuffle a player's deck (RRG "Search": searching any part of a deck shuffles it afterwards). */
  | { readonly kind: "shuffleDeck"; readonly player: PlayerRef }
  /**
   * "Change your form" as an effect; doesn't use the player's one voluntary change this round (RRG "Form, Change Form";
   * the Ant-Man insert: "If a card ability causes a player to change form, it does not count against the one voluntary
   * form change"). `to` absent is the other form.
   *
   * `heroForm` picks the hero face of a three-sided identity (docs/phase7-wave2.md §3.2):
   * - `{ withTrait }`: "change to your [Giant] hero form" (Rapid Growth): the face printed with that trait;
   * - `"other"`: "change to your other hero form" (Resize, Swarm Tactics): from one hero face to the other; nothing
   *   happens in alter-ego form;
   * - absent, going to hero form with more than one hero face: that player chooses the face (`chooseOption`).
   * A player already in the named form is unaffected, so no `formChanged` is announced.
   */
  | {
      readonly kind: "changeForm";
      readonly player: PlayerRef;
      readonly to?: Form;
      readonly heroForm?: { readonly withTrait: Trait } | "other";
    }
  /** "Draw up to N cards" / "draw up to your printed hand size". */
  | { readonly kind: "drawUpTo"; readonly player: PlayerRef; readonly amount: ValueSpec }
  /**
   * "Choose one: …" / "Choose to either … or …". Options whose `condition`
   * fails aren't offered; with one option left it resolves without asking.
   */
  | {
      readonly kind: "chooseOne";
      readonly chooser: PlayerRef;
      readonly options: readonly {
        readonly label: string;
        readonly condition?: Predicate;
        readonly effects: readonly EffectSpec[];
      }[];
      /**
       * "Choose two of the following (you may choose the same option twice)" (Double Time; docs/phase7-wave2.md §3.7):
       * `count` options are chosen and resolve in the order chosen. RRG 1.8 "Choose (Option)" (p. 12) forbids choosing an
       * option more than once unless the card says otherwise, which `allowRepeat` does. Default 1.
       */
      readonly count?: number;
      readonly allowRepeat?: boolean;
    }
  /**
   * "Deal a total of 4 damage divided among enemies you choose" (Wasp Sting) / "Remove a total of 3 threat from among
   * schemes in play" (Inconspicuous): `chooser` divides `amount` among the cards `among` matches, one point at a time
   * (a `divide` choice; options `<instanceId>#<n>`). The candidates are fixed when the choice is made. Damage then
   * resolves simultaneously as one damage group; threat is removed from each scheme in the order chosen. A single
   * candidate takes it all without a choice. `bind`: `<bind>.amount` / `<bind>.made` for damage.
   */
  | {
      readonly kind: "divide";
      readonly what: "damage" | "threat";
      readonly amount: ValueSpec;
      readonly among: TargetQuery;
      readonly chooser: PlayerRef;
      readonly bind?: string;
      /**
       * "Remove a total of **up to** 5 threat from among schemes (as you choose)" (Agile Flight, `stld` 17029;
       * docs/phase7-wave3.md §3.41): `amount` is the most the chooser may divide, and they may divide fewer points,
       * but **at least 1** whenever something can be targeted (§4 Q16, decided by the user on 2026-09-23: an
       * effect's "up to N" chooses at least one when possible, unless a printed "may" makes it optional). Only valid
       * targets are offered (RRG 1.8 "Target", p. 43: valid "if any part of that ability can affect that target"): a
       * scheme with threat that can be removed, a character that can take damage. With none, nothing is asked and
       * nothing happens. The choice is asked even with a single candidate, since how many is still the chooser's.
       */
      readonly upTo?: true;
    }
  /** "Choose a player." Binds that player (their identity) into `slot`; use `PlayerRef` `slot` to refer to them. */
  /**
   * "Choose a player." `among` limits the choice to the players it names — the tie of a `PlayerRef superlative` ("the
   * player engaged with the fewest minions", docs/phase7-wave3.md §3.35). With `among`, a single eligible player is
   * bound without asking (there is no choice to make), and none binds nothing.
   */
  | { readonly kind: "choosePlayer"; readonly slot: string; readonly chooser: PlayerRef; readonly among?: PlayerRef }
  /** "Each player …": runs `effects` once per player in player order, with `PlayerRef` `scoped` = that player. */
  | { readonly kind: "forEachPlayer"; readonly players: PlayerRef; readonly effects: readonly EffectSpec[] }
  /**
   * "Resolve the Special ability on each [Black Panther] upgrade you control in
   * any order. (Each is a step in a sequence.)" The controller orders them; each
   * step gets vars `sequence.step` and `sequence.final` (1 on the last step).
   */
  /**
   * `of` names cards wherever they are, for a Special resolved out of play: "resolve the 'Special' ability on [the top
   * card of the Invocation deck]". Resolving a Special is not playing the card, so no `cardPlayed` event (FAQ
   * "Depowered (#20)", p. 60: "merely resolved, not played").
   */
  | { readonly kind: "resolveSpecials"; readonly cards?: TargetQuery; readonly of?: TargetRef }
  /**
   * "Rhino attacks you" / "The villain and each minion engaged with you attacks
   * you" / "Each Masters of Evil minion attacks the hero it is engaged with" /
   * "Titania attacks your hero". Each enemy in `enemies` attacks each player in
   * `against` (absent = the player it is engaged with, else this ability's
   * player), through the full enemy-attack procedure (boost, defense, …). A
   * stunned enemy discards its stun instead and doesn't attack (RRG "Stun").
   * `bind`: `<bind>.made` (attacks made), `.damage`, `.undefended`, and slots
   * `<bind>.damaged` / `<bind>.target` ("if a character is damaged by this
   * attack, that character is stunned"). `additionalResolution` marks the same
   * attack resolved against more players (Whirlwind): the attacker's own "when
   * this enemy attacks" abilities don't trigger again for it.
   */
  | {
      readonly kind: "enemyAttack";
      readonly enemies: TargetRef;
      readonly against?: PlayerRef;
      readonly bind?: string;
      readonly additionalResolution?: boolean;
      /** `false`: "That attack does not get a boost card" (Escaped Convict) / "do not give the villain a boost card" (I See You). */
      readonly boost?: false;
      /**
       * The attack is against this character instead of the player's identity: "attacks the hero or ally with the
       * highest ATK" (Clash of the Titans). Its controller is the attacked player (RRG 1.8 "Attack (Enemy Activation)",
       * p. 8: "abilities can instead cause an enemy to attack … an ally that player controls … the player is still
       * considered attacked"). The first character the ref names is used.
       */
      readonly targetCharacter?: TargetRef;
      /**
       * `"currentActivation"`: "that villain attacks you after this attack" (Escaped Convict's boost). RRG 1.8
       * "Activation" (p. 6): "the newly initiated activation resolves after the current activation has finished
       * resolving"; ruling, Feb 28, 2026 (1) answer 2: every ability the ongoing attack triggered, Retaliate and
       * responses included, resolves first. With no activation in progress it resolves at once.
       */
      readonly after?: "currentActivation";
      /**
       * "Green Goblin attacks with +X ATK" (Death from Above): a bonus scoped to exactly the attack this effect
       * initiates, evaluated once when the attack is initiated and carried on that activation, so a second copy of
       * the card in the same phase does not stack onto the first one's attack.
       *
       * Distinct from `modifyAttack.atkBonus`, which changes the activation *already in progress*, and from
       * `modifyStatUntil`, which changes the enemy's ATK for a whole phase/round no matter how many activations that
       * covers. A dashed ATK is "an unmodifiable 0" (RRG 1.8 "Dash (Value)", p. 15), so this does not raise it.
       */
      readonly atkBonus?: ValueSpec;
    }
  /** "The villain schemes" / "Ultron schemes": a scheme activation; a confused enemy discards its confusion instead. `bind`: `<bind>.made`, `<bind>.threatPlaced`. */
  | {
      readonly kind: "enemyScheme";
      readonly enemies: TargetRef;
      readonly against?: PlayerRef;
      readonly bind?: string;
      readonly boost?: false;
      readonly after?: "currentActivation";
      /**
       * "Green Goblin schemes with +X SCH" (Death from Above): `enemyAttack.atkBonus` for a scheme activation.
       *
       * Not the same as `modifyAttack.threatBonus` ("reduce the amount of threat placed on the scheme by 1"): this is
       * a bonus to the enemy's SCH, so a dashed SCH stays "an unmodifiable 0" (RRG 1.8 "Dash (Value)", p. 15) where a
       * change to the threat placed would still apply.
       */
      readonly schBonus?: ValueSpec;
    }
  /** "This card gains surge": the encounter card whose ability this is surges when its reveal finishes. */
  | { readonly kind: "gainSurge" }
  /**
   * "Either spend [E][M][P] resources or …" / "Choose to either spend a
   * [energy] resource or …": asks `player` for a payment (a `spendResources`
   * choice over their payment options). Paying at least `resources` spends it
   * and sets `<bind>.made` to 1; paying nothing (or too little) declines and
   * sets it to 0, so the alternative can follow as `if not <bind>.made`.
   */
  | {
      readonly kind: "spendResources";
      readonly player: PlayerRef;
      readonly resources: ResourceRequirement;
      readonly bind: string;
    }
  /**
   * "Put the top card of your deck into play facedown, engaged with you as a
   * [Drone] minion." For each player, `count` times (default 1). An empty deck
   * resets first (FFG ruling: "Put the second drone into play after reshuffling
   * your deck and dealing yourself a facedown encounter card"). When it leaves
   * play it goes to its owner's zones and is itself again.
   */
  | {
      readonly kind: "putIntoPlayFacedown";
      readonly player: PlayerRef;
      readonly count?: ValueSpec;
      readonly as: FacedownRole;
    }
  /** Binds the cards a selector names now into `slot` (and `<slot>.count`): "your set-aside nemesis minion", "the Breakin' & Takin' side scheme in the encounter deck or discard". */
  | { readonly kind: "selectCards"; readonly slot: string; readonly cards: CardSelector }
  /** "Reveal it": each card goes through the full reveal procedure (RRG "Reveal") for `player`, from wherever it is. */
  | { readonly kind: "revealCard"; readonly cards: TargetRef; readonly player: PlayerRef }
  | { readonly kind: "shuffleEncounterDeck" }
  /**
   * "Create the Experimental Weapons deck" / "Shuffle every other encounter side scheme into the side-scheme deck"
   * (docs/phase7-wave2.md §3.3): every card of the encounter deck matching the scenario deck's `contents` (its encounter
   * sets and/or its card type; both must match when both are given) moves into it, and it is shuffled. A deck with a
   * discard pile of its own takes its cards' home with them, so a discard goes there; the others stay homed to the
   * encounter deck. Only the main scheme's 1A script builds one; the engine never builds a deck on its own.
   */
  | { readonly kind: "buildScenarioDeck"; readonly name: string }
  /**
   * "The player who defeated it takes that ally into their hand" (Captured by Hydra; docs/phase7-wave2.md §3.10): each
   * card goes to `player`'s hand and, if it has no owner (a scenario-specific player card set aside at setup), that player
   * becomes its owner. RRG 1.8 "Ownership and Control" (p. 31): "When a player takes control of a campaign-specific or
   * scenario-specific player card [...] that player becomes the owner of that card until the game ends or another player
   * takes control of that card." Its home becomes theirs, so a discard goes to their discard pile.
   */
  | { readonly kind: "takeIntoHand"; readonly cards: CardSelector; readonly player: PlayerRef }
  /**
   * Playing a card from hand from inside an ability. `player` chooses a card their hand holds that `filter` matches
   * and that can be played this way; `optional` is "you may". Exactly one of the two cost modes is set:
   *
   * - **`ignoreCost: true`** — "Play a card from your hand, ignoring its resource cost." (Chaos Magic;
   *   docs/phase7-wave2.md §3.8). Zero resources are paid (`playIgnoringCostFault` says which cards qualify).
   * - **`costReduction`** — "play a card from your hand that shares a trait with your hero, reducing its resource
   *   cost by 1" (Team-Building Exercise; docs/phase7-wave2.md §9). The player pays the reduced cost from their
   *   usual payment options, choosing an upgrade's host first when it has more than one.
   *
   * RRG 1.8 "Play, Put Into Play" (p. 32) and "Play Restrictions and Permissions" (p. 33): this is *playing* the
   * card, so form, "max per", Restricted, the unique rule and `cannotPlay` all apply, and it counts as played.
   */
  | {
      readonly kind: "playFromHand";
      readonly player: PlayerRef;
      readonly ignoreCost?: true;
      readonly costReduction?: ValueSpec;
      readonly filter?: TargetQuery;
      readonly optional?: boolean;
    }
  /** "Discard cards from the encounter deck until a minion is discarded": the matching card is bound to `bind` (then `putIntoPlay` / `revealCard` it). */
  | { readonly kind: "discardEncounterUntil"; readonly filter: TargetQuery; readonly bind: string }
  /**
   * "Discard cards from the top of your deck until you discard a Ms. Marvel card, then add that card to your hand"
   * (Teen Spirit): the player-deck sibling of `discardEncounterUntil`. The matching card is bound to `bind` (and its
   * count to `<bind>.count`, 0 when none was found) and is left in the discard pile, so a following `moveCards` takes
   * it from there. `player` naming several players ("each player") searches each of their decks in player order, and
   * every match goes into the one slot.
   *
   * RRG 1.8 "Player Deck" (p. 33) — read on its own, *not* carried over from the encounter-deck rule (p. 17), though
   * the two agree: "If a player deck empties, the player shuffles their discard pile to make a new deck. That player
   * immediately deals themself one facedown encounter card", and "if the player's deck empties while the player was
   * discarding cards from their deck, no further cards are discarded from the newly shuffled deck". So a deck emptied
   * mid-discard stops the effect, with whatever was found so far; a deck that was *already* empty when the effect
   * began resets first and the discarding then happens from the new deck, exactly as `discardEncounterCards` does.
   * A deck and discard pile both empty discard nothing and bind nothing (p. 33: "the deck does not reset until there
   * is at least one card in the player's discard pile").
   *
   * The reset happens the moment the deck empties (`settlePlayerDecks`, `ctx.ts`; ruling, Apr 30, 2026 (3) answer 7;
   * docs/phase7-wave3.md §4 Q15), so a match that was the deck's last card is already in the new deck when this effect
   * binds it. A `moveCards` of the slot still finds it there (§4 Q18).
   */
  | {
      readonly kind: "discardDeckUntil";
      readonly player: PlayerRef;
      readonly filter: TargetQuery;
      readonly bind: string;
    }
  /**
   * "Discard the top N cards of the encounter deck" (Electro, Lightning Bolt, Shock Therapy). The active villain's
   * deck (§3.2); each card goes to its own deck's discard pile (`home`).
   *
   * RRG 1.8 "Encounter Deck" (p. 17): "If a card ability discards a specified number of cards from the encounter
   * deck … discard cards from the encounter deck until the discard condition is met or the encounter deck is empty.
   * If the encounter deck is emptied this way, that card ability is considered to be fulfilled. Do not continue the
   * discard effect with the newly shuffled encounter deck." A deck that was *already* empty when the effect began is
   * reset first (with its acceleration token), and the discarding then happens from the new deck.
   *
   * `bind` binds the discarded cards to that slot, their number to `<bind>.count`, the sum of their boost icons
   * (printed plus modifiers) to `<bind>.boostIcons`, how many of them print a star icon in the boost area to
   * `<bind>.starIcons`, and their printed resource icons to `<bind>.physical` /
   * `.mental` / `.energy` / `.wild` — the same bind shape `moveCards` reports, so "1 indirect damage for each boost
   * icon discarded this way" reads `<bind>.boostIcons` whichever effect did the discarding. `<bind>.starIcons` is a
   * separate total, not a part of `<bind>.boostIcons` (RRG 1.8 "Boost, Boost Icon", p. 11: "A star icon is not itself
   * considered a boost icon"): "Discard the top 5 cards of the encounter deck. For each star icon in the boost area
   * discarded this way, place 1 threat on the main scheme" (Slipping Sanity 15023, `scw`) reads `<bind>.starIcons`,
   * and a discarded card printing both pips and a star adds to both totals. The totals cover exactly
   * the cards this effect reached: a discard cut short by the empty-deck rule above counts only what it got.
   * `forEachDiscarded` runs its
   * effects once per discarded card, in discard order, with that card bound to its `slot` ("Each time a Goblin minion
   * is discarded this way, choose …" — the card's own `if` narrows which discards it cares about).
   */
  | {
      readonly kind: "discardEncounterCards";
      readonly count: ValueSpec;
      readonly bind?: string;
      readonly forEachDiscarded?: { readonly slot: string; readonly effects: readonly EffectSpec[] };
    }
  /** "Place a random card from their hand facedown here" — tucked cards are out of play (RRG "Tuck"). */
  | { readonly kind: "tuckCards"; readonly cards: CardSelector; readonly under: TargetRef; readonly facedown?: boolean }
  /** "Assign X damage among heroes and allies": the chooser places it one point at a time; each character then takes its share as one damage event. */
  | {
      readonly kind: "assignDamage";
      readonly amount: ValueSpec;
      readonly among: TargetQuery;
      readonly chooser: PlayerRef;
    }
  /**
   * "Deal N indirect damage to each player" / "… to you" (RRG 1.8 "Indirect Damage", p. 24). Each player divides it
   * among the characters they control (one `assignIndirectDamage` choice, `authority: "player"`; user decision,
   * docs/phase7-wave1.md §4.7). A character's cap is its remaining hit points, and a character that cannot take the
   * damage gets none; damage nobody can be assigned is ignored. `"group"`: the first player divides it among every
   * friendly character. Everything assigned then resolves simultaneously as one `damageGroup`. `bind`: `<bind>.amount`
   * (damage taken, summed) and `<bind>.made`.
   */
  | {
      readonly kind: "dealIndirectDamage";
      readonly to: PlayerRef | "group";
      readonly amount: ValueSpec;
      readonly bind?: string;
      /**
       * Set by the engine for an enemy's attack that deals indirect damage (docs/phase7-wave3.md §3.16): the shares are
       * that attack's damage (`fromAttack`, reported to the frame's event, the attack), not a card effect's.
       */
      readonly fromAttack?: boolean;
    }
  | { readonly kind: "draw"; readonly player: PlayerRef; readonly amount: ValueSpec }
  /**
   * "Discard N cards from your hand" / "Each player must choose and discard 1 resource of any type from their hand
   * for each boost icon discarded this way" (Power Drain). `player` may name several players ("each player"): each
   * one chooses out of their own hand, in player order, one choice at a time.
   *
   * `amount` is a live `ValueSpec`, so the count can be something only known at resolution time (a summed
   * `<bind>.boostIcons`). `filter` narrows which hand cards may be discarded: "1 resource of any type" is a card with
   * a printed resource icon of any of the four types (`anyPrintedResource`) — ruling, Jan 11, 2026 (3), "the
   * discarded card must have a [] resource icon printed in its bottom-left corner", and RRG 1.8 "Resource" (p. 37)
   * lists exactly four resource *types*. A player holding fewer matching cards than `amount` discards every matching
   * card they hold and no more (the same "do what you can" the random form already uses; ruling, Feb 28, 2026 (4)).
   *
   * `random` discards at random instead of asking, and honours `filter` the same way.
   */
  | {
      readonly kind: "discardFromHand";
      readonly player: PlayerRef;
      readonly amount: ValueSpec;
      readonly random?: boolean;
      readonly filter?: TargetQuery;
    }
  /** Turns the top N encounter cards faceup without revealing them (RRG "Search"). */
  | {
      readonly kind: "revealTopOfEncounterDeck";
      readonly count: number;
      readonly then: "discard" | "returnToTop";
    }
  | { readonly kind: "exhaust"; readonly target: TargetRef }
  | { readonly kind: "ready"; readonly target: TargetRef }
  | { readonly kind: "giveStatus"; readonly target: TargetRef; readonly status: StatusName }
  | { readonly kind: "removeStatus"; readonly target: TargetRef; readonly status: StatusName }
  | {
      readonly kind: "addCounters";
      readonly target: TargetRef;
      readonly counterType: string;
      readonly amount: ValueSpec;
      /**
       * "(to a maximum of 10)" (Groot's growth counters, `gmw`; Drax's vengeance counters, `drax`): this effect places
       * at most as many as bring the card to `upTo`, and none when it already holds that many or more. Ruling, Mar 30,
       * 2026 (1): "'(to a maximum of X)' applies **locally** to that specific ability" — another card may take the card
       * past it (Captain Americat's counter on Drax, a fourth), and this does not remove the extra. docs/phase7-wave3.md
       * §3.10.
       */
      readonly upTo?: ValueSpec;
      /** `<bind>.amount`: how many were placed (summed over the targets) — "If you cannot, draw 1 card." (Drax). */
      readonly bind?: string;
    }
  | {
      readonly kind: "removeCounters";
      readonly target: TargetRef;
      readonly counterType: string;
      readonly amount: ValueSpec;
    }
  /**
   * "Attach 1 card from your hand facedown here" (Bruno Carrelli): `facedown` attaches it face down, and a facedown
   * card in play has no title, traits, keywords or abilities until it is turned faceup or leaves play.
   */
  | { readonly kind: "attach"; readonly card: TargetRef; readonly to: TargetRef; readonly facedown?: boolean }
  /**
   * `defeated`: the card leaves play because it was defeated, so Victory X sends it (and any Victory X attachment on it)
   * to the victory display instead (`defeatFromPlay`; RRG 1.8 "Victory X", p. 46). Set by the engine's side-scheme
   * defeat; a card that says "discard" never sets it. docs/phase7-wave3.md §3.4.
   */
  | { readonly kind: "discardFromPlay"; readonly target: TargetRef; readonly defeated?: boolean }
  /**
   * "Create 'The Collection' game area" (The Grand Collection 1A, `gmw` 16073a): an empty scenario out-of-play area named
   * `name` (`GameState.scenarioAreas`, docs/phase7-wave3.md §3.14). Nothing happens if it exists.
   */
  | { readonly kind: "createScenarioArea"; readonly name: string }
  /**
   * "Defeat a non-[Elite] minion." (Nova Prime, `stld` 17002): each target character is defeated outright, whatever its
   * remaining hit points (RRG 1.8 "Defeat", p. 15). It is a `characterDefeated` event marked `byEffect`, so "when X would
   * be defeated" interrupts, When Defeated, Victory X and responses all see it; `cannotBeDefeated` and the permanent
   * keyword still stop it. An ally or minion is discarded, an identity's player is eliminated, and a villain's stage falls
   * (RRG 1.8 "Villain Defeat", p. 47). Characters only. docs/phase7-wave3.md §3.9.
   */
  | { readonly kind: "defeat"; readonly target: TargetRef }
  /**
   * "Interrupt: When an ally is defeated by an enemy attack, return it to its owner's hand **instead of discarding
   * it**." (Regroup, `drax` 19032; docs/phase7-wave3.md §3.45): from an interrupt to a `characterDefeated` event, the
   * defeated card goes to `to` instead of its discard pile. `"hand"` and the deck destinations are its owner's. The
   * card is still defeated: When Defeated, "after … is defeated" and a `defeated` result all still apply. Only the
   * discard is replaced, so a Victory X card still goes to the victory display (RRG 1.8 "Victory X", p. 46: it is not
   * being discarded). A later interrupt's destination replaces an earlier one's. Does nothing outside that window.
   */
  | { readonly kind: "setDefeatDestination"; readonly to: CardDestination }
  /**
   * "Engage that enemy" (Get Over Here!). RRG 1.8 "Engage" (p. 18): "If a card ability instructs a player to engage a
   * minion, that minion is also considered to have engaged that player", and "while a minion is engaged with a
   * player, card abilities cannot cause the minion to engage with the same player again". The minion moves to that
   * player's play area and `minionEngaged` is announced; a minion already engaged with that player is left alone.
   */
  | { readonly kind: "engage"; readonly minion: TargetRef; readonly player: PlayerRef }
  /**
   * "Put the others back in any order" (Heimdall). RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card
   * instructs it. `chooser` orders the cards and they go back on top of the encounter deck in that order, the first
   * card chosen ending up on top.
   */
  | {
      readonly kind: "reorderCards";
      readonly cards: CardSelector;
      readonly chooser: PlayerRef;
      readonly to: "encounterDeckTop";
    }
  /**
   * "Set his hit point dial to 1 instead" (Captain America's Helmet), as a replacement for a defeat. RRG 1.8 "Hit
   * Points" (p. 22): the dial is the character's remaining hit points, so this sets sustained damage to maximum hit
   * points minus `amount`. It is not healing — the card does not say "heal" — so no heal event and no "after you heal"
   * response; logged as `hitPointsSet`. Engine reading, flagged in docs/phase7-wave1.md §3.13.
   */
  | { readonly kind: "setRemainingHitPoints"; readonly target: TargetRef; readonly amount: ValueSpec }
  /**
   * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…the amount of threat that event removes by
   * 2" (Shrink). RRG 1.8 "Event" (p. 19): "If an effect modifies the amount of damage an event deals … and that event
   * deals multiple instances of damage …, each of those instances is modified" (FAQ "Embiggen (#10)" and "Shrink
   * (#11)", p. 59). So this is a bonus on the *card*, applied to every damage / threat-removal that card's abilities
   * produce while it resolves, and it ends when that card finishes resolving — a card returned to hand and replayed
   * in the same phase does not keep it. Prevention is not removal, so Shrink does nothing for a prevent effect.
   */
  | {
      readonly kind: "modifyCardEffect";
      readonly card: TargetRef;
      readonly damage?: ValueSpec;
      readonly threatRemoved?: ValueSpec;
    }
  | { readonly kind: "putIntoPlay"; readonly card: TargetRef; readonly controller: PlayerRef }
  /**
   * "Deal an encounter card to each player" / "Deal 2 encounter cards to each player" (Green Goblin II). Cards come
   * from the active villain's deck (§3.2). With more than one player receiving cards the first player chooses the
   * order they receive them (RRG 1.8 "Each Player", p. 17; ruling, Jan 26, 2026 (4) answer 3: "the first player
   * chooses the order players receive cards … Distribution is AABB or BBAA"), so one player's whole share is dealt
   * before the next player's. One player receiving cards is dealt without asking.
   */
  | { readonly kind: "dealEncounterCard"; readonly player: PlayerRef; readonly count?: ValueSpec }
  /**
   * "Deal that card to yourself as a facedown encounter card" (You Dare Oppose Me?, `ron` 90005; docs/phase7-wave3.md
   * §3.47): a card already identified, not the encounter deck's top card. Each card `cards` names that is an encounter
   * card that can be dealt (attachment, environment, minion, obligation, side scheme, treachery) and is out of play
   * (the encounter deck or a discard pile, where "discarded this way" leaves it) goes facedown to the first player
   * `player` names, in `cards` order, into the same zone the villain phase deals to (RRG 1.8 "Deal", p. 15). A card in
   * play is not dealt: no printed card deals one. Logged as `cardMoved`, like every deal.
   */
  | { readonly kind: "dealAsEncounterCard"; readonly cards: TargetRef; readonly player: PlayerRef }
  | { readonly kind: "revealEncounterCard"; readonly player: PlayerRef }
  /**
   * "Give the villain 1 facedown boost card" (Hired Gun 02007, Intimidation 02035), outside any activation. Cards
   * come from the active villain's deck (§3.2) and go facedown onto each enemy `enemy` names.
   *
   * RRG 1.8 "Boost, Boost Icon" (p. 11): "If an enemy is dealt a boost card outside of its own activation, that
   * boost card remains facedown on that enemy until that enemy activates", and that enemy "still gets dealt another
   * boost card at the start of its activation as normal" — so the waiting card is resolved *in addition to* the
   * automatic one, in the order dealt. Distinct from `modifyAttack.extraBoostCards`, which is "1 additional boost
   * card **for this activation**" and only applies to the activation already in progress.
   */
  | { readonly kind: "giveBoostCard"; readonly enemy: TargetRef; readonly count?: ValueSpec }
  /**
   * "Place 1 acceleration token here" (The Master of Time 2B). `target` names the main scheme stage it goes on;
   * absent is the central one, which is where the encounter-deck reset puts it (RRG 1.8 "Acceleration Token", p. 5).
   * A constant `accelerationTokenDestination` rule may redirect it before it lands (docs/phase7-wave2.md §10.3).
   */
  | { readonly kind: "addAccelerationToken"; readonly target?: TargetRef; readonly count?: ValueSpec }
  | { readonly kind: "removeAccelerationToken" }
  /**
   * Advance the main scheme to its next stage (new stage's A-side When Revealed, then its starting threat). Also how the
   * engine finishes a completion after its When Completed abilities. An advance by card text is not a completion. On
   * the final stage it does nothing.
   */
  | {
      readonly kind: "advanceMainScheme";
      /**
       * "Advance the main scheme to stage 2" / "advance to stage 4A" (docs/phase7-wave2.md §3.4): the stage with this
       * number (and `name`, to pick one of several alternatives). Required to advance into a group of alternatives.
       */
      readonly to?: { readonly stageNumber: number; readonly name?: string };
      /** Which main scheme: absent is "the main scheme" of this effect's game area (`TargetRef mainScheme`). */
      readonly scheme?: TargetRef;
    }
  /** "If all the players at this stage are defeated, this stage is complete." (Kang's stage 3 cards): completes it now. */
  | { readonly kind: "completeMainScheme"; readonly scheme: TargetRef }
  /**
   * "The players win the game." (Kang (III)'s When Defeated) / "the players lose the game" (Kang's Arrival 1B, as a When
   * Completed). Logged with an existing outcome reason: a win as `villainDefeated`, a loss as `reason` (default
   * `mainSchemeCompleted`). Needed where `Scenario.victory` is `"cardAbility"` (docs/phase7-wave2.md §3.4).
   */
  | {
      readonly kind: "endGame";
      readonly result: "win" | "loss";
      readonly reason?: "mainSchemeCompleted" | "allPlayersDefeated";
    }
  /**
   * "Add Kang (Immortus) to the game area" / "Reveal Kang (III) and add him to the game area" (docs/phase7-wave2.md
   * §3.4): each set-aside villain `villain` names (bind it with `selectCards` over `encounterSetAside` first) enters play
   * as an additional villain, on its card's starting side and first stage. In a separate game area it joins that area
   * and becomes its active villain; otherwise it takes the active counter if the active villain is defeated. Its
   * toughness applies (RRG 1.8 "Toughness"); `reveal` also resolves its When Revealed ("Reveal Kang (III)").
   */
  | { readonly kind: "addVillain"; readonly villain: TargetRef; readonly reveal?: boolean }
  /**
   * "Remove Kang (Immortus) and this stage from the game": a villain leaves play, removed from the game rather than
   * defeated (no When Defeated, no win). Its attachments and boost cards are discarded as it leaves.
   */
  | { readonly kind: "removeVillain"; readonly villain: TargetRef }
  /**
   * "Remove the Chronopolis from the game" / "remove … this stage from the game": a separate game area's own main
   * scheme stage leaves play and its alternative can never be revealed again. The central stage cannot be removed.
   */
  | { readonly kind: "removeMainSchemeStage"; readonly scheme: TargetRef }
  /**
   * "Each player reveals a random stage 3A in turn order" (The Master of Time 2A): for each player `player` names, in
   * player order, a random stage with this number that has not been spent is revealed as a new main scheme instance —
   * its A side's When Revealed resolves with that player as "you" ("Create your own game area and place this scheme in
   * it"), then its B side's starting threat is placed. `removeUnused` then removes the rest of the group from the game
   * ("Remove any unused stage 3 schemes from the game"). Only in a scenario with `separateGameAreas`.
   */
  | {
      readonly kind: "revealMainSchemeStage";
      readonly player: PlayerRef;
      readonly stageNumber: number;
      readonly removeUnused?: boolean;
    }
  /**
   * "Create your own game area and place this scheme in it" (Kang's stage 3A cards): a new separate game area for the
   * resolving player, whose main scheme is this card (the stage instance `revealMainSchemeStage` created). The player's
   * cards come with them; side schemes already in play stay where they are (docs/phase7-wave2.md §3.1).
   */
  | { readonly kind: "createGameArea"; readonly scheme: TargetRef }
  /**
   * "Join another game area" / "combine your game area with another game area" (docs/phase7-wave2.md §3.1): every player
   * of this effect's area moves to another area, chosen by the first of them when there are several, with the area's
   * side schemes and villains ("Any side schemes that were in play in your previous game area become part of the game
   * area that you join. Any minions that were engaged with you remain engaged with you."). When no other separate area
   * remains, the players join the central area and the game is no longer split ("Players cannot join this game area
   * unless there are no other game areas remaining", The Master of Time 2B). Duplicate unique cards are then discarded,
   * the first player choosing ("If the players cannot agree which one to discard, the first player decides").
   */
  | { readonly kind: "joinGameArea" }
  /**
   * "At the end of the phase, …": a delayed effect, the phase counterpart of `atEndOfRound`. It fires when the current
   * phase ends: after the player phase's ready step, or with the round's end for the villain phase.
   */
  | { readonly kind: "atEndOfPhase"; readonly effects: readonly EffectSpec[] }
  /**
   * "Move all threat from the side scheme with the least threat to the side scheme with the most threat" (Tactical
   * Prowess); "move 1 threat from a scheme to here" (Beat Cop). `amount` absent moves all of it. RRG 1.8 "Move" (p. 30):
   * "If threat is moved off a scheme, the moved threat is considered to be removed from that scheme. If threat is moved
   * to a scheme, the moved threat is considered to be placed on that scheme", so a `removeThreat` then a `placeThreat`
   * event (docs/phase7-wave1.md §4.8, settled by that entry). No move to the same card, and none with nothing to move or
   * no destination. `bind`: `<bind>.made`, `<bind>.amount` (placed) and `<bind>.forcedResponses`, the number of forced
   * responses the placement triggered ("If that scheme's 'Forced Response' ability is not triggered this way …").
   */
  | {
      readonly kind: "moveThreat";
      readonly from: TargetRef;
      readonly to: TargetRef;
      readonly amount?: ValueSpec;
      readonly bind?: string;
    }
  /**
   * "Place the active counter on Wrecker" / "Move the active counter to the villain whose scheme has the most
   * threat" (The Wrecking Crew insert, "The Active Villain"). Moves it to the first undefeated villain `villain`
   * names; to choose among several (a tie), bind them with `chooseTarget` first. Logged as `activeVillainChanged`.
   */
  | { readonly kind: "setActiveVillain"; readonly villain: TargetRef }
  /**
   * "Flip Norman Osborn and Criminal Enterprise." RRG 1.8 "Flip" (p. 20): a face of the same card type keeps its
   * attached cards, tucked cards, status cards and tokens. Flipping is not revealing (rulings Jan 26, 2026 (4) answer
   * 2; Apr 30, 2026 (3) answer 3; Jun 25, 2026 (4) answer 3), so no reveal procedure and no reveal responses.
   * - A villain changes side on the same stage, and the new face's When Revealed resolves (Green Goblin insert: "Changing
   *   form will trigger Green Goblin's 'When Revealed' ability"). An activation in progress carries on with the new
   *   face's values (FAQ "Green Goblin (#1B)", p. 59).
   * - A double-sided encounter card (`flipSide`) turns to its other face.
   * Either way a `cardFlipped` event follows, for "after this card flips" abilities. A card with one face is unaffected.
   */
  | { readonly kind: "flipCard"; readonly target: TargetRef }
  /**
   * "Change Apocalypse to [Giant] form" (Staggering Strength, Biomorphic Blast; The Age of Apocalypse): a three-sided
   * villain (`VillainSideLetter` "C") turns to the face of its current stage card whose traits include `toFaceWithTrait`.
   * `flipCard` is undefined for such a villain, since "flip" doesn't say which of the two other faces. Resolves as a flip
   * (RRG 1.8 "Flip", p. 20). Works on a two-faced villain too, when card text names the face by a trait.
   */
  | { readonly kind: "changeVillainForm"; readonly villain: TargetRef; readonly toFaceWithTrait: Trait }
  /**
   * Parks a `chooseTarget` choice for `chooser` and binds the answer to `slot`.
   *
   * `count` is how many are chosen (default 1) and may be a `ValueSpec`: "deal 1 damage to X enemies", where X was
   * bound by the ability's cost (Shield Toss). The choices are distinct cards, so "different enemies" needs nothing
   * further — and a villain is one enemy however many stages its deck has (FAQ "Melee (#30)", p. 59: "different
   * stages of the villain are considered to be the same enemy"). With no legal target nothing is asked and the slot
   * is bound empty (RRG 1.8 "Choose (Game Element)", p. 12).
   *
   * - `upTo`: "up to X" (Thunderclap, Air Supremacy, Muster Courage): from 1 to `count`. §4 Q16, decided by the user
   *   on 2026-09-23: an effect's "up to N" chooses at least one whenever a legal target exists.
   * - `optional`: a printed "may" — the chooser may choose none. Never the reading of a bare "up to".
   */
  | {
      readonly kind: "chooseTarget";
      readonly slot: string;
      readonly query: TargetQuery;
      readonly chooser: PlayerRef;
      readonly count?: number | ValueSpec;
      readonly upTo?: true;
      readonly optional?: boolean;
    }
  | {
      readonly kind: "if";
      readonly condition: Predicate;
      readonly then: readonly EffectSpec[];
      readonly otherwise?: readonly EffectSpec[];
    }
  /** RRG "Cancel": stops the interrupted event from resolving (its responses do not fire). */
  | { readonly kind: "cancelTriggeringEvent" }
  /**
   * "Reduce the resource cost of the next card that player plays this phase by 1" (lasting, consumed on use).
   * `cardFilter` narrows which played card consumes it: "the next Avenger ally played this phase" (Avengers Tower,
   * `cap` pack). Absent = any card (Helicarrier).
   *
   * `amount` is **signed**: negative means "costs N additional resources" (Physical Toll, `drs` pack). The price is
   * floored at 0 either way.
   *
   * `duration` `"untilPlayed"` has **no phase or round bound at all** — the change waits however many rounds it
   * takes for that player to play a matching card ("the *next* event you play", with no "this phase"). Bounding
   * such a card to the current round would silently stop applying, so it is its own duration
   * (`LastingDuration.untilCardPlayed`).
   */
  | {
      readonly kind: "reduceNextCardCost";
      readonly player: PlayerRef;
      readonly amount: ValueSpec;
      /** `"turn"`: "…the next superpower card you play this turn" (Deft Focus, `magneto` 49023; docs/phase7-wave2.md §13). */
      readonly duration: "phase" | "round" | "turn" | "untilPlayed";
      readonly cardFilter?: TargetQuery;
    }
  /**
   * "Discard this obligation after you play an event" (Physical Toll, `drs` pack): a delayed effect whose timing
   * point is the next card `player` plays that `cardFilter` matches, rather than the end of a round or an attack.
   * The sibling of `atEndOfRound`/`atEndOfAttack` for that timing, and the half of a "the next card you play …"
   * sentence that isn't about cost. Fires once, after that card's play has finished resolving.
   */
  | {
      readonly kind: "afterNextCardPlayed";
      readonly player: PlayerRef;
      readonly effects: readonly EffectSpec[];
      readonly cardFilter?: TargetQuery;
    }
  /**
   * Writes a campaign-log field from inside the game: MC10 p. 7's "Record the number of delay counters on the main
   * scheme in the campaign log", and the card text of MC10's campaign upgrades (design §6.2).
   *
   * The write does **not** touch a campaign log — no game may. It accumulates in `GameState.campaignWrites` as a
   * plain `LogWrite`, which the runner folds into the log when the game ends, whatever the outcome (RRG 1.8 p. 29's
   * reading, design §6.2). `seat` absent writes the shared field; `{ kind: "each" }` writes the same value into every
   * seat's column (a *different* value per seat is `forEachPlayer` around this effect). Outside a campaign game
   * (no `GameState.campaign`) it does nothing.
   */
  | {
      readonly kind: "recordInCampaignLog";
      readonly field: string;
      readonly seat?: PlayerRef;
      readonly mode: LogWriteMode;
      readonly value: CampaignLogValueSpec;
    }
  /**
   * "Remove it from the campaign log" (MC10 p. 3 card text; MC32 p. 5's use-it-or-lose-it; MC60 p. 13).
   *
   * RRG 1.8 p. 29: "If a card is removed from a campaign, that card can no longer be used during the rest of the
   * campaign, even if players retry the scenario wherein that card was removed." Recorded **by face** — ruling
   * April 30, 2026 (4) answer 2, see `CampaignCardFace` — into `GameState.campaignWrites`, exactly like a log write
   * and for the same reason.
   *
   * It is a log operation only: what happens to the card *in this game* is whatever the printed sentence beside it
   * says ("Discard this card **and** remove it from the campaign log"), scripted as its own effect.
   */
  | { readonly kind: "removeFromCampaign"; readonly cards: CardSelector };

/** A player's own out-of-play zones a selector can read. */
export type PlayerZone = "hand" | "deck" | "discard";

/** Which cards a `moveCards`/`chooseCards` works on. */
export type CardSelector =
  | { readonly kind: "ref"; readonly ref: TargetRef; readonly filter?: TargetQuery }
  /**
   * The encounter deck and/or discard pile ("search the encounter deck and discard pile for …"): the active
   * villain's (ruling, Jan 17, 2026 (5)). `deckOf` names another villain's deck where card text does ("Reveal the
   * top card of *his* deck", Buddy System). That reading is docs/phase7-wave1.md §4.2's proposal (card text beats
   * the ruling's "only the active villain's encounter deck can be interacted with"), still open for FFG.
   */
  | {
      readonly kind: "encounter";
      readonly zones: readonly ("deck" | "discard")[];
      readonly filter?: TargetQuery;
      readonly top?: ValueSpec;
      readonly deckOf?: TargetRef;
    }
  /** A player's set-aside nemesis set. */
  | { readonly kind: "setAside"; readonly player: PlayerRef; readonly filter?: TargetQuery }
  /**
   * Scenario cards set aside at setup (a signature side scheme before Breakout 1A puts it into play). `random`: that many
   * of the matching cards at random, from the game's seeded RNG ("Place 1 random set-aside Captive ally facedown beneath
   * this scheme", Captured by Hydra; docs/phase7-wave2.md §3.12).
   */
  | { readonly kind: "encounterSetAside"; readonly filter?: TargetQuery; readonly random?: ValueSpec }
  /**
   * A scenario deck and/or its own discard pile (docs/phase7-wave2.md §3.3): "Reveal the top card of the Experimental
   * Weapons deck" → `{ name: "Experimental Weapons", top: 1 }`. `zones` defaults to the deck.
   */
  | {
      readonly kind: "scenarioDeck";
      readonly name: string;
      readonly zones?: readonly ("deck" | "discard")[];
      readonly top?: ValueSpec;
      readonly filter?: TargetQuery;
    }
  /** Cards tucked under a card ("each facedown card here"). */
  | { readonly kind: "tucked"; readonly under: TargetRef }
  /**
   * An identity's separate deck and/or its own discard pile: "the top card of the Invocation deck"
   * (docs/phase7-wave1.md §3.5). `zones` defaults to the deck.
   */
  | {
      readonly kind: "separateDeck";
      readonly player: PlayerRef;
      readonly name: string;
      readonly zones?: readonly ("deck" | "discard")[];
      readonly top?: ValueSpec;
      readonly filter?: TargetQuery;
    }
  /**
   * Every card any listed selector names, each once, in the order listed: "Each player searches the encounter deck,
   * discard pile, **and set-aside area** for their nemesis minion" (Kang's Wrath 4B, 11013; Marked for Death 04028)
   * is `anyOf [encounter deck+discard, that player's set-aside]` — one pool and one choice over everything found,
   * the way a multi-zone `zone` selector already works within a player's own zones.
   *
   * The `CardSelector` sibling of `AttachmentHost.anyOf`. Nesting is allowed and terminates, but says nothing a flat
   * list cannot.
   */
  | { readonly kind: "anyOf"; readonly of: readonly CardSelector[] }
  /** The cards in a scenario out-of-play area ("discard 1 card from The Collection"; docs/phase7-wave3.md §3.14). */
  | { readonly kind: "scenarioArea"; readonly name: string; readonly filter?: TargetQuery }
  /**
   * The cards a campaign-log field names, wherever they are in the game: "Shuffle each EXPERIMENTAL attachment
   * recorded in the campaign log into the encounter deck" (MC10 p. 7), MC21 p. 7's campaign pool, MC50 p. 19.
   *
   * A field lists *titles*, and a title can be listed more than once — ruling **June 2, 2026 (3)** answer 3, "Record
   * each copy individually (titles can appear multiple times)", and answer 4, "Remove a number of cards equal to the
   * count recorded". So each entry names one card: two entries of the same title name two instances, in the order
   * the game created them, and a title with no matching instance left names nothing.
   */
  | {
      readonly kind: "campaignLog";
      readonly field: string;
      readonly seat?: PlayerRef;
      readonly filter?: TargetQuery;
    }
  | {
      /**
       * A player's own zones. Several at once are searched as one pool: "search your deck **and** discard pile for a
       * Doctor Strange card" (Mystical Studies, For Asgard!, Agent Coulson) is a single choice among everything
       * found, not one choice per zone. `top` applies to each zone; `random` and `topmostOnly` to what they yield.
       */
      readonly kind: "zone";
      readonly zone: PlayerZone | readonly PlayerZone[];
      readonly player: PlayerRef;
      readonly filter?: TargetQuery;
      /** Only the top N cards of the zone (deck top, most recent discards). */
      readonly top?: ValueSpec;
      /** Only the first matching card from the top ("the topmost Tech upgrade"). */
      readonly topmostOnly?: boolean;
      /**
       * Only the last matching card from the top, i.e. the one closest to the actual bottom of the zone ("return
       * the bottommost attack or thwart event from your discard pile", Conditioning Room, `gam` 18008;
       * docs/phase7-wave3.md §3.26's own reading, promoted once the wording turned out not to compose from
       * existing vocabulary): the mirror of `topmostOnly`, over the same (optionally filtered) pool. Discarded
       * cards are prepended (`ctx.ts`'s `moveCard`, "top" position on discard), so the discard pile's own array
       * order already runs newest-first — the bottommost card is the pile's *last* element, exactly as the deck's
       * top is its first.
       */
      readonly bottommostOnly?: boolean;
      /** N cards chosen at random from the (filtered) zone, per player ("1 card at random from your hand"). */
      readonly random?: ValueSpec;
    };

/**
 * Where `moveCards` puts cards. Player cards go to their owner's zones; `discard` follows each card's `home`.
 * `encounterDeckShuffle` is the active villain's deck (ruling, Jan 17, 2026 (5): Cosmic Entity "shuffles it into
 * the active villain's encounter deck").
 *
 * `separateDiscard`, `separateDeckTop` and `separateDeckShuffle` send a card to the separate deck its `home` names,
 * owned by its owner ("Place this card in the Invocation deck discard pile", "place it back on top of the Invocation
 * deck faceup", "Shuffle the Invocation card under here into the Invocation deck"); any other card is left where it is.
 */
export type CardDestination =
  /** "Put it faceup into The Collection": a scenario out-of-play area, cards faceup (docs/phase7-wave3.md §3.14). */
  | { readonly scenarioArea: string }
  | "hand"
  | "discard"
  | "deckTop"
  | "deckBottom"
  | "deckShuffle"
  | "removedFromGame"
  | "encounterDeckShuffle"
  | "separateDiscard"
  | "separateDeckTop"
  | "separateDeckShuffle"
  /**
   * "Set aside the [X] modular encounter set" (Escape the Museum 1A, `gmw` 16082a): the shared set-aside pile
   * `ZoneId.encounterSetAside`/`CardSelector.encounterSetAside` already reads from (a signature side scheme's own
   * home before it enters play). No card printed before this needed *sending* a card there rather than reading it.
   */
  | "encounterSetAside";
