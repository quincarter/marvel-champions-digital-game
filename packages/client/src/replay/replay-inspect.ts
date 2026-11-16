/**
 * Looking around a paused replay (#735). The replay transport (`scenes/replay-transport.ts`) owns the keyboard and the
 * pad while a replay plays; "Inspect table" (the d-pad's down, or the down arrow) pauses it, hides the bar and hands the
 * keyboard and the pad to the Board, which then moves focus, inspects, zooms and opens piles and the log as in a game.
 * Nothing pressed reaches the game: the Board is read-only on a replay (`BoardController.setReadOnly`) and the replay's
 * host refuses every command, and on top of that the presses that act (Undo, End turn, the action and ability layers,
 * the board's action keys) are dropped here. Back out (B, Start, Escape) brings the bar back.
 *
 * Plain module state, like `replay-mode.ts`: the transport sets it, the Board reads it.
 */
import type { GamepadIntent } from "../view/gamepad.js";
import type { BoardKeyAction } from "../view/keyboard-intent.js";

let inspecting = false;
/** The game frame the mode last changed in: the press that changed it is not also a press of the other side's. */
let changedFrame = Number.NEGATIVE_INFINITY;
const listeners = new Set<(on: boolean) => void>();

/** True while a replay is paused and the table, not the transport, takes the keyboard and the pad. */
export function replayInspecting(): boolean {
  return inspecting;
}

/** Whether the mode changed in `frame`: that frame's press was the one that changed it, for one side only. */
export function replayInspectChangedIn(frame: number): boolean {
  return frame === changedFrame;
}

/** Turns looking around on or off, in game frame `frame`. */
export function setReplayInspecting(on: boolean, frame: number): void {
  if (inspecting === on) return;
  inspecting = on;
  changedFrame = frame;
  for (const listener of [...listeners]) listener(on);
}

/** Back to watching, with no one told: a replay opening or closing starts from the bar. */
export function resetReplayInspect(): void {
  inspecting = false;
  changedFrame = Number.NEGATIVE_INFINITY;
}

/** Called on every change; returns the unsubscribe. */
export function onReplayInspectChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What the Board does with an intent while a replay is being looked around. */
export type ReplayInspectRoute = "pass" | "leave" | "drop";

/**
 * Back (B, Escape) and Start leave for the bar; Undo and End turn are dropped (the table is watched, not played);
 * everything that only moves focus or reads (the d-pad, A on a card, Y, LB / RB, View, R3, L3) passes to the Board.
 */
export function replayInspectRoute(intent: GamepadIntent): ReplayInspectRoute {
  switch (intent) {
    case "cancel":
    case "pause":
      return "leave";
    case "undo":
    case "endTurn":
      return "drop";
    default:
      return "pass";
  }
}

/** The Board's own keys that only read the table (zones, the log and recap, the piles, Team-Up and Evidence). */
export const REPLAY_READING_KEYS: ReadonlySet<BoardKeyAction["kind"]> = new Set([
  "zone",
  "log",
  "recap",
  "teamUp",
  "evidence",
  "discard",
  "deckLeft",
]);
