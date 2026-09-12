import type { CardText, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard } from "./base.js";

/**
 * Icons printed in a scheme's threat box. Crisis blocks thwarting other
 * schemes; Hazard adds an encounter card per villain phase; Acceleration adds
 * to the main scheme's acceleration while the scheme is in play.
 */
export type SchemeIcon = "crisis" | "hazard" | "acceleration";

/**
 * The A side of a main scheme stage: stage 1A carries the scenario's `Setup:`
 * text, later A sides carry `When Revealed:` text that resolves when the main
 * scheme advances to that stage. "Advance to stage NB" is implicit — the
 * engine always continues onto the B side of the same stage.
 */
export interface MainSchemeASide {
  readonly text: CardText;
  readonly abilities: readonly AbilityReference[];
  /** Upstream artwork for the A side of this stage's card pair. */
  readonly image?: ImageRef;
}

/**
 * One main scheme stage (an A/B card pair). The top-level fields describe the
 * B side (threat values, B-side text and abilities); `aSide` is the A side.
 */
export interface MainSchemeStage {
  readonly stageNumber: number;
  /** The stage's own title when it differs from the card's (Klaw's stage 2 is "Secret Rendezvous"). */
  readonly name?: string;
  /** Branching stages (e.g. "2a"/"2b") share a `stageNumber` and differ by letter. */
  readonly stageLetter?: string;
  /** Threat placed on this stage when it becomes active. */
  readonly startingThreat: ScalingValue;
  /** Threat at which this stage completes (advance, or players lose on the last stage). */
  readonly targetThreat: ScalingValue;
  /** Threat added during each villain phase's "place threat" step. */
  readonly acceleration: ScalingValue;
  readonly icons: readonly SchemeIcon[];
  readonly text: CardText;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly abilities: readonly AbilityReference[];
  /** Upstream artwork for the B side, which is what these top-level fields describe. */
  readonly image?: ImageRef;
  readonly aSide: MainSchemeASide;
}

export interface MainSchemeCard extends BaseCard {
  readonly type: "main_scheme";
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly stages: readonly [MainSchemeStage, ...MainSchemeStage[]];
}

/**
 * Side schemes have no target: they enter with `startingThreat` and are
 * defeated when thwarted to 0.
 */
export interface SideSchemeCard extends BaseCard {
  readonly type: "side_scheme";
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly startingThreat: ScalingValue;
  readonly icons: readonly SchemeIcon[];
  readonly boostIcons: number;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
}
