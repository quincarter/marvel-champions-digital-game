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
 *
 * **Starting partway through (G6c part 2, `docs/guided-mode.md` §4 G6c).** `options.startAtLesson` replays
 * `TUTORIAL_SCRIPT`'s prefix `guide/tutorial-checkpoints.ts#tutorialCheckpointFor` names for that lesson, through
 * the normal `store.dispatch` path — the same commands a player would issue, so this stays replay-safe the same
 * way a save's own log-replay is. The trailing "if a choice is still pending, resolve it empty" step then does
 * double duty: with no `startAtLesson` it answers the mulligan (`TUTORIAL_SCRIPT[0]`), and with one it answers
 * whatever trivial choice a checkpoint's own prefix leaves owed (lesson 4's: the end-of-player-phase discard,
 * which is what actually flips the game into the villain phase — see `tutorial-checkpoints.ts`'s own header).
 * The lessons before `startAtLesson` are recorded on `appSession().guidedRunAlreadyDone`, for this run only —
 * nothing here writes the saved tutorial progress (`guide/guide-prefs.ts`). **Needs a one-line consumer change in
 * `scenes/board.ts`**: `#syncGuide`'s `BoardGuideMount` construction hardcodes `alreadyDone: ["how-to-win"]`; it
 * should read `alreadyDone: appSession().guidedRunAlreadyDone ?? ["how-to-win"]` instead, so a mid-tutorial start
 * opens the guide on the right lesson rather than lesson 2.
 */
import { appSession } from "../session.js";
import { setGuideRunLevelOverride } from "./guide-store.js";
import { tutorialCheckpointFor, tutorialLessonsDoneBefore, type TutorialLessonId } from "./tutorial-checkpoints.js";

export interface StartTutorialGameOptions {
  /** Replays straight to this lesson's checkpoint instead of the top of the script (`docs/guided-mode.md` §4
   * G6c). Omit to start from the very top, as every caller before G6c part 2 did. */
  readonly startAtLesson?: TutorialLessonId;
}

export async function startTutorialGame(options: StartTutorialGameOptions = {}): Promise<void> {
  setGuideRunLevelOverride("full");
  const { store } = appSession();
  const { TUTORIAL_CONFIG, TUTORIAL_SCRIPT } = await import("./tutorial-config.js");
  // Stamped onto the config itself, not read off `appSession().guidedRun` (which isn't set until after this
  // whole replay finishes, below): `SaveMeta.guided` (guided mode §3.12) needs to be fixed at `create` time, and
  // this call site unambiguously knows it's starting the tutorial. `SessionConfig.guided`'s own doc comment.
  await store.start({ ...TUTORIAL_CONFIG, guided: { kind: "tutorial" } });

  const prefix = options.startAtLesson ? tutorialCheckpointFor(options.startAtLesson) : 0;
  for (let i = 0; i < prefix; i++) {
    const command = TUTORIAL_SCRIPT[i];
    if (!command) break;
    const ok = await store.dispatch(command);
    // `tutorial-checkpoints.test.ts` proves every prefix replays clean against a real session core; a refusal
    // here would mean that proof and this script have drifted apart. Stop rather than dispatch further commands
    // against a state they no longer assume, and let the trailing pending-choice check below hand back whatever
    // the engine actually reached.
    if (!ok) break;
  }
  if (store.state.game?.pendingChoice) await store.resolveChoice([]);

  appSession().guidedRun = true;
  appSession().guidedRunKind = { kind: "tutorial" };
  appSession().guidedRunAlreadyDone = options.startAtLesson
    ? tutorialLessonsDoneBefore(options.startAtLesson)
    : undefined;
}
