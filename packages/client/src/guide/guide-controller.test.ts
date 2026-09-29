/**
 * Drives `GuideController` through `TUTORIAL_CONFIG`/`TUTORIAL_SCRIPT` (`guide/tutorial-config.ts`) via the real
 * session core — the same layer `guide/tutorial-config.test.ts` and `view/lesson-model.test.ts` already drive —
 * asserting the panel content and gate at each lesson point, plus Back, Skip, Stop and Escape (§3.10). Mirrors
 * `guide-store.test.ts`'s own `localStorage` fake so `markLessonDone`/`markTutorialSkipped` land somewhere real
 * rather than throwing in a Vitest DOM-less environment.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { instanceId, playerId } from "@mc/engine";
import { EngineSessionCore, type Snapshot } from "../engine/session-core.js";
import { TUTORIAL_CONFIG, TUTORIAL_PLAYER_ID, TUTORIAL_SCRIPT } from "./tutorial-config.js";
import { TUTORIAL_LESSONS } from "./tutorial-lessons.js";
import { guidePrefs, resetGuidePrefsCacheForTests } from "./guide-store.js";
import { GuideController } from "./guide-controller.js";
import type { LessonObservation } from "../view/lesson-model.js";

const BLACK_CAT_ID = instanceId("i4");
const OTHER_PLAYER = playerId("p2");

/** A minimal `Storage` stand-in, matching `guide-store.test.ts`'s own fake. */
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

beforeEach(() => {
  resetGuidePrefsCacheForTests();
  vi.stubGlobal("localStorage", fakeStorage());
});

/** Drives one `TUTORIAL_SCRIPT` command through a real core, throwing on a refusal — same shape as
 * `tutorial-config.test.ts`'s own `dispatch`. */
function dispatch(core: EngineSessionCore, index: number): Snapshot {
  const command = TUTORIAL_SCRIPT[index];
  if (!command) throw new Error(`TUTORIAL_SCRIPT has no command at index ${index}`);
  const result = core.dispatch(command);
  if (!result.ok) {
    throw new Error(`command ${index} (${command.type}) was refused: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/**
 * `Snapshot.state` (`engine/session-core.ts`) is `StateWithoutPool` — the cross-thread-safe engine state with
 * `cardPool` stripped. Every predicate `TUTORIAL_LESSONS` uses reads fields `StateWithoutPool` still has, so this
 * cast is the same one `view/lesson-model.test.ts`'s own real-session fixture makes.
 */
function observationOf(snapshot: Snapshot, perspectiveId = TUTORIAL_PLAYER_ID): LessonObservation {
  return { game: snapshot.state as unknown as LessonObservation["game"], lastEvents: snapshot.events, perspectiveId };
}

/** A fresh controller against `TUTORIAL_LESSONS`, lesson 1 already done (mirrors `scenes/board/guide-mount.ts`'s
 * own `BoardGuideMount` construction). */
function newController(observation: LessonObservation): GuideController {
  return new GuideController({ lessons: TUTORIAL_LESSONS, alreadyDone: ["how-to-win"] }, observation);
}

/**
 * Dispatches `TUTORIAL_SCRIPT[index]` *and* feeds the controller the result — this module's own header (and
 * `guide/guide-controller.ts`'s own contract) requires an `onObservation` call on *every* store update, not just
 * the ones a test happens to care about: `cardPlayed`/`defenderDeclared` etc. only ever look at the most recent
 * command's own events (`view/lesson-model.ts`'s own doc comment on why), so skipping a call here would silently
 * make this test suite more forgiving than the real board ever is.
 */
function run(core: EngineSessionCore, controller: GuideController, index: number): Snapshot {
  const snapshot = dispatch(core, index);
  controller.onObservation(observationOf(snapshot));
  return snapshot;
}

describe("GuideController — the tutorial script", () => {
  test("starts on lesson 2's flip step, gated to the Flip button", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));

    const view = controller.view();
    expect(view.active).toBe(true);
    expect(view.step?.id).toBe("flip");
    expect(view.anchor).toEqual({ kind: "action", id: "flip" });
    expect(view.tagVariant).toBe("tryThis");
    expect(view.panel?.title).toBe("You're Peter Parker");
    // Lesson 1 ("How to win") is already done — this run starts on lesson 2 of 5.
    expect(view.panel?.contextLabel).toBe("Lesson 2 of 5");
    expect(view.panel?.lessons?.[0]).toMatchObject({ id: "how-to-win", status: "done" });
    expect(view.panel?.lessons?.[1]).toMatchObject({ id: "hero-and-alter-ego", status: "current" });
    expect(view.panel?.continueHint).toBeTruthy();
    expect(view.panel?.primaryLabel).toBeNull();
    expect(view.gate?.actions.has("changeForm")).toBe(true);
    expect(view.gate?.cards.size).toBe(0);
  });

  test("the mulligan alone does not advance past the flip step", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));

    run(core, controller, 0);
    expect(controller.view().step?.id).toBe("flip");
  });

  test("flipping to hero form completes lesson 2, marks it done, and opens lesson 3 on Black Cat", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    run(core, controller, 0);
    run(core, controller, 1);

    const view = controller.view();
    expect(view.step?.id).toBe("play-black-cat");
    expect(view.anchor).toEqual({ kind: "card", code: "01002" });
    expect(view.tagVariant).toBe("tryThis");
    expect(view.gate?.cards.has(BLACK_CAT_ID)).toBe(true);
    // The gate covers the whole hand, not just Black Cat — paying her cost means tapping Energy too
    // (`guide/guide-controller.ts#gateFor`'s own doc comment: a card-only gate would block that as inert).
    expect(view.gate?.cards.has(instanceId("i38"))).toBe(true);
    expect(view.gate?.actions.size).toBe(0);
    expect(view.panel?.tip).toContain("Energy");

    // Lesson 2 is done in the live prefs (this module's own `markLessonDone` contract).
    expect(guidePrefs().tutorial.lessonsDone).toContain("hero-and-alter-ego");
  });

  test("playing Black Cat completes lesson 3; no lesson is current again until the villain phase", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    run(core, controller, 0);
    run(core, controller, 1);
    run(core, controller, 2);

    expect(guidePrefs().tutorial.lessonsDone).toContain("paying-for-cards");
    // Round 1's own player turn still has nothing else scripted to teach (lesson 4 waits for the villain phase).
    expect(controller.view().active).toBe(false);
  });

  test("lesson 4 opens once the villain phase starts, then GUIDE PICKs Black Cat on the defend step", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    run(core, controller, 0);
    run(core, controller, 1);
    run(core, controller, 2);
    run(core, controller, 3); // end the turn
    run(core, controller, 4); // end-of-phase discard (nothing to discard) — this is what actually opens the villain phase

    const orderStep = controller.view();
    expect(orderStep.step?.id).toBe("villain-phase-order");
    expect(orderStep.anchor).toEqual({ kind: "zone", id: "villain" });
    // A bare zone anchor gets no tag and no gate (§4 G4c "For G5c": TRY THIS only on action/card anchors).
    expect(orderStep.tagVariant).toBeNull();
    expect(orderStep.gate).toBeNull();
    expect(orderStep.panel?.primaryLabel).toBe("Got it");

    controller.primary();
    run(core, controller, 5); // decline the Spider-Sense interrupt

    const defendStep = controller.view();
    expect(defendStep.step?.id).toBe("declare-defender");
    expect(defendStep.anchor).toEqual({ kind: "choice", id: "defend" });
    expect(defendStep.tagVariant).toBe("guidePick");
    // The defend sheet already owns input exclusively while it's open, so the board gate stays empty.
    expect(defendStep.gate).toBeNull();
  });

  test("declaring Black Cat completes lesson 4 and opens lesson 5 on round 2", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    for (let i = 0; i < 5; i++) run(core, controller, i);
    controller.primary(); // acknowledge "villain-phase-order" (this module's own step 0 of lesson 4)
    run(core, controller, 5);
    run(core, controller, 6); // declare Black Cat as defender

    expect(guidePrefs().tutorial.lessonsDone).toContain("villain-phase");
    const view = controller.view();
    expect(view.step?.id).toBe("spotlight-scheme");
    expect(view.anchor).toEqual({ kind: "zone", id: "mainScheme" });
    expect(view.panel?.title).toContain("threat");

    controller.primary();
    const thwartStep = controller.view();
    expect(thwartStep.step?.id).toBe("thwart");
    expect(thwartStep.anchor).toEqual({ kind: "action", id: "thwart" });
    expect(thwartStep.gate?.actions.has("thwart")).toBe(true);
  });
});

