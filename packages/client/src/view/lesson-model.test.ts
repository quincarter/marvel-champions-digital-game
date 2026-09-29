/**
 * Drives `view/lesson-model.ts` two ways: unit tests over hand-built `Lesson`/`LessonObservation` fixtures for the
 * machine's own contract (acknowledge/back/skip/replay, `when`-gated lessons, `fillCopy`), and the real tutorial
 * lessons (`guide/tutorial-lessons.ts`) through `TUTORIAL_SCRIPT` and `EngineSessionCore` — the same layer
 * `guide/tutorial-config.test.ts` drives — so a break in either the lessons' own predicates or the stacked setup
 * they depend on shows up here too.
 */
import { describe, expect, test } from "vitest";
import { EngineSessionCore } from "../engine/session-core.js";
import { TUTORIAL_CONFIG, TUTORIAL_PLAYER_ID, TUTORIAL_SCRIPT } from "../guide/tutorial-config.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import {
  acknowledge,
  back,
  currentLesson,
  currentStep,
  defenderDeclared,
  fillCopy,
  lessonList,
  observe,
  progressOf,
  replay,
  skipLesson,
  skipStep,
  startLessons,
  type Lesson,
  type LessonObservation,
  type LessonRunnerState,
} from "./lesson-model.js";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { playerId } from "@mc/engine";
import type { StateWithoutPool } from "../engine/host.js";

// ---------------------------------------------------------------------------
// Fixture lessons (no board/engine dependency) for the machine's own contract.
// ---------------------------------------------------------------------------

const P1: PlayerId = playerId("p1");

/** A minimal `GameState`-shaped fixture, just enough for the predicates this file's fixture lessons use. */
function fakeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    step: { phase: "player", kind: "turn", activePlayerId: P1, remainingPlayerIds: [] },
    players: [{ playerId: P1, identity: { form: "alterEgo" } } as unknown as GameState["players"][number]],
    instances: {},
    mainScheme: { instanceId: "scheme-1" } as unknown as GameState["mainScheme"],
    ...overrides,
  } as unknown as GameState;
}

function observationOf(game: GameState, lastEvents: readonly GameEvent[] = []): LessonObservation {
  return { game, lastEvents, perspectiveId: P1 };
}

const FIXTURE_LESSON_A: Lesson = {
  id: "a",
  title: "Lesson A",
  steps: [
    { id: "a1", copy: { title: "A1", body: "first" }, mode: "acknowledge" },
    {
      id: "a2",
      copy: { title: "A2", body: "second" },
      mode: "await",
      completes: (o) => o.game.players[0]?.identity.form === "hero",
    },
  ],
};

const FIXTURE_LESSON_B: Lesson = {
  id: "b",
  title: "Lesson B",
  when: (o) => o.game.round >= 2,
  steps: [{ id: "b1", copy: { title: "B1", body: "only step" }, mode: "acknowledge" }],
};

const FIXTURES: readonly Lesson[] = [FIXTURE_LESSON_A, FIXTURE_LESSON_B];

