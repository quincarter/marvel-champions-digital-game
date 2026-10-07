/**
 * Facts from outside the game (docs/phase7-wave7.md §3.83): what a card asks about that no game state holds, such as
 * how a player's previous game ended, how long the table was away, or whether a player spoke.
 *
 * One rule: an outside fact is an input. It reaches the engine either as setup input (`PlayerSetup.outsideFacts`,
 * frozen in `PlayerState.outsideFacts`) or as the answer to a `reportFact` choice, which is an ordinary
 * `resolveChoice` command in the log. The engine never reads a clock, a profile or a microphone, so replaying a log
 * reproduces the game. How a client obtains a fact is the client's business (§4.1 Q48, Q49, Q50).
 */

/** Facts known before the game starts, per seat. Absent means false. */
export interface OutsideFacts {
  /**
   * This seat's player won their previous game (§4.1 Q48: the client reads it from the seat's local profile history
   * and snapshots it here at setup). Absent means "did not win", which is also the Deadpool insert's reading of a
   * forgotten game and of a first game.
   */
  readonly wonPreviousGame?: boolean;
}

export type SetupOutsideFact = keyof OutsideFacts;

/** Facts known only when a card resolves, reported by the addressed player as the answer to a `reportFact` choice. */
export type ReportedFact = "minutesAway" | "talkedThisPhase";

/** The shape of a reported fact's answer: a whole number of 0 or more with no upper bound, or yes/no. */
export type ReportedFactAnswer = "wholeNumber" | "yesNo";

export const REPORTED_FACT_ANSWER: Readonly<Record<ReportedFact, ReportedFactAnswer>> = {
  minutesAway: "wholeNumber",
  talkedThisPhase: "yesNo",
};

/** The two option ids of a yes/no `reportFact` choice. */
export const REPORT_YES = "yes";
export const REPORT_NO = "no";

/**
 * The number a `wholeNumber` report names, or null when the text is not one: decimal digits with no sign, no leading
 * zero and no fraction, at most `Number.MAX_SAFE_INTEGER`. One spelling per number, so a log holds each answer in one
 * form.
 */
export function reportedNumberOf(text: string): number | null {
  if (!/^(0|[1-9]\d{0,15})$/.test(text)) return null;
  const amount = Number(text);
  return Number.isSafeInteger(amount) ? amount : null;
}
