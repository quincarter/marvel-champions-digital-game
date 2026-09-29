/**
 * Starts the tutorial game (guided mode G6b, `docs/guided-mode.md` §4): the one call site that loads
 * `TUTORIAL_CONFIG` (`guide/tutorial-config.ts`), answers its mulligan choice as dealt, and marks
 * `appSession().guidedRun` — so `BoardScene` mounts the guide controller (G5c) the moment it opens.
 *
 * Shared by `scenes/guide-chooser.ts` (before How to win existed, this was its own `#startLearnAsYouPlay`) and
 * `scenes/how-to-win.ts`'s "Start the fight". Both go through this one function so the tutorial game is always
 * started the exact same way, whichever screen the player pressed the button on.
 */
import { appSession } from "../session.js";

export async function startTutorialGame(): Promise<void> {
  const { store } = appSession();
  const { TUTORIAL_CONFIG } = await import("./tutorial-config.js");
  await store.start(TUTORIAL_CONFIG);
  if (store.state.game?.pendingChoice) await store.resolveChoice([]);
  appSession().guidedRun = true;
}
