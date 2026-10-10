// Hand-authored: the campaign log's "Evidence Combinations" grid is a picture on MC50 p. 24, not in MarvelCDB
// (docs/phase7-wave9.md section 1.12 and 1.16 item 3). Rows are by card id: means (50185 to 50187), motive (50188 to
// 50190), opportunity (50191 to 50193) and the front face of the board member the three name (50181a Chief Medical
// Officer, 50182a Chief Surveillance Officer, 50183a Chief Tactical Officer).
//
// Read from a 200 dpi render of the page with the nine evidence scans beside it (icon and color per card:
// `evidenceIcon` / `evidenceColor` on 50185 to 50193), and checked against the handoff's separate color-word reading in
// docs/phase7-wave9-handoff.md; `aos.test.ts` pins both readings and the structure (27 different triples, nine rows per
// board member, and the 5-1-3 pattern per evidence card, which one wrong cell breaks).

import { cardId } from "../../schema/index.js";
import type { EvidenceCombination } from "../../schema/index.js";

const row = (means: string, motive: string, opportunity: string, boardMember: string): EvidenceCombination => ({
  means: cardId(means),
  motive: cardId(motive),
  opportunity: cardId(opportunity),
  boardMember: cardId(boardMember),
});

/** The 27 rows of MC50 p. 24, sorted by means, then motive, then opportunity (the order of docs/phase7-wave9.md section 1.16 item 3). */
export const AOS_EVIDENCE_COMBINATIONS: readonly EvidenceCombination[] = [
  row("50185", "50188", "50191", "50181a"),
  row("50185", "50188", "50192", "50181a"),
  row("50185", "50188", "50193", "50183a"),
  row("50185", "50189", "50191", "50181a"),
  row("50185", "50189", "50192", "50182a"),
  row("50185", "50189", "50193", "50181a"),
  row("50185", "50190", "50191", "50183a"),
  row("50185", "50190", "50192", "50181a"),
  row("50185", "50190", "50193", "50183a"),
  row("50186", "50188", "50191", "50181a"),
  row("50186", "50188", "50192", "50181a"),
  row("50186", "50188", "50193", "50182a"),
  row("50186", "50189", "50191", "50181a"),
  row("50186", "50189", "50192", "50182a"),
  row("50186", "50189", "50193", "50182a"),
  row("50186", "50190", "50191", "50182a"),
  row("50186", "50190", "50192", "50182a"),
  row("50186", "50190", "50193", "50183a"),
  row("50187", "50188", "50191", "50181a"),
  row("50187", "50188", "50192", "50183a"),
  row("50187", "50188", "50193", "50183a"),
  row("50187", "50189", "50191", "50183a"),
  row("50187", "50189", "50192", "50182a"),
  row("50187", "50189", "50193", "50182a"),
  row("50187", "50190", "50191", "50183a"),
  row("50187", "50190", "50192", "50182a"),
  row("50187", "50190", "50193", "50183a"),
];
