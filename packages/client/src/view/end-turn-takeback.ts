/**
 * "Nevermind" after End turn (the owner, 2026-10-24): a fat-fingered End turn, or one pressed before a last look at the
 * hand, can be taken back while nothing has been shown that the player could use to play differently.
 *
 * RRG 1.8 has no take-back (a turn that has ended has ended; "Player Phase", p. 17-18, and "End of Player Phase"
 * steps 1 to 5, p. 18): this is a digital convenience in the same family as Undo (`view/undo.ts`) and rewinds the
 * same way, `SessionStore.rewindTo`, which replays the stored baseline and the commands before End turn. Everything
 * End turn resolved ("at the end of the turn" lasting effects expiring, the end-of-phase discard and refill, the
 * villain phase) therefore never happened, and happens again, in full, if the player ends the turn again.
 *
 * Three windows, one rule each, in the order a player meets them:
 *
 * - **Handover** (another hero's turn follows): the End turn command did nothing but pass the turn on. It is taken
 *   back from the Undo button on the next hero's turn (`handoverTakebackOf`, offered by `BoardController#undoOffer`).
 * - **The end-of-phase discard sheet** (the last hero ended the player phase; RRG 1.8 "End of Player Phase" step 1,
 *   p. 18, "Discard any cards?"): End turn has only asked the question, nothing is drawn or revealed, so the sheet
 *   offers Nevermind (`choiceTakebackOf`, `scenes/choice.ts`).
 * - **Villain phase gate** (the same End turn, after its discards): the engine runs the end of the player phase and the
 *   villain phase inside the command that answers the last discard (or End turn itself, with an empty hand), but the
 *   docked phase holds every beat back until START VILLAIN PHASE (`scenes/villain-phase.ts`, `#gateEligible`). Until
 *   that press the player has been shown only the hand refill, so `gateTakebackOf` offers Nevermind there. Once START
 *   is pressed the phase has been revealed and the window is gone.
 *
 * The refill draw is the one thing a player has seen by the gate (the hand on the board, "you drew 3 cards: ..."): it
 * happens inside the command that begins the villain phase, so a gate that closed before it could not exist. Those
 * draws are the top of the deck, which a replay draws again unchanged (a deck that had to reshuffle spends the RNG
 * and closes the window), so the only thing learned is what the player was about to see anyway.
 * `TAKEBACK_AFTER_OWN_DRAW` closes the gate whenever a card was drawn instead, if the owner would rather have that;
 * the discard sheet is before every draw and is unaffected.
 */
import type { Command, GameEvent, GameState, PendingChoice, PlayerId } from "@mc/engine";
import type { BackOutTrailEntry } from "./back-out.js";
import { eventStopsUndo } from "./undo.js";

/** Whether the gate stays open after the end-of-turn hand refill drew cards (see the file comment). */
export const TAKEBACK_AFTER_OWN_DRAW = true;

const isEndTurn = (command: Command): boolean => command.type === "endTurn";

/** The `stepChanged` that begins the villain phase (the one `BoardScene.#openVillainWalkthrough` launches on). */
const beginsVillainPhase = (event: GameEvent): boolean =>
  event.type === "stepChanged" && event.to.phase === "villain" && event.to.kind === "placeThreat";

/** A hand that changed on the table once the villain phase had begun: the gate cannot hide that. */
const touchesHand = (event: GameEvent): boolean =>
  event.type === "cardDrawn" ||
  event.type === "cardDiscardedFromHand" ||
  (event.type === "cardMoved" && (event.from.kind === "hand" || event.to.kind === "hand"));

/**
 * Whether `event`, in the command that ended a turn or answered its end-of-phase discard, leaves everything a rewind
 * puts back unseen. The end-of-phase discard ("discard any cards", RRG 1.8 p. 18) goes face up onto the player's own
 * discard pile whoever makes it, so it is not a reveal; a draw is one only when `TAKEBACK_AFTER_OWN_DRAW` is off.
 */
