import type { Aspect } from "../aspects.js";
import type { CardText, PrintedStat, ResourceIconCounts, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { BaseCard } from "./base.js";
import type { AttachmentHost } from "./attachment-host.js";

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
 * The Phase 7 fields are data only until the engine enforces them (docs/phase7-wave1.md §3.10). A card carrying one
 * must not be marked playable before then.
 */
export interface PlayRestrictions {
  readonly maxPerPlayer?: number;
  readonly maxPerHost?: number;
  readonly form?: "hero" | "alterEgo";
  readonly anyPlayerControl?: boolean;
  readonly maxPerRound?: number;
  readonly requiresIdentityTrait?: Trait;
  readonly requiresControlledCharacterTrait?: Trait;
}

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
}

export interface AllyCard extends PlayerCardCommon {
  readonly type: "ally";
  readonly cost: number;
  readonly resourceIcons: ResourceIconCounts;
  /** `null` = printed "—" (cannot attack); see `PrintedStat`. */
  readonly atk: PrintedStat;
  /** `null` = printed "—" (cannot thwart; Hulk); see `PrintedStat`. */
  readonly thw: PrintedStat;
  readonly hp: number;
  /** The small number printed beside ATK/THW: damage the ally takes after using that icon (RRG "Consequential Damage"). */
  readonly consequentialDamage: {
    readonly attack: number;
    readonly thwart: number;
  };
}

export interface EventCard extends PlayerCardCommon {
  readonly type: "event";
  readonly cost: number;
  readonly resourceIcons: ResourceIconCounts;
}

export interface SupportCard extends PlayerCardCommon {
  readonly type: "support";
  readonly cost: number;
  readonly resourceIcons: ResourceIconCounts;
}

export interface UpgradeCard extends PlayerCardCommon {
  readonly type: "upgrade";
  readonly cost: number;
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
export interface PlayerSideSchemeCard extends PlayerCardCommon {
  readonly type: "player_side_scheme";
  readonly cost: number;
  readonly resourceIcons: ResourceIconCounts;
  readonly startingThreat: ScalingValue;
}

export type PlayerCard =
  | AllyCard
  | EventCard
  | SupportCard
  | UpgradeCard
  | ResourceCard
  | PlayerSideSchemeCard;
