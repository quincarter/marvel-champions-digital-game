import type { CardText, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard } from "./base.js";

export interface VillainStage {
  /** Printed stage numeral (I/II/III). Standard uses I–II, Expert II–III. */
  readonly stageNumber: number;
  readonly hp: ScalingValue;
  readonly atk: number;
  readonly sch: number;
  readonly text: CardText;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly abilities: readonly AbilityReference[];
  /** Upstream artwork. Each stage is its own printed card, so the ref lives here. */
  readonly image?: ImageRef;
}

/**
 * Some villains are printed as two distinct sides (e.g. an alternate-form
 * fight), each with their own stage progression — not to be confused with a
 * hero identity's hero/alter-ego faces, which always coexist rather than
 * being alternative fights.
 */
export interface VillainSide {
  readonly side: "A" | "B";
  /** Usually equal to the card's name, but some alternate sides use a different display name. */
  readonly name: string;
  readonly stages: readonly [VillainStage, ...VillainStage[]];
}

export interface VillainCard extends BaseCard {
  readonly type: "villain";
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly sides: readonly [VillainSide, ...VillainSide[]];
}
