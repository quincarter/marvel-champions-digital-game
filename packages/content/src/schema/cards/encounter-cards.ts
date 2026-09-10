import type { CardText, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId } from "../ids.js";
import type { BaseCard } from "./base.js";

/**
 * Every card that can sit in the encounter deck carries boost icons (0–3),
 * because the encounter deck *is* the boost deck. A boost-star effect is
 * represented as an ability with `trigger: "boost_effect"`, not a flag.
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
  readonly atk: number;
  readonly sch: number;
  readonly hp: number;
}

export type AttachmentTarget = "villain" | "hero" | "ally" | "any_character" | "main_scheme" | "side_scheme";

export interface AttachmentCard extends EncounterCardCommon {
  readonly type: "attachment";
  readonly attachesTo: AttachmentTarget;
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
