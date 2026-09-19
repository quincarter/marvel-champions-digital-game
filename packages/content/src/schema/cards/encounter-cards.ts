import type { CardText, PrintedStat, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard } from "./base.js";
import type { AttachmentHost, PrintedStatModifiers } from "./attachment-host.js";

/**
 * The other face of a double-sided encounter card whose two faces have the same card type: the Criminal
 * Enterprise environment is flipped to State of Madness and back ("If there are no infamy counters here, flip
 * Norman Osborn and Criminal Enterprise.").
 *
 * The top-level fields describe the face that enters play; this is the face it flips to. RRG 1.8
 * "Double-Sided Card": "A card is double-sided if neither of its sides has a card back". RRG 1.8 "Flip": when the
 * new face has "the same card type as the previous face, the card retains all attached cards, tucked cards, status
 * cards, and tokens." A back face of a different card type is not modeled yet. Its ability ids must not repeat
 * the front face's.
 *
 * Player cards use the same shape (`PlayerCardCommon.flipSide`, wave 2): The Rise of Red Skull's campaign "Basic"
 * Condition upgrades flip to their "Improved" side, and later packs print double-sided upgrades of one card type
 * (Phoenix Force, Psi-Knife / Psi-Katana, Solid / Phased).
 */
export interface CardFlipSide {
  readonly name: string;
  readonly subtitle?: string;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  readonly image?: ImageRef;
}

/** The wave 1 name of `CardFlipSide`, kept so existing imports compile. */
export type EncounterCardFlipSide = CardFlipSide;

/**
 * Every card that can sit in the encounter deck carries boost icons (0–3),
 * because the encounter deck *is* the boost deck. A boost-star effect is an
 * ability whose engine registry entry has a `boost` trigger, not a flag.
 */
interface EncounterCardCommon extends BaseCard {
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly boostIcons: number;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  /** Present on a double-sided card: the face it flips to (see `EncounterCardFlipSide`). */
  readonly flipSide?: EncounterCardFlipSide;
  /**
   * The identity separate deck this encounter card belongs to (docs/phase7-wave2.md §15): Hercules's Labor cards,
   * which have an alternate encounter card back and never enter the encounter deck, a discard pile or a hand (Hercules
   * Hero Pack insert). Listed by that identity's `IdentitySeparateDeck` with `cardFamily: "encounter"`, never by a
   * scenario or an encounter set, so `encounterSetIds` is empty. The encounter-side sibling of
   * `PlayerCardCommon.separateDeck`.
   */
  readonly separateDeck?: string;
}

export interface MinionCard extends EncounterCardCommon {
  readonly type: "minion";
  /** `"X"` when the card's ability defines it (Titania); `null` for a printed "—". See `PrintedStat`. */
  readonly atk: PrintedStat;
  readonly sch: PrintedStat;
  readonly hp: number;
  /**
   * True on the minion a nemesis set names as the hero's nemesis, printed as reminder text such as "(Captain
   * America's nemesis minion.)". Core's Shadow of the Past reads "Reveal your set-aside nemesis minion", and wave 1
   * nemesis sets hold other minions too (Hydra Soldier with Baron Zemo, Edison's Giant Robot with Thomas Edison), so
   * "a minion in the set" is not enough to find it.
   */
  readonly nemesisMinion?: boolean;
}

export interface AttachmentCard extends EncounterCardCommon {
  readonly type: "attachment";
  readonly attachesTo: AttachmentHost;
  /** Printed stat-box modifiers applied to the host (Charge +3 ATK). */
  readonly statModifiers?: PrintedStatModifiers;
}

export interface TreacheryCard extends EncounterCardCommon {
  readonly type: "treachery";
}

/** Each hero's obligation is shuffled into the encounter deck during setup. */
export interface ObligationCard extends EncounterCardCommon {
  readonly type: "obligation";
}

export interface EnvironmentCard extends EncounterCardCommon {
  readonly type: "environment";
}

export type EncounterCard = MinionCard | AttachmentCard | TreacheryCard | ObligationCard | EnvironmentCard;