describe("lesson-model: the machine's own contract", () => {
  test("startLessons leaves nothing current until observe finds an eligible lesson", () => {
    const state = startLessons(FIXTURES);
    expect(currentStep(state)).toBeNull();
    expect(currentLesson(state)).toBeNull();

    const { state: observed } = observe(state, observationOf(fakeGame()));
    expect(currentLesson(observed)?.id).toBe("a");
    expect(currentStep(observed)?.id).toBe("a1");
  });

  test("acknowledge advances an acknowledge-mode step and is a no-op on an await-mode step", () => {
    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;

    const afterAck = acknowledge(state);
    expect(afterAck.lessonDone).toEqual([]);
    expect(currentStep(afterAck.state)?.id).toBe("a2");

    // a2 is await-mode: acknowledge does nothing to it.
    const noOp = acknowledge(afterAck.state);
    expect(noOp.lessonDone).toEqual([]);
    expect(currentStep(noOp.state)?.id).toBe("a2");
  });

  test("observe auto-advances an await step once its predicate holds, finishing the lesson", () => {
    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;
    state = acknowledge(state).state; // -> a2 (await)

    const stillAlterEgo = observe(state, observationOf(fakeGame()));
    expect(stillAlterEgo.lessonDone).toEqual([]);
    expect(currentStep(stillAlterEgo.state)?.id).toBe("a2");

    const heroGame = fakeGame({
      players: [{ playerId: P1, identity: { form: "hero" } } as unknown as GameState["players"][number]],
    });
    const flipped = observe(stillAlterEgo.state, observationOf(heroGame));
    expect(flipped.lessonDone).toEqual(["a"]);
    // Lesson B's `when` (round >= 2) doesn't hold on this round-1 fixture, so nothing else becomes current.
    expect(currentLesson(flipped.state)).toBeNull();
    expect(lessonList(flipped.state).map((e) => e.status)).toEqual(["done", "upcoming"]);
  });

  test("a lesson's `when` gates it from becoming current until it holds", () => {
    let state = startLessons(FIXTURES, ["a"]); // lesson A already done
    expect(currentLesson(state)).toBeNull();

    const roundOne = observe(state, observationOf(fakeGame({ round: 1 })));
    expect(currentLesson(roundOne.state)).toBeNull();
    expect(lessonList(roundOne.state).map((e) => e.status)).toEqual(["done", "upcoming"]);

    const roundTwo = observe(state, observationOf(fakeGame({ round: 2 })));
    expect(currentLesson(roundTwo.state)?.id).toBe("b");
    expect(lessonList(roundTwo.state).map((e) => e.status)).toEqual(["done", "current"]);
  });

  test("lessonEvents lets a later step's event-based predicate catch an event that fired while an earlier step of the same lesson was still current (G11 fix)", () => {
    const defendEvent = { type: "defenderDeclared" } as unknown as GameEvent;
    const villainLike: Lesson = {
      id: "villain-like",
      title: "Villain-like",
      steps: [
        // No `completes`: this step only ever advances via `acknowledge` — the pre-fix shape of the real
        // `villain-phase-order` step, kept here deliberately so this test proves `lessonEvents` itself, not the
        // separate `villainActivationPast` auto-advance fix.
        { id: "step1", copy: { title: "S1", body: "x" }, mode: "acknowledge" },
        { id: "step2", copy: { title: "S2", body: "y" }, mode: "await", completes: defenderDeclared() },
      ],
    };

    let state = startLessons([villainLike]);
    state = observe(state, observationOf(fakeGame())).state;
    expect(currentStep(state)?.id).toBe("step1");

    // The defend event fires while step1 is still current (the player hasn't pressed "Got it") — `observe` records
    // it into `lessonEvents` even though step1 has no predicate of its own to react to it.
    state = observe(state, observationOf(fakeGame(), [defendEvent])).state;
    expect(currentStep(state)?.id).toBe("step1");
    expect(state.lessonEvents).toEqual([defendEvent]);

    // The player acknowledges step1 late. Step2 becomes current and completes immediately on the very next
    // `observe`, with no fresh events this call — only because `lessonEvents` carried the earlier event forward.
    state = acknowledge(state).state;
    expect(currentStep(state)?.id).toBe("step2");
    const observed = observe(state, observationOf(fakeGame(), []));
    expect(observed.lessonDone).toEqual(["villain-like"]);
  });

  test("back steps back within the current lesson and no-ops at the first step", () => {
    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;
    state = acknowledge(state).state; // -> a2

    const stepped = back(state);
    expect(currentStep(stepped.state)?.id).toBe("a1");

    const noOp = back(stepped.state);
    expect(currentStep(noOp.state)?.id).toBe("a1");
  });

  test("skipStep advances past only the current step, unlike acknowledge it also works on an await step", () => {
    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;
    expect(currentStep(state)?.id).toBe("a1");

    const afterSkip = skipStep(state);
    expect(afterSkip.lessonDone).toEqual([]);
    expect(currentStep(afterSkip.state)?.id).toBe("a2"); // a1 was acknowledge-mode; skip moves past it too

    // a2 is await-mode — skipStep still moves past it (unlike `acknowledge`, which no-ops there), finishing
    // lesson A. Lesson B's own `when` (round >= 2) doesn't hold on this round-1 fixture, so nothing else
    // becomes current yet, but the run itself keeps going (`skipped` stays false).
    const afterSecondSkip = skipStep(afterSkip.state);
    expect(afterSecondSkip.lessonDone).toEqual(["a"]);
    expect(afterSecondSkip.state.skipped).toBe(false);
    expect(currentLesson(afterSecondSkip.state)).toBeNull();

    // Lesson B's `when` still applies after the skip — round 2 picks it up via the next `observe`, same as if
    // lesson A had finished normally.
    const roundTwo = observe(afterSecondSkip.state, observationOf(fakeGame({ round: 2 })));
    expect(currentLesson(roundTwo.state)?.id).toBe("b");
  });

  test("skipStep is a no-op once the run is skipped, or with no lesson current", () => {
    const idle = startLessons(FIXTURES);
    expect(skipStep(idle)).toEqual({ state: idle, lessonDone: [] });

    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;
    const skipped = skipLesson(state).state;
    expect(skipStep(skipped)).toEqual({ state: skipped, lessonDone: [] });
  });

  test("skipLesson ends the run: no lesson ever becomes current again, even across observe", () => {
    let state = startLessons(FIXTURES);
    state = observe(state, observationOf(fakeGame())).state;
    const skipped = skipLesson(state);
    expect(skipped.lessonDone).toEqual([]);
    expect(currentLesson(skipped.state)).toBeNull();

    const stillNothing = observe(
      skipped.state,
      observationOf(
        fakeGame({
          players: [{ playerId: P1, identity: { form: "hero" } } as unknown as GameState["players"][number]],
        }),
      ),
    );
    expect(currentLesson(stillNothing.state)).toBeNull();
    expect(stillNothing.lessonDone).toEqual([]);
  });

  test("replay re-enters a done lesson at its first step without touching doneLessonIds, and un-skips", () => {
    let state = startLessons(FIXTURES, ["a", "b"]);
    state = skipLesson(state).state;
    expect(state.skipped).toBe(true);

    const replayed = replay(state, "a");
    expect(replayed.state.skipped).toBe(false);
    expect(currentLesson(replayed.state)?.id).toBe("a");
    expect(currentStep(replayed.state)?.id).toBe("a1");
    expect(replayed.state.doneLessonIds).toEqual(["a", "b"]);
    expect(lessonList(replayed.state).map((e) => e.status)).toEqual(["current", "done"]);
  });

  test("replay of an unknown lesson id is a no-op", () => {
    const state = startLessons(FIXTURES);
    const replayed = replay(state, "nope");
    expect(replayed.state).toBe(state);
  });

  test("progressOf reports the current lesson's step position and overall completion", () => {
    let state: LessonRunnerState = startLessons(FIXTURES, ["a"]);
    expect(progressOf(state)).toBeNull();

    state = observe(state, observationOf(fakeGame({ round: 2 }))).state;
    expect(progressOf(state)).toEqual({ lessonId: "b", stepIndex: 0, totalSteps: 1, doneCount: 1, totalCount: 2 });
  });

  test("fillCopy substitutes {threat} from the live main scheme and extra values, leaving unknown placeholders alone", () => {
    const game = fakeGame({ instances: { "scheme-1": { threat: 4 } as unknown as GameState["instances"][string] } });
    const filled = fillCopy(
      { title: "{threat} threat", body: "Target is {target}, {threat} so far. {mystery} stays put." },
      observationOf(game),
      { target: 20 },
    );
    expect(filled.title).toBe("4 threat");
    expect(filled.body).toBe("Target is 20, 4 so far. {mystery} stays put.");
  });
});

