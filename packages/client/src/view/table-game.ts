/**
 * The game the table is showing, for everything that reads a card off it (Inspect, the hover popover, the Team-Up
 * rings, the dealt captions). While the villain phase replays behind the engine, the table draws the game at the rail's
 * beat (`TableHold.game`, issue #386); reading the engine's end state there instead would show a minion's damage
 * cleared or a card in the discard pile before the rail got that far. The Board sets it; null means the live game.
 */
import type { GameState } from "@mc/engine";

let held: GameState | null = null;

/** Set by the Board as the villain phase replay moves (null once it has caught up or closed). */
export function holdTableGame(game: GameState | null): void {
  held = game;
}

/** The game to read the table from: the held one while there is one, else `live`. Null without a live game. */
export function tableGame<T extends GameState>(live: T | null | undefined): T | null {
  if (!live) return null;
  return (held as T | null) ?? live;
}
