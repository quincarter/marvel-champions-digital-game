import type { Aspect, CoreAspect } from "../aspects.js";
import type { CardText, PrintedStat, ResourceIconCounts, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId } from "../ids.js";
import type { BaseCard } from "./base.js";
import type { AttachmentHost } from "./attachment-host.js";
import type { CardFlipSide } from "./encounter-cards.js";

/**
 * Printed play restrictions, as data the engine enforces when a card is played:
 * - `maxPerPlayer`: "Max 1 per player" (in play under one player's control).
 * - `maxPerHost`: "Max 1 per enemy" / "Max 1 per ally" / "Max 1 per scheme" (copies attached to one host).
 * - `form`: "Hero form only" / "Alter-Ego form only" — the player's form when playing it.
 * - `anyPlayerControl`: "Play under any player's control".
 * - `maxPerRound`: "Max 1 per round." (Avengers Assemble!). RRG 1.8 "Max, Maximum": "'Max X per [period]'
 *   imposes a maximum number of times that copies of that card can be played during the designated time period",
 *   counted "across all copies of a card (by title) for all players", and "If a card with a maximum is canceled,
 *   the card is still counted toward the maximum."
 * - `requiresIdentityTrait`: "Play only if your identity has the Avenger trait." (Honorary Avenger, Quincarrier,
 *   Inspiring Presence) and "Play only if you have the Mystic trait." (The Sorcerer Supreme; RRG 1.8 "You, Your":
 *   "you" resolves to your identity). Printed or gained traits both count (RRG 1.8 "Gains").
 * - `requiresControlledCharacterTrait`: "Play only if you control a Spy character." (Spycraft, Espionage). Your
 *   identity is a character you control.
 *
 * - `maxPerPhase`: "Max 1 per phase." (Maximum Velocity, wave 2). The same RRG 1.8 "Max, Maximum" rule (p. 28) with
 *   the phase as the period.
 *
 * "Play only if you are in [Giant] hero form." (Giant Stomp, Hive Mind) needs no field of its own: it is
 * `form: "hero"` plus `requiresIdentityTrait: GIANT` (or TINY), because the trait is printed on that hero face only
 * (docs/phase7-wave2.md §1.3).
 *
 * The Phase 7 fields are data only until the engine enforces them (docs/phase7-wave1.md §3.10). A card carrying one
 * must not be marked playable before then; `maxPerPhase` is data only (docs/phase7-wave2.md §3).
 */
export interface PlayRestrictions {
  readonly maxPerPlayer?: number;
  readonly maxPerHost?: number;
  readonly form?: "hero" | "alterEgo";
  readonly anyPlayerControl?: boolean;
  readonly maxPerRound?: number;
  readonly requiresIdentityTrait?: Trait;
  readonly requiresControlledCharacterTrait?: Trait;
  readonly maxPerPhase?: number;
}

