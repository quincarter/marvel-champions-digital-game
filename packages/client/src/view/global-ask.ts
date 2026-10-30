/**
 * The one-time "Share your results?" question as plain decisions and words. Kept apart from `global-stats-ui.ts` (which
 * folds Everyone's rows through the stats model) so Title's chunk, which launches the question, stays small.
 */
import type { GlobalConsent } from "../global-stats/global-consent.js";

export const GLOBAL_ASK_TITLE = "Share your results?";
export const GLOBAL_ASK_BODY =
  "Share your finished games to build win rates for everyone? This sends the villain, modular sets, difficulty, heroes, aspects, the cards in your deck, the result and why a game was lost. It sends no name, account or device, and nothing from games you have already finished. You can change this in Settings.";
export const GLOBAL_ASK_BUTTONS = { share: "Share", decline: "No thanks" } as const;
export type GlobalAskAnswer = "share" | "decline";

/** The question opens over a live Title at an unpredictable moment: a press in this window after it opens is ignored. */
export const GLOBAL_ASK_GRACE_MS = 400;
export const askAnswerAllowed = (openedAt: number, now: number): boolean => now - openedAt >= GLOBAL_ASK_GRACE_MS;

/**
 * Whether the one-time ask is due: only once the player has finished a game, never after an answer, and never in a
 * visit where the sync question was put (one question at a time).
 */
export function shouldAskGlobal(inputs: {
  readonly consent: GlobalConsent;
  readonly finishedGames: number;
  readonly syncAskedThisVisit: boolean;
}): boolean {
  return inputs.consent === "unset" && inputs.finishedGames > 0 && !inputs.syncAskedThisVisit;
}
