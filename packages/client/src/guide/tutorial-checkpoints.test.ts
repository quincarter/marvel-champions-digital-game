/**
 * Proves `TUTORIAL_CHECKPOINTS` against a real session core (the same layer `tutorial-config.test.ts` and
 * `guide/start-tutorial.ts` use): replay each lesson's checkpoint prefix, apply the same trivial
 * "if a choice is pending, resolve it empty" step `startTutorialGame` applies, then feed the result to the lesson
 * model with the lessons before it marked done (`tutorialLessonsDoneBefore`) and assert that lesson is current —
 * or, for a lesson whose own `when` hasn't fired yet, that it's next up in the waiting state.
 */
import { describe, expect, test } from "vitest";
import { EngineSessionCore } from "../engine/session-core.js";
import { currentLesson, observe, startLessons, type LessonObservation } from "../view/lesson-model.js";
import { TUTORIAL_LESSONS } from "./tutorial-lessons.js";
import { TUTORIAL_CONFIG, TUTORIAL_PLAYER_ID, TUTORIAL_SCRIPT } from "./tutorial-config.js";
import {
  TUTORIAL_CHECKPOINTS,
  tutorialCheckpointFor,
  tutorialLessonsDoneBefore,
  type TutorialLessonId,
} from "./tutorial-checkpoints.js";

describe("TUTORIAL_CHECKPOINTS (docs/guided-mode.md G6c part 2)", () => {
  const lessonIds = Object.keys(TUTORIAL_CHECKPOINTS) as TutorialLessonId[];

  for (const lessonId of lessonIds) {
    test(`lesson "${lessonId}"'s checkpoint lands with it current (or next up)`, async () => {
      const core = new EngineSessionCore();
      const started = await core.start(TUTORIAL_CONFIG);
      let snapshot = started.snapshot;

      const prefix = tutorialCheckpointFor(lessonId);
      for (let i = 0; i < prefix; i++) {
        const command = TUTORIAL_SCRIPT[i];
        if (!command) throw new Error(`TUTORIAL_SCRIPT has no command at index ${i}`);
        const result = core.dispatch(command);
        if (!result.ok) {
          throw new Error(`command ${i} (${command.type}) was refused: ${result.error.code} ${result.error.message}`);
        }
        snapshot = result.snapshot;
      }

      // `startTutorialGame`'s own trailing step: a still-pending trivial choice (e.g. lesson 4's checkpoint
      // leaves the end-of-player-phase discard owed) gets answered empty before handing over.
      if (snapshot.state.pendingChoice) {
        const choice = snapshot.state.pendingChoice;
        const result = core.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [],
        });
        if (!result.ok) {
          throw new Error(`trailing resolveChoice was refused: ${result.error.code} ${result.error.message}`);
        }
        snapshot = result.snapshot;
      }

      const alreadyDone = tutorialLessonsDoneBefore(lessonId);
      const runnerState = startLessons(TUTORIAL_LESSONS, alreadyDone);
      // `snapshot.state` is `StateWithoutPool` (`engine/session-core.ts`'s own `Snapshot`) — every predicate the
      // tutorial lessons use reads fields `StateWithoutPool` still has, the same cast `view/lesson-model.test.ts`
      // and `guide/guide-controller.test.ts` make against a real session core.
      const observation: LessonObservation = {
        game: snapshot.state as unknown as LessonObservation["game"],
        lastEvents: snapshot.events,
        perspectiveId: TUTORIAL_PLAYER_ID,
      };
      const { state } = observe(runnerState, observation);

      const current = currentLesson(state);
      if (current) {
        expect(current.id).toBe(lessonId);
      } else {
        // Waiting: this lesson's own `when` hasn't fired yet, but it's the next not-done lesson in line.
        const nextNotDone = state.lessons.find((lesson) => !state.doneLessonIds.includes(lesson.id));
        expect(nextNotDone?.id).toBe(lessonId);
      }
    });
  }
});