/**
 * A player card's membership of a scenario's or a campaign's set, beside (not instead of) its `aspect`.
 *
 * RRG 1.8 "Classifications" (p. 12): "Cards in the 'scenario-specific' classification are cards that belong to a
 * scenario's set of accompanying cards" and "Cards in the 'campaign-specific' classification are cards that can only
 * be used during a campaign from the same product." RRG 1.8 "Campaign-Specific Card" (p. 11): "Campaign-specific cards
 * can only be used during a campaign from the same product (determined by that product's set icon)."
 *
 * - `scenario`: Taskmaster's four Captive allies (04097–04100), set aside by Hunting Down Heroes 1A and taken into a
 *   player's hand by Captured by Hydra. RRG 1.8 "Ownership and Control" (p. 31): "When a player takes control of a
 *   campaign-specific or scenario-specific player card [...] that player becomes the owner of that card until the game
 *   ends or another player takes control of that card."
 * - `campaign`: The Rise of Red Skull's Hydra Campaign upgrades (04155–04162), printed "Campaign / Basic" (the Red
 *   Skull rulebook, p. 3, "Campaign-Only Cards": "These cards cannot be included in any player's deck unless they are
 *   playing The Rise of Red Skull campaign and the players were directed to add them to their decks").
 *
 * - `competitive` (wave 2 schema pass, docs/phase7-wave2.md §6.3): the four basic player cards paired with each Civil War
 *   leader (The Futurist, Target Lock, High-Tech Suit, Suit Up with Iron Man; MarvelCDB `faction_code: "basic"` in the
 *   leader's `card_set_code`). The Civil War rulebook, "Custom Scenario Expansion" (p. 3): "each leader comes paired
 *   with 4 basic player cards. These leader-specific player cards are used only when playing in competitive mode."
 *   `encounterSetId` is the leader's set.
 *
 * `validateDeck` refuses all three outside their mode (`campaign_card`, `scenario_card`, `competitive_card`). Campaign
 * mode and competitive (team-vs-team) mode are not built yet (PLAN.md Phase 7, "Wave 2 scope decided").
 */
export interface SpecificSet {
  readonly kind: "scenario" | "campaign" | "competitive";
  readonly encounterSetId: EncounterSetId;
}

/**
 * A printed cost that is not a number. The matching `cost` field holds 0, as `VillainStage.dashedStats` and
 * `MainSchemeStage.printedX` do, so existing readers keep compiling:
 * - `"X"`: Speed Cyclone (14006), "Hero Action: Stun X Enemies." (MarvelCDB `cost: -1`). RRG 1.8 "Non-Numerical
 *   Variable" (p. 30): "For costs involving the letter X, the value of X is defined by card ability or player choice,
 *   after which the amount paid may be modified by effects without changing the value of X." Out of play, an
 *   undefined X is 0 (same entry).
 * - `"dash"`: RRG 1.8 "Dash (Value)" (p. 15): "If a card has a dash (–) as its cost value, that card cannot be played
 *   and can only enter play through other means." The Hydra Campaign "Basic" Condition upgrades (04159a–04162a) have
 *   no cost in MarvelCDB and enter play through Setup; curation must confirm the printed dash from the card image.
 */
export type SpecialCost = "X" | "dash";

/** Fields shared by every card that lives in a player's own deck. */
interface PlayerCardCommon extends BaseCard {
  readonly aspect: Aspect;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  /**
   * Deckbuilding copy limit (MarvelCDB `deck_limit`; "Max 1 per deck"). A positive integer, except 0 on a card
   * with `separateDeck`, which cannot be put in a player deck at all.
   */
  readonly deckLimit: number;
  readonly playRestrictions?: PlayRestrictions;
  /**
   * The name of the separate deck this card belongs to instead of a player deck ("Invocation").
   *
   * RRG 1.8 "Deck" (p. 15): "There are four main types of decks that appear in a game: the player deck, the
   * encounter deck, the villain deck, and the main scheme deck. Certain identities or scenarios may add other decks
   * to the game." The Doctor Strange Hero Pack insert: "he begins each game with a special, five-card 'INVOCATION
   * deck' in addition to his player deck."
   *
   * Such a card is listed by its identity's `HeroIdentityCard.separateDecks`, built at setup, never listed in a
   * `Deck` or `StarterDeck`, and not counted toward deck size. `validateDeck` refuses it in a card list.
   */
  readonly separateDeck?: string;
  /**
   * The aspect printed on an identity-specific card that also belongs to an aspect (wave 2). Spider-Woman's set holds
   * Venom Blast (Aggression), Pheromones (Leadership), Contaminant Immunity (Protection) and Inconspicuous (Justice):
   * MarvelCDB gives them the aspect's `faction_code` with `card_set_code: spider_woman`.
   *
   * `aspect` stays the identity set (`hero:04031a`), because deckbuilding treats them as identity-specific: RRG 1.8
   * "Identity-Specific Card" (p. 23) requires "each identity-specific card associated with their chosen identity", and
   * the printed Spider-Woman precon (Red Skull rulebook, p. 18) lists them under "Spider-Woman cards", apart from its 11
   * Aggression and 11 Justice cards. Card effects that ask for "an aspect card" or "an Aggression card" (Superhuman
   * Agility, Finesse, Jessica Drew's Apartment, The Power of Aggression) read this field too. Must not be `"basic"`.
   */
  readonly printedAspect?: CoreAspect;
  /** Scenario- or campaign-specific set membership (see `SpecificSet`). Absent for an ordinary player card. */
  readonly specificTo?: SpecificSet;
  /**
   * The other face of a double-sided player card of the same card type (see `CardFlipSide`): the Hydra Campaign
   * "Basic X Upgrade" (04159a) flips to "Improved X Upgrade" (04159b). The top-level fields are the face that is put
   * into a deck. RRG 1.8 "Double-Sided Card" (p. 17) and "Flip" (p. 20) apply as for encounter cards.
   */
  readonly flipSide?: CardFlipSide;
}

