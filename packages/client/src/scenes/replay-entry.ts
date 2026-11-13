/**
 * Starting and leaving a replay on the board (issue #693): the one entry point Game over, Title and the games list call
 * once they hold an opened `ReplayHost` (`replay/replay-files.ts#openReplay`).
 *
 * `watchReplay` puts the host on the app session (`replay/replay-mode.ts#enterReplay`) and starts the Board, which sees
 * `activeReplay()` at `create()`, goes read-only and launches the transport over itself. `exitReplay` is what the
 * transport's Exit (and Escape / B) calls: it takes the Board back down, and the Board's own shutdown puts the game's
 * host and store back (`leaveReplay`) before the screen the replay was opened from comes up.
 */
import type Phaser from "phaser";
import { activeReplay, enterReplay } from "../replay/replay-mode.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { goToScreen } from "../ui/transitions.js";
import { SCENES } from "./keys.js";

/** The screen Exit goes back to. */
let returnTarget: string = SCENES.title;

/** Opens `host` on the board, from `from`. Exit returns to `returnTo` (a scene key). The host is closed if it can't be entered. */
export async function watchReplay(from: Phaser.Scene, host: ReplayHost, returnTo: string): Promise<void> {
  try {
    await enterReplay(host);
  } catch (cause) {
    host.dispose();
    throw cause;
  }
  returnTarget = returnTo;
  goToScreen(from, SCENES.board, {});
}

/** Leaves the replay being watched for the screen it was opened from. A no-op when none is up. */
export function exitReplay(from: Phaser.Scene): void {
  if (!activeReplay()) return;
  const board = from.scene.get(SCENES.board);
  from.scene.stop(SCENES.replayTransport);
  // The Board's shutdown restores the live host and store and closes the replay; `goToScreen` starts from the Board
  // so that shutdown is the one that runs.
  goToScreen(board, returnTarget, {});
}

/** Where Exit goes, for the board's own cleanup when it is stopped some other way. */
export function replayReturnTarget(): string {
  return returnTarget;
}
