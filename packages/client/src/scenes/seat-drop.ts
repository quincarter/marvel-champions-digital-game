/**
 * A seated guest's Concede (issue #881, Quin 2026-11-20): it is as if they disconnected. They give up their seat (the
 * host may take it over or hand it to someone else), drop to the watch view of the room's game, and the game goes on.
 * When the host turned hand-offs off the seat stays theirs and the game waits, so they only leave: the Title leaves the
 * room, and joining again restores the seat.
 */
import type Phaser from "phaser";
import { handoverOn } from "../view/room-prompts.js";
import { releaseSeat, roomState, watchRoomGame } from "../platform/room.js";
import { leaveSeatGame } from "../platform/seat-play.js";
import { goToScreen } from "../ui/transitions.js";
import { SCENES } from "./keys.js";
import { watchReplay } from "./replay-entry.js";

/** Leaves the seat and shows the room's game as a watch; the Title if the watch cannot open. */
export async function leaveSeatForWatch(board: Phaser.Scene): Promise<void> {
  const room = roomState();
  if (!handoverOn(room)) {
    // The seat stays theirs and the game waits for them: leaving is going to the Title, which leaves the room.
    goToScreen(board, SCENES.title, {});
    return;
  }
  for (const id of room.mySeats) releaseSeat(id);
  leaveSeatGame();
  const watched = await watchRoomGame();
  if (!watched.ok) {
    goToScreen(board, SCENES.title, {});
    return;
  }
  try {
    await watchReplay(board, watched.host, SCENES.title);
  } catch {
    goToScreen(board, SCENES.title, {});
  }
}
