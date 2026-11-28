/**
 * Continue on a saved guided run (guided mode §3.12): a tutorial or aspect "Try it" save asks first whether to resume
 * guidance or just open the save plainly (`guide/tutorial-resume.ts#tutorialResumeDecisionFor`). An ordinary save skips
 * the question (`decision.kind === "plain"`), exactly as before this decision existed.
 */
import type Phaser from "phaser";
import { guidePrefs } from "../guide/guide-store.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { tutorialResumeDecisionFor } from "../guide/tutorial-resume.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { goToScreen } from "../ui/transitions.js";
import { SCENES } from "./keys.js";
import type { TutorialResumeConfirmData } from "./tutorial-resume-confirm.js";

/**
 * Asks how to open `save`, then starts it. `openPlain` opens it as an ordinary game (the guide off); it is called at once
 * for a save that is not a guided run.
 */
export async function resumeSave(scene: Phaser.Scene, save: SaveMeta, openPlain: () => Promise<void>): Promise<void> {
  const decision = tutorialResumeDecisionFor(save, guidePrefs());
  if (decision.kind === "plain") {
    await openPlain();
    return;
  }
  // `TUTORIAL_LESSONS`' own order numbers "How to win" as lesson 1 (§5.1's table), so a lesson's 1-based number is its
  // index in that list plus one.
  const lessonNumber =
    decision.kind === "tutorial" ? TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === decision.lessonId) + 1 : -1;
  const title =
    decision.kind === "tutorial"
      ? `Resume the tutorial at lesson ${lessonNumber}: ${decision.title}?`
      : decision.kind === "mechanic"
        ? "Restart this Try it?"
        : "Restart this aspect's Try it?";
  const body =
    decision.kind === "tutorial"
      ? "Finished lessons stay done. Or open this save as an ordinary game, with the guide off."
      : "It's a short, one-lesson game — restarting it plays the same opening again. Or open this save as an " +
        "ordinary game, with the guide off.";
  const resumeLabel = decision.kind === "tutorial" ? "Resume tutorial" : "Restart Try it";
  // Launched directly rather than through `askToResumeTutorial`, so the sheet's module stays out of the entry chunk
  // (`scenes/scene-loader.ts` loads it on this launch).
  if (scene.scene.isActive(SCENES.tutorialResumeConfirm)) return;
  scene.scene.launch(SCENES.tutorialResumeConfirm, {
    from: scene.scene.key,
    title,
    body,
    resumeLabel,
    onResume: () => {
      // Imported on the tap, so the lesson configs stay out of the chunk Title loads before its first frame (#226).
      void (
        decision.kind === "tutorial"
          ? import("../guide/start-tutorial.js").then((m) => m.startTutorialGame({ startAtLesson: decision.lessonId }))
          : decision.kind === "mechanic"
            ? import("../guide/start-mechanic-tryit.js").then((m) => m.startMechanicTryItGame(decision.mechanic))
            : import("../guide/start-aspect-tryit.js").then((m) => m.startAspectTryItGame(decision.aspect))
      ).then(() => {
        if (!scene.sys.isActive()) return;
        goToScreen(scene, SCENES.board);
      });
    },
    onContinuePlain: () => void openPlain(),
  } satisfies TutorialResumeConfirmData);
}
