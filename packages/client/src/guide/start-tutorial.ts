/**
 * Starts the tutorial game (guided mode G6b, `docs/guided-mode.md` §4): the one call site that loads
 * `TUTORIAL_CONFIG` (`guide/tutorial-config.ts`), answers its mulligan choice as dealt, and marks
 * `appSession().guidedRun` — so `BoardScene` mounts the guide controller (G5c) the moment it opens.
 *
 * Shared by `scenes/guide-chooser.ts` (before How to win existed, this was its own `#startLearnAsYouPlay`),
 * `scenes/how-to-win.ts`'s "Start the fight", and `scenes/how-to-play.ts`'s hub (guided mode G6c). All three go
 * through this one function so the tutorial game is always started the exact same way, whichever screen the
 * player pressed the button on.
 *
 * **Forces Full guidance for this run only** (`docs/guided-mode.md` §4 G6c: "Modules always run at Full for that
 * run only, the saved level is untouched"): sets `guide/guide-store.ts`'s run-level override before starting, so
 * every guide surface — hints, opportunistic tips, the scripted lessons themselves — reads Full for this game
 * without writing anything to `mc-guide`. Title's "New game"/"Continue" and Game over's "Run it back" clear the
 * override alongside `appSession().guidedRun`, the same reset that already ends a still-running guided session.
 */
import { appSession } from "../session.js";
import { setGuideRunLevelOverride } from "./guide-store.js";

export async function startTutorialGame(): Promise<void> {
  setGuideRunLevelOverride("full");
  const { store } = appSession();
  const { TUTORIAL_CONFIG } = await import("./tutorial-config.js");
  await store.start(TUTORIAL_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]);
  appSession().guidedRun = true;
}
