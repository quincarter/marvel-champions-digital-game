import type { CardText, PrintedStat, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId } from "../ids.js";
import type { BaseCard } from "./base.js";
import type { AttachmentHost, PrintedStatModifiers } from "./attachment-host.js";

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
}

export interface MinionCard extends EncounterCardCommon {
  readonly type: "minion";
  /** `"X"` when the card's ability defines it (Titania); `null` for a printed "—". See `PrintedStat`. */
  readonly atk: PrintedStat;
  readonly sch: PrintedStat;
  readonly hp: number;
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
