import type { Aspect } from "../aspects.js";
import type { CardText, PrintedStat, ResourceIconCounts, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { BaseCard } from "./base.js";
import type { AttachmentHost } from "./attachment-host.js";

/**
 * Printed play restrictions, as data the engine enforces when a card is played:
 * - `maxPerPlayer`: "Max 1 per player" (in play under one player's control).
 * - `maxPerHost`: "Max 1 per enemy" / "Max 1 per ally" (copies attached to one host).
 * - `form`: "Hero form only" / "Alter-Ego form only" — the player's form when playing it.
 * - `anyPlayerControl`: "Play under any player's control".
 */
export interface PlayRestrictions {
  readonly maxPerPlayer?: number;
  readonly maxPerHost?: number;
  readonly form?: "hero" | "alterEgo";
  readonly anyPlayerControl?: boolean;
}

/** Fields shared by every card that lives in a player's own deck. */
interface PlayerCardCommon extends BaseCard {
  readonly aspect: Aspect;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  /** Deckbuilding copy limit (MarvelCDB `deck_limit`; "Max 1 per deck"). */
  readonly deckLimit: number;
  readonly playRestrictions?: PlayRestrictions;
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
