import type { CardText, ScalingValue, Trait } from "../common.js";
import type { KeywordInstance } from "../keywords.js";
import type { AbilityReference } from "../abilities.js";
import type { CardId, EncounterSetId, ImageRef } from "../ids.js";
import type { BaseCard } from "./base.js";
import type { ModeOnly } from "./encounter-cards.js";

/**
 * Icons printed in a scheme's threat box. Crisis blocks thwarting other
 * schemes; Hazard adds an encounter card per villain phase; Acceleration adds
 * to the main scheme's acceleration while the scheme is in play.
 */
export type SchemeIcon = "crisis" | "hazard" | "acceleration";

/** The threat values printed on a main scheme stage. */
export type MainSchemeThreatField = "startingThreat" | "targetThreat" | "acceleration";

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
 *
 * **Alternative stages** (wave 2). Stages that share a `stageNumber` are alternatives, not a sequence, and each must be
 * told apart by `stageLetter` or `name`. The Once and Future Kang prints four stage 3 cards (The Chronopolis,
 * Inexorable Fate, The Realm of Rama-Tut, The Present Future War); The Master of Time 2A: "Each player reveals a
 * random stage 3A in turn order. Remove any unused stage 3 schemes from the game." The default advance to "the next
 * stage" is not defined into a group of alternatives: a card ability must say which one (docs/phase7-wave2.md §3.1).
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
  /**
   * Threat values printed as "X". Each listed field holds `{ base: 0, perPlayer: 0 }`, and the stage's own
   * ability defines X (RRG 1.8 "Non-Numerical Variable": "If the variable is not defined [...] treat that variable
   * as being equal to 0"). Mutagen Cloud 2B prints an X acceleration: "X is equal to the number of Goblin enemies
   * (including Green Goblin) in play." (MarvelCDB `escalation_threat: -1`.)
   */
  readonly printedX?: readonly MainSchemeThreatField[];
  /**
   * Threat values printed as "—" (wave 2), each holding `{ base: 0, perPlayer: 0 }`. RRG 1.8 "Dash (Value)" (p. 15):
   * a value presented as a dash "cannot be used", and a referenced dash "is treated as an unmodifiable 0". The Master
   * of Time 2B (11008b) has no starting threat, target threat or acceleration: "When all the players have joined this
   * game area, advance to stage 4A." (MarvelCDB: `threat_fixed`, `base_threat_fixed`, `escalation_threat_fixed` with
   * no values). A stage with a dashed target threat is never completed by threat. Curation must confirm the dashes
   * from the card image. A field may not be both dashed and `printedX`.
   */
  readonly dashedValues?: readonly MainSchemeThreatField[];
  /**
   * The B side prints "If this stage is completed, the players lose the game." (or "If this scheme is completed, …").
   * RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27): only completing the **final** stage makes the villain win; any
   * other stage advances. This sentence makes completing *this* stage a loss too, even with stages after it — the
   * stages the players leave some other way: The Missing Milano 1B and Lost in the Museum 2B (`gmw` 16082b, 16083b,
   * "When the last threat is removed from this scheme, advance"), Kang's Arrival 1B (`toafk` 11007b, advanced by
   * defeating Kang I), Infiltrate A.I.M. Island Embassy 1B / Locate Missing Person 2B (`aos` 50087b, 50088b), Zemo's
   * Manipulations 1B (`aos` 50167b), Gotta Get Away 1B and Uncontrollable Power 1B (`next_evol` 40103b, 40166b).
   * Emitted on every stage that prints the sentence, final or not (on a final stage it restates the rule). A
   * compound sentence ("If this stage is completed or there are no Morlock allies in play, …") still sets it; its
   * other half is a script's (`stateCheck` + `endGame`). docs/phase7-wave3.md §3.37.
   */
  readonly completionLoses?: boolean;
  /**
   * The title of the villain this main scheme belongs to, printed "Proxima Midnight's Scheme." (Under Siege 1B, `mts`
   * 21098b) / "Corvus Glaive's Scheme." (The Armies of Thanos 2B, 21099b). MC21 p. 10: "When either of the two villains
   * schemes, place the threat on their matching main scheme card only." The main-scheme sibling of
   * `SideSchemeCard.signatureOf`; the sentence needs no ability ref. docs/phase7-wave4.md §1.5.
   */
  readonly villainOf?: string;
  /**
   * The stage card's other printed face when it is emitted as a card of its own, the stage-level sibling of
   * `BaseCard.otherFaceId`. Venom Goblin (MC27 p. 17, "Main Scheme Deck: Skies Over New York (A), Lower Manhattan (B),
   * Midtown Manhattan (C), Upper Manhattan (D)"): each of the four cards' other face is an environment (27116b–27119b),
   * whose own `otherFaceId` names this main scheme card. Such a stage prints no A side beyond what its card prints:
   * stages B–D have an empty `aSide`; stage A's `aSide` is the Setup and its threat values are all dashed.
   * docs/phase7-wave5.md §1.1.
   */
  readonly otherFaceId?: CardId;
  /**
   * `flipToOtherFace`: completing this stage flips it to `otherFaceId` (that face enters play and is revealed) instead
   * of advancing or losing. RRG 1.8 p. 67 erratum to MC27 p. 17: "When a main scheme is completed, flip it to its
   * environment side"; FAQ p. 62: "flip that main scheme to its environment side and reveal that environment."
   * docs/phase7-wave5.md §1.1. Data only until §3.3.
   */
  readonly onCompletion?: "flipToOtherFace";
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
  /** See `EncounterCardCommon.starIcon` (`encounter-cards.ts`) — same field, same backfill, side schemes just
   * aren't part of that shared interface. */
  readonly starIcon?: boolean;
  readonly traits: readonly Trait[];
  readonly keywords: readonly KeywordInstance[];
  readonly text: CardText;
  readonly flavor?: string;
  readonly abilities: readonly AbilityReference[];
  /**
   * The title of the villain this is the signature side scheme of, printed as "Wrecker's Side Scheme.".
   * The Wrecking Crew insert, "Signature Side Schemes": "These side schemes are not discarded when they have no
   * threat on them. Instead, these side schemes are removed from the game when their corresponding villain is
   * defeated." The printed "This card cannot leave play while [villain] is in play." is an ability, not this field.
   */
  readonly signatureOf?: string;
  /**
   * "Standard Mode Only." / "Expert Mode Only." printed on a side scheme whose standard/expert faces are emitted as
   * two separate `SideSchemeCard`s rather than a `flipSide` (a mode choice at setup, not something flipped during
   * play — Galaxy's Most Wanted's Campaign Challenge faces, 16178a/b–16182a/b, wave 3 §1.4; docs/phase7-wave4.md
   * §1.8). Mirrors `EncounterCardCommon.modeOnly` / `CardFlipSide.modeOnly`.
   */
  readonly modeOnly?: ModeOnly;
}