// ---------------------------------------------------------------------------
// The real tutorial lessons, driven through the real session core.
// ---------------------------------------------------------------------------

/**
 * `Snapshot.state` (`engine/session-core.ts`) is `StateWithoutPool` — the cross-thread-safe engine state with
 * `cardPool` stripped. Every predicate this file exercises reads fields `StateWithoutPool` still has, so the cast
 * back to the engine's own `GameState` (what `LessonObservation.game` is typed as, matching `SessionState.game`)
 * is safe here.
 */
function observationFrom(
  game: StateWithoutPool,
  lastEvents: readonly GameEvent[],
  perspectiveId: PlayerId = TUTORIAL_PLAYER_ID,
): LessonObservation {
  return { game: game as unknown as GameState, lastEvents, perspectiveId };
}

describe("guide/tutorial-lessons.ts driven by TUTORIAL_SCRIPT", () => {
  test("flip lands lesson 2 done and starts lesson 3's play-Black-Cat step", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);

    let state = startLessons(TUTORIAL_LESSONS);
    state = observe(state, observationFrom(started.snapshot.state, started.snapshot.events)).state;
    expect(currentLesson(state)?.id).toBe("how-to-win");

    // G6b acknowledges lesson 1 on its own screen, before the board ever shows the guide. Finishing a lesson via
    // `acknowledge` doesn't itself search for the next one — that only happens on the next `observe`, the way a
    // real controller re-observes right after every command (including a guide button press) anyway.
    state = acknowledge(state).state;
    state = observe(state, observationFrom(started.snapshot.state, started.snapshot.events)).state;
    expect(currentLesson(state)?.id).toBe("hero-and-alter-ego");
    expect(currentStep(state)?.id).toBe("flip");

    const afterMulligan = core.dispatch(TUTORIAL_SCRIPT[0]!);
    if (!afterMulligan.ok) throw new Error("mulligan refused");
    state = observe(state, observationFrom(afterMulligan.snapshot.state, afterMulligan.snapshot.events)).state;
    expect(currentStep(state)?.id).toBe("flip"); // still waiting on the flip

    const afterFlip = core.dispatch(TUTORIAL_SCRIPT[1]!);
    if (!afterFlip.ok) throw new Error("flip refused");
    const observedFlip = observe(state, observationFrom(afterFlip.snapshot.state, afterFlip.snapshot.events));
    expect(observedFlip.lessonDone).toEqual(["hero-and-alter-ego"]);
    state = observedFlip.state;
    expect(currentLesson(state)?.id).toBe("paying-for-cards");
    expect(currentStep(state)?.id).toBe("play-black-cat");
  });

  test("the full script lands villain-phase's defend step, then round 2's thwart step, in order", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);

    let state = startLessons(TUTORIAL_LESSONS);
    state = observe(state, observationFrom(started.snapshot.state, started.snapshot.events)).state;
    state = acknowledge(state).state; // lesson 1 acknowledged off-board

    let snapshot = started.snapshot;
    for (let i = 0; i < TUTORIAL_SCRIPT.length; i++) {
      const dispatched = core.dispatch(TUTORIAL_SCRIPT[i]!);
      if (!dispatched.ok) throw new Error(`command ${i} refused: ${dispatched.error.code}`);
      snapshot = dispatched.snapshot;
      const observed = observe(state, observationFrom(snapshot.state, snapshot.events));
      state = observed.state;

      if (i === 1) {
        // Just flipped: lesson 2 finished, lesson 3 (play Black Cat) is current.
        expect(observed.lessonDone).toEqual(["hero-and-alter-ego"]);
        expect(currentStep(state)?.id).toBe("play-black-cat");
      }
      if (i === 2) {
        // Just played Black Cat: lesson 3 finished. Lesson 4 waits for the villain phase (`when: stepIs("villain")`),
        // which hasn't started yet, so nothing is current.
        expect(observed.lessonDone).toEqual(["paying-for-cards"]);
        expect(currentLesson(state)).toBeNull();
      }
      if (i === 5) {
        // Declined Spider-Sense: the villain phase has started, and Rhino's attack immediately opens the defend
        // choice. `villain-phase-order` never gets (or needs) an `acknowledge()` call in this whole test — it
        // auto-advances the moment the defend choice is pending (G11 fix: `villainActivationPast`), which is what
        // stops a player who never presses "Got it" from stranding the guide on it for the whole round.
        expect(currentLesson(state)?.id).toBe("villain-phase");
        expect(currentStep(state)?.id).toBe("declare-defender");

        // A stray late "Got it" press (the player double-tapping where the button used to be, or a UI that hasn't
        // redrawn yet) is a no-op on an `"await"` step — it must not also skip `declare-defender` itself.
        state = acknowledge(state).state;
        expect(currentStep(state)?.id).toBe("declare-defender");
      }
    }

    // i === 6 declared Black Cat as defender: lesson 4 finishes, and round 2's lesson 5 becomes current once its
    // own step is re-observed against the post-defend state (already folded into the loop above via `observe`).
    expect(currentLesson(state)?.id).toBe("threat-and-thwarting");
    expect(currentStep(state)?.id).toBe("spotlight-scheme");
    expect(snapshot.state.round).toBe(2);
    expect(state.doneLessonIds).toContain("villain-phase");

    // The round-1 debrief (G8) reads exactly this list — lessons 1-4 done, lesson 5 current, never stuck on
    // `villain-phase-order` or `declare-defender` even though `villain-phase-order` was never acknowledged.
    expect(lessonList(state).map((entry) => [entry.lesson.id, entry.status])).toEqual([
      ["how-to-win", "done"],
      ["hero-and-alter-ego", "done"],
      ["paying-for-cards", "done"],
      ["villain-phase", "done"],
      ["threat-and-thwarting", "current"],
    ]);

    state = acknowledge(state).state;
    expect(currentStep(state)?.id).toBe("thwart");

    const legal = snapshot.legal;
    if (legal?.actions.kind !== "turn") throw new Error("expected round 2's turn actions");
    const thwart = legal.actions.legal.find((entry) => entry.action.kind === "basicThwart");
    if (!thwart) throw new Error("expected a legal thwart");
    const afterThwart = core.dispatch(thwart.example);
    if (!afterThwart.ok) throw new Error("thwart refused");
    const observedThwart = observe(state, observationFrom(afterThwart.snapshot.state, afterThwart.snapshot.events));
    expect(observedThwart.lessonDone).toEqual(["threat-and-thwarting"]);
  });
});
