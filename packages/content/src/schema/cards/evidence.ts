import type { CardText, Trait } from "../common.js";
import type { AbilityReference } from "../abilities.js";
import type { CardId, EncounterSetId } from "../ids.js";
import type { BaseCard } from "./base.js";

/** The three kinds of evidence card, told apart by their card backs (MarvelCDB `evidence_means` / `_motive` / `_opportunity`). */
export type EvidenceKind = "means" | "motive" | "opportunity";

export const EVIDENCE_KINDS: readonly EvidenceKind[] = ["means", "motive", "opportunity"];

/**
 * The colors of the nine evidence cards' art and of their icons on the campaign log's grid (MC50 p. 24). Two cards are
 * blue (Wiretap, Authority), so a client tells evidence apart by icon and title, never by color alone.
 */
export type EvidenceColor = "orange" | "blue" | "pink" | "green" | "black" | "yellow" | "purple" | "red";

export const EVIDENCE_COLORS: readonly EvidenceColor[] = [
  "orange",
  "blue",
  "pink",
  "green",
  "black",
  "yellow",
  "purple",
  "red",
];

/**
 * An Agents of S.H.I.E.L.D. evidence card (wave 2 schema pass, docs/phase7-wave2.md §6.4): the nine cards of the
 * Executive Board Evidence set (50185–50193: three means, three motives, three opportunities).
 *
 * They are neither player cards nor encounter cards, and never enter any deck or play area. The Agents of S.H.I.E.L.D.
 * rulebook, "Executive Board" (p. 5): "The identity of the mole is determined by a combination of three elements: the
 * mole's motive [...], their means [...], and their opportunity [...]. These three elements are represented by a set of
 * three evidence cards that are randomly drawn at the start of the campaign, and kept hidden from the players in the
 * A.I.M. envelope. The remaining evidence cards are placed in the S.H.I.E.L.D. envelope." "Preparing the Evidence"
 * (p. 5): "Separate the nine evidence cards (185–193) by their card backs into three sets of three cards", one of each
 * into the A.I.M. envelope. "Gathering Evidence" (p. 6): "Evidence cards are not added to any deck once gained. Instead,
 * they provide the players with information about the mole, as well as a 'Setup' ability that is resolved by the
 * campaign setup instructions for each subsequent scenario."
 *
 * The standalone Baron Zemo scenario prepares the evidence too (p. 18, "Prepare the Evidence") and has the players
 * gain evidence during play, but "Ignore the text on the lower portion of the evidence card as this text only applies
 * during setup" of a campaign. So in a standalone game an evidence card is hidden information with no ability, and its
 * `abilities` are read only by campaign mode, which is not built. The engine refuses an evidence card in any deck.
 *
 * `evidenceIcon` is the icon the campaign log's combination grid is crossed off by ("cross out all combinations of
 * means, motive, and opportunity in the campaign log that use the icon shown on the new evidence card", p. 18). MarvelCDB
 * does not record it, so it is optional until curation reads it from the card image.
 */
export interface EvidenceCard extends BaseCard {
  readonly type: "evidence";
  readonly evidence: EvidenceKind;
  readonly encounterSetIds: readonly EncounterSetId[];
  readonly traits: readonly Trait[];
  readonly text: CardText;
  readonly abilities: readonly AbilityReference[];
  readonly evidenceIcon?: string;
  /** The card's color, read from the scan with `evidenceIcon` (docs/phase7-wave9.md section 1.16 item 2). */
  readonly evidenceColor?: EvidenceColor;
}

/**
 * One row of the Agents of S.H.I.E.L.D. campaign log's "Evidence Combinations" grid (MC50 p. 24): the three evidence
 * cards (one of each kind) that name one board member as the mole. 27 rows cover every combination once, nine per board
 * member. Read by the engine through the scenario record, never by card name (docs/phase7-wave9.md section 1.12).
 */
export interface EvidenceCombination {
  readonly means: CardId;
  readonly motive: CardId;
  readonly opportunity: CardId;
  /** The front face of the Board Member environment the combination names. */
  readonly boardMember: CardId;
}