function endOfTurnEventOk(event: GameEvent, mover: PlayerId): boolean {
  switch (event.type) {
    case "turnEnded":
    case "stepChanged":
    case "cardDiscardedFromHand":
      return true;
    case "cardDrawn":
      return TAKEBACK_AFTER_OWN_DRAW;
    case "cardMoved":
      if (event.from.kind === "hand" && event.to.kind === "discard") return true;
      if (event.from.kind === "deck" && event.to.kind === "hand") return TAKEBACK_AFTER_OWN_DRAW;
      return !eventStopsUndo(event, mover);
    case "choiceRequested":
      return event.choice.prompt.kind === "discardDownToHandSize" || !eventStopsUndo(event, mover);
    default:
      return !eventStopsUndo(event, mover);
  }
}

/**
 * The End turn that began the trail's tail: the index of the last `endTurn` entry when every entry after it is a
 * `resolveChoice` (the end-of-phase discards), or -1.
 */
function endTurnIndexOf(trail: readonly BackOutTrailEntry[]): number {
  let cursor = trail.length - 1;
  while (cursor >= 0 && trail[cursor]!.command.type === "resolveChoice") cursor -= 1;
  return cursor >= 0 && isEndTurn(trail[cursor]!.command) ? cursor : -1;
}

/**
 * Handover: End turn passed the turn to the next hero and nothing else. Every event is bookkeeping the rewind puts
 * back, so the command count to rewind to is simply the count before it. Null when the last command was anything else.
 */
export function handoverTakebackOf(
  trail: readonly BackOutTrailEntry[],
  game: Pick<GameState, "outcome" | "pendingChoice" | "step">,
): { readonly target: number; readonly command: Command } | null {
  if (game.outcome || game.pendingChoice) return null;
  const { step } = game;
  if (step.phase !== "player" || step.kind !== "turn" || step.ended) return null;
  const last = trail[trail.length - 1];
  if (!last || !isEndTurn(last.command)) return null;
  const started = last.events.some((event) => event.type === "turnStarted" && event.playerId === step.activePlayerId);
  if (!started) return null;
  const quiet = last.events.every((event) => {
    if (event.type === "turnEnded" || event.type === "turnStarted") return true;
    if (event.type === "stepChanged") return event.to.phase === "player" && event.to.kind === "turn";
    return !eventStopsUndo(event, last.playerId);
  });
  if (!quiet) return null;
  return { target: trail.length - 1, command: last.command };
}

/**
 * The end-of-phase discard sheet: the open choice is "discard any cards" (`discardDownToHandSize`) and the End turn
 * that asked it, with any earlier seat's discards, is all that has happened since. Nothing has been drawn or revealed.
 * Returns the command count to rewind to, or null.
 */
export function choiceTakebackOf(trail: readonly BackOutTrailEntry[], choice: PendingChoice): number | null {
  if (choice.prompt.kind !== "discardDownToHandSize") return null;
  const at = endTurnIndexOf(trail);
  if (at < 0) return null;
  for (const entry of trail.slice(at)) {
    if (entry.events.some((event) => beginsVillainPhase(event) || !endOfTurnEventOk(event, entry.playerId)))
      return null;
    if (entry.events.some((event) => event.type === "cardDrawn")) return null;
  }
  return at;
}

/**
 * The villain phase gate: the End turn that began the end of the player phase, and the discards that answered it, are
 * all that has happened, and what they showed the player before the phase began was at most the hand refill. Returns
 * the command count to rewind to, or null. The caller still checks that START has not been pressed.
 */
export function gateTakebackOf(trail: readonly BackOutTrailEntry[]): number | null {
  const at = endTurnIndexOf(trail);
  if (at < 0) return null;
  const tail = trail.slice(at);
  const last = tail[tail.length - 1]!;
  const begins = last.events.findIndex(beginsVillainPhase);
  if (begins < 0) return null;
  // The phase began in the last command only: an earlier one that began it was followed by the villain phase's own.
  for (const entry of tail.slice(0, -1)) {
    if (entry.events.some((event) => beginsVillainPhase(event) || !endOfTurnEventOk(event, entry.playerId)))
      return null;
  }
  // Before the phase began: discards and the hand refill. After: the villain phase, held back by the gate, but not a
  // hand that changed on the table.
  if (!last.events.slice(0, begins).every((event) => endOfTurnEventOk(event, last.playerId))) return null;
  if (last.events.slice(begins).some(touchesHand)) return null;
  return at;
}
