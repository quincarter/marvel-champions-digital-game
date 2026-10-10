/**
 * What an accusation over an evidence grid is, read from state alone (docs/phase7-wave9.md §3.29 (b); MC50 pp. 18 and
 * 19). The two effects that write it are in `resolve/accusation.ts`; everything here is a pure read, for the engine's
 * queries and for a client drawing the grid.
 */

import type { CardId, EvidenceCombination } from "@mc/content";
import type { InstanceId } from "./ids.js";
import type { AccusationGuess, GameState } from "./state.js";

/** The three evidence cards of a grid row, in the order MC50 p. 19 lists them. */
export const EVIDENCE_FIELDS = ["means", "motive", "opportunity"] as const;

/** The id a grid row is offered and answered under: its three evidence cards, which name one row of a grid. */
export const evidenceRowId = (row: EvidenceCombination): string => `${row.means}+${row.motive}+${row.opportunity}`;

/**
 * The rows of `grid` that are not crossed out: the ones with no card that has come out of a hidden pile faceup. Open
 * information, built from `GameState.revealedPileCards` alone, so a client may draw the grid from it. Once the mole is
 * identified its own cards are faceup and its row is crossed out with the rest; `GameState.accusation` names it.
 */
export function openEvidenceRows(
  state: Pick<GameState, "revealedPileCards">,
  grid: readonly EvidenceCombination[],
): readonly EvidenceCombination[] {
  const faceup = new Set<CardId>(Object.values(state.revealedPileCards ?? {}).flat());
  return grid.filter((row) => !EVIDENCE_FIELDS.some((field) => faceup.has(row[field])));
}

/** Which of the four guesses of `accused` differ from `mole`, in the order means, motive, opportunity, board member. */
export function wrongGuessesOf(accused: EvidenceCombination, mole: EvidenceCombination): readonly AccusationGuess[] {
  return ([...EVIDENCE_FIELDS, "boardMember"] as const).filter((field) => accused[field] !== mole[field]);
}

/** How many guesses the players got wrong: 0 until a mole is identified against an accusation. */
export const accusationWrongGuesses = (state: GameState): number => state.accusation?.wrong?.length ?? 0;

/** Whether the accused board member is not the mole; false until a mole is identified against an accusation. */
export const accusedWrong = (state: GameState): boolean => state.accusation?.wrong?.includes("boardMember") === true;

/**
 * Whether the card `id` is the board member an accusation names in `role`: the card of the row's `boardMember`, on
 * either face (a card whose other face is a card of its own shows that face's card id once flipped).
 */
export function isAccusationBoardMember(state: GameState, id: InstanceId, role: "accused" | "mole"): boolean {
  const named = state.accusation?.[role]?.boardMember;
  const cardId = state.instances[id]?.cardId;
  if (named === undefined || cardId === undefined) return false;
  return cardId === named || state.cardPool[cardId]?.otherFaceId === named;
}