describe("GuideController — Back, Skip, Stop, Escape (§3.10)", () => {
  test("Back returns to the villain phase's first step", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    for (let i = 0; i < 5; i++) run(core, controller, i);
    expect(controller.view().step?.id).toBe("villain-phase-order");

    controller.primary();
    expect(controller.view().step?.id).toBe("declare-defender");

    controller.back();
    expect(controller.view().step?.id).toBe("villain-phase-order");
  });

  test("Skip ends scripted lessons for this run without marking the controller stopped", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    expect(controller.view().active).toBe(true);

    controller.skip();
    expect(controller.view().active).toBe(false);
    expect(controller.stopped).toBe(false);

    // A later observation (flipping to hero) never revives a skipped run.
    run(core, controller, 0);
    run(core, controller, 1);
    expect(controller.view().active).toBe(false);
  });

  test("Stop ends guidance for this game and records it in the live guide prefs", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));

    controller.stop();
    expect(controller.stopped).toBe(true);
    expect(controller.view().active).toBe(false);
    expect(guidePrefs().tutorial.skipped).toBe(true);
  });

  test("Escape's own release (onGateReleased) counts the step as skipped, the same as the Skip control", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    const gate = controller.view().gate;
    expect(gate).not.toBeNull();

    gate!.onGateReleased?.();
    expect(controller.view().active).toBe(false);
    expect(controller.stopped).toBe(false);
  });

  test("two inert clicks (onGateEscaped) only arm the nudge line, never skip on their own", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    const gate = controller.view().gate;

    gate!.onGateEscaped?.();
    const view = controller.view();
    expect(view.active).toBe(true);
    expect(view.panel?.nudge).toBe("Want to do something else? Skip this step");
  });

  test("nothing here ever reads or acts for a player other than the perspective player", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = new GuideController(
      { lessons: TUTORIAL_LESSONS, alreadyDone: ["how-to-win"] },
      observationOf(started.snapshot, OTHER_PLAYER),
    );
    // The card anchor's own instance lookup is keyed to whichever `perspectiveId` the observation carries — a
    // wrong or absent seat simply resolves no card, rather than reading someone else's hand.
    dispatch(core, 0);
    const afterFlip = dispatch(core, 1);
    controller.onObservation(observationOf(afterFlip, OTHER_PLAYER));
    expect(controller.view().gate?.cards.size).toBe(0);
  });
});