/** Fields of a card with a printed resource cost. */
interface CostedCard {
  /** The printed resource cost; 0 when `specialCost` is set. */
  readonly cost: number;
  /** A printed "X" or "—" cost (see `SpecialCost`). Absent for a numeric cost. Data only until the engine reads it. */
  readonly specialCost?: SpecialCost;
}

export interface AllyCard extends PlayerCardCommon, CostedCard {
  readonly type: "ally";
  readonly resourceIcons: ResourceIconCounts;
  /** `null` = printed "—" (cannot attack); see `PrintedStat`. */
  readonly atk: PrintedStat;
  /** `null` = printed "—" (cannot thwart; Hulk); see `PrintedStat`. */
  readonly thw: PrintedStat;
  /**
   * Printed hit points. May be 0 (wave 2): Ant-Man (12011) and Wasp (13012) allies print 0 and get "+1 hit point for
   * each pym counter" placed by an "Interrupt: When [this ally] enters play" (docs/phase7-wave2.md §3.9).
   */
  readonly hp: number;
  /** The small number printed beside ATK/THW: damage the ally takes after using that icon (RRG "Consequential Damage"). */
  readonly consequentialDamage: {
    readonly attack: number;
    readonly thwart: number;
  };
}

export interface EventCard extends PlayerCardCommon, CostedCard {
  readonly type: "event";
  readonly resourceIcons: ResourceIconCounts;
}

export interface SupportCard extends PlayerCardCommon, CostedCard {
  readonly type: "support";
  readonly resourceIcons: ResourceIconCounts;
}

export interface UpgradeCard extends PlayerCardCommon, CostedCard {
  readonly type: "upgrade";
  readonly resourceIcons: ResourceIconCounts;
  /** "Attach to a minion" / "Attach to an ally". Absent = attaches to your own identity. */
  readonly attachesTo?: AttachmentHost;
}

/** Resource cards have no cost and no ATK/THW/etc — they exist to produce icons when spent. */
export interface ResourceCard extends PlayerCardCommon {
  readonly type: "resource";
  readonly producesIcons: ResourceIconCounts;
}

/**
 * "Player Side Scheme" card type, introduced NeXt Evolution (per Hall of
 * Heroes keyword-list page: "represents hero missions; follows standard
 * player card rules"). Lives in a player's deck/play area rather than the
 * encounter side, but behaves like a side scheme (threat threshold to
 * resolve).
 */
export interface PlayerSideSchemeCard extends PlayerCardCommon, CostedCard {
  readonly type: "player_side_scheme";
  readonly resourceIcons: ResourceIconCounts;
  readonly startingThreat: ScalingValue;
}

export type PlayerCard = AllyCard | EventCard | SupportCard | UpgradeCard | ResourceCard | PlayerSideSchemeCard;
