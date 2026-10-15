/**
 * The active counter moving between villains, worded for the villain phase's own beat on the rail and its row in the
 * recap: "Active villain → Piledriver (Buddy System)". Before this it showed only in the log, so the board's ACTIVE tag
 * jumped to another villain for no reason the rail ever gave.
 */
import type { GameState } from "@mc/engine";
import { cardName } from "./names.js";
import type { ActiveVillainChange } from "./villain-walkthrough.js";

/** Why the counter moved, in a few words; null when the cause is just the card that moved it (named by `via`). */
const REASONS: Record<ActiveVillainChange["reason"], string | null> = {
  effect: null,
  activeVillainDefeated: "the active villain was defeated",
  focusedScheme: "its main scheme was focused",
  activationOrder: "activation order",
  noActiveVillain: "no villain was active",
  nextInRow: "moves along the row",
};

export interface ActiveVillainWording {
  /** "Active villain → Piledriver". */
  readonly headline: string;
  /** "Buddy System" (the card that moved it) or "moves along the row"; null when nothing says why. */
  readonly cause: string | null;
  /** A sentence for under the headline: "Moved by Buddy System." / "Moves along the row."; empty with no cause. */
  readonly detail: string;
  /** The headline with the cause in brackets: "Active villain → Piledriver (Buddy System)". */
  readonly line: string;
}

export function activeVillainWording(change: ActiveVillainChange, state: GameState): ActiveVillainWording {
  const headline = `Active villain → ${cardName(state, change.to)}`;
  const cause = change.via ? cardName(state, change.via) : REASONS[change.reason];
  const detail = cause
    ? change.via
      ? `Moved by ${cause}.`
      : `${cause.charAt(0).toUpperCase()}${cause.slice(1)}.`
    : "";
  return { headline, cause, detail, line: cause ? `${headline} (${cause})` : headline };
}
