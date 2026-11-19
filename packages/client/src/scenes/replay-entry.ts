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
import { activeReplay, enterReplay, leaveReplay } from "../replay/replay-mode.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { goToScreen } from "../ui/transitions.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";
import type { ReplayVersusData } from "./replay-versus.js";

/** The screen Exit goes back to. */
let returnTarget: string = SCENES.title;

/**
 * Opens `host` on the board, from `from`. Exit returns to `returnTo` (a scene key). The host is closed if it can't be
 * entered. `hold` keeps `from` up until it settles too, and `reveal` takes the place of the fade to the board (the
 * versus screen starts the board under itself and splits apart over it, #858).
 */
export async function watchReplay(
  from: Phaser.Scene,
  host: ReplayHost,
  returnTo: string,
  hold?: Promise<unknown>,
  reveal?: () => void,
): Promise<void> {
  try {
    await enterReplay(host);
  } catch (cause) {
    host.dispose();
    throw cause;
  }
  await hold;
  // `from` was taken down while the replay was going on (nothing does that today): don't leave the replay up unseen.
  if (!from.sys.isActive()) {
    leaveReplay();
    return;
  }
  returnTarget = returnTo;
  if (reveal) reveal();
  else goToScreen(from, SCENES.board, {});
}

/**
 * Opens `host` the way every replay starts (#858): the versus screen of villain against heroes, which then puts it on
 * the board (`watchReplay`). Exit returns to `returnTo`. The versus screen's code is loaded first; if it can't be, the
 * host is closed and the error passed on for the caller to report.
 */
export async function introReplay(from: Phaser.Scene, host: ReplayHost, returnTo: string): Promise<void> {
  try {
    await sceneLoader()?.load(SCENES.replayVersus);
  } catch (cause) {
    host.dispose();
    throw cause;
  }
  if (!from.sys.isActive()) return host.dispose();
  goToScreen(from, SCENES.replayVersus, { host, returnTo } satisfies ReplayVersusData);
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
