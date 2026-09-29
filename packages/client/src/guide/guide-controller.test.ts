/**
 * Drives `GuideController` through `TUTORIAL_CONFIG`/`TUTORIAL_SCRIPT` (`guide/tutorial-config.ts`) via the real
 * session core — the same layer `guide/tutorial-config.test.ts` and `view/lesson-model.test.ts` already drive —
 * asserting the panel content and gate at each lesson point, plus Back, Skip, Stop and Escape (§3.10). Mirrors
 * `guide-store.test.ts`'s own `localStorage` fake so `markLessonDone`/`markTutorialSkipped` land somewhere real
 * rather than throwing in a Vitest DOM-less environment.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { cardId } from "@mc/content";
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
    // The step's own `doThis` copy, not the generic fallback (G5c fix: every await step names its own action).
    expect(view.panel?.continueHint).toBe("Flip to Spider-Man");
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

  test("setOverride redirects the play-black-cat step's anchor/doThis, driven by the payment bar (G5c)", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    run(core, controller, 0);
    run(core, controller, 1);
    expect(controller.view().step?.id).toBe("play-black-cat");

    // Before the payment bar opens, the step still names Black Cat herself.
    expect(controller.view().anchor).toEqual({ kind: "card", code: "01002" });
    expect(controller.view().panel?.continueHint).toBe("Tap Black Cat to play her");

    // The payment bar opens on Black Cat, nothing tapped yet: TRY THIS moves to Energy.
    const ENERGY = cardId("01088");
    controller.setOverride("play-black-cat", {
      anchor: { kind: "card", code: ENERGY },
      doThis: "Tap Energy, then Pay",
    });
    expect(controller.view().anchor).toEqual({ kind: "card", code: ENERGY });
    expect(controller.view().tagVariant).toBe("tryThis");
    expect(controller.view().panel?.continueHint).toBe("Tap Energy, then Pay");

    // Energy tapped: TRY THIS moves to the Pay control.
    controller.setOverride("play-black-cat", { anchor: { kind: "control", id: "payment:pay" }, doThis: "Pay" });
    expect(controller.view().anchor).toEqual({ kind: "control", id: "payment:pay" });
    expect(controller.view().tagVariant).toBe("tryThis");
    expect(controller.view().panel?.continueHint).toBe("Pay");

    // Clearing the override (payment cancelled) falls back to the step's own anchor/copy.
    controller.setOverride("play-black-cat", null);
    expect(controller.view().anchor).toEqual({ kind: "card", code: "01002" });
    expect(controller.view().panel?.continueHint).toBe("Tap Black Cat to play her");
  });

  test("playing Black Cat completes lesson 3; no lesson is current again until the villain phase", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    run(core, controller, 0);
    run(core, controller, 1);
    run(core, controller, 2);

    expect(guidePrefs().tutorial.lessonsDone).toContain("paying-for-cards");
    // Round 1's own player turn still has nothing else scripted to teach (lesson 4 waits for the villain phase) —
    // the guide surface stays up as the waiting state (G5c part 2), not gone (§4 G5c item 0).
    const view = controller.view();
    expect(view.active).toBe(true);
    expect(view.step).toBeNull();
    expect(view.anchor).toBeNull();
    expect(view.gate).toBeNull();
    expect(view.panel?.title).toBe("Next: The villain phase");
    expect(view.panel?.body).toBe("It starts when you end your turn.");
    expect(view.panel?.lessons?.[3]).toMatchObject({ id: "villain-phase", status: "upcoming" });
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

  test("Skip (§3.10) advances past only the current step, never the whole run", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    expect(controller.view().step?.id).toBe("flip");

    controller.skip();
    expect(controller.stopped).toBe(false);
    // Lesson 2 ("hero-and-alter-ego") has only the flip step, so skipping it finishes the lesson — but lesson
    // 3's own `when` (hero form) doesn't hold yet, so nothing is current in between. The guide shows the
    // waiting state for it rather than going blank (G5c part 2, §4 G5c item 0).
    expect(guidePrefs().tutorial.lessonsDone).toContain("hero-and-alter-ego");
    const waiting = controller.view();
    expect(waiting.active).toBe(true);
    expect(waiting.step).toBeNull();
    expect(waiting.panel?.title).toBe("Next: Paying for cards");
    expect(waiting.panel?.body).toBe("Flip to Spider-Man when you're ready.");

    // The tutorial keeps running: flipping on the player's own now still opens lesson 3, same as if the flip
    // step had completed normally.
    run(core, controller, 0);
    run(core, controller, 1);
    expect(controller.view().step?.id).toBe("play-black-cat");
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

  test("Escape's own release (onGateReleased) advances past only the current step, same as Skip — the tutorial keeps running", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = newController(observationOf(started.snapshot));
    expect(controller.view().step?.id).toBe("flip");
    const gate = controller.view().gate;
    expect(gate).not.toBeNull();

    gate!.onGateReleased?.();
    expect(controller.stopped).toBe(false);
    // No lesson is current right after (lesson 3 still waits on hero form), but the run itself is not skipped —
    // the waiting state shows, same as the Skip test above.
    expect(controller.view().active).toBe(true);
    expect(controller.view().step).toBeNull();
    expect(guidePrefs().tutorial.lessonsDone).toContain("hero-and-alter-ego");

    // Lesson 3 still shows up once the player flips on their own — Escape never locked the tutorial out of it.
    run(core, controller, 0);
    run(core, controller, 1);
    expect(controller.view().step?.id).toBe("play-black-cat");
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

describe("GuideController — waiting and complete (G5c part 2, §4 G5c item 0)", () => {
  test("the waiting state names the next lesson and what starts it, with no anchor/gate", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = new GuideController(
      { lessons: TUTORIAL_LESSONS, alreadyDone: ["how-to-win", "hero-and-alter-ego"], runLabel: "First game" },
      observationOf(started.snapshot),
    );

    // Lesson 3 ("paying-for-cards") waits on hero form, which the tutorial's own opening (alter-ego) doesn't
    // hold yet — nothing is current, but the guide surface stays up rather than going blank.
    const view = controller.view();
    expect(view.active).toBe(true);
    expect(view.step).toBeNull();
    expect(view.anchor).toBeNull();
    expect(view.gate).toBeNull();
    expect(view.tagVariant).toBeNull();
    // `runLabel` ("First game" for the tutorial), not a hardcoded "Guide" — the `GUIDE` stamp itself is drawn
    // separately by `ui/guide-panel.ts`, so this used to read "GUIDE GUIDE".
    expect(view.panel?.contextLabel).toBe("First game");
    expect(view.panel?.title).toBe("Next: Paying for cards");
    expect(view.panel?.body).toBe("Flip to Spider-Man when you're ready.");
    expect(view.panel?.lessons?.map((row) => row.status)).toEqual(["done", "done", "upcoming", "upcoming", "upcoming"]);
    expect(view.panel?.primaryLabel).toBeNull();
    expect(view.panel?.continueHint).toBeNull();

    // Flipping to hero form resolves the wait, same as if the player had reached this point mid-run.
    run(core, controller, 0); // mulligan
    run(core, controller, 1); // flip
    expect(controller.view().step?.id).toBe("play-black-cat");
  });

  test('a caller with no runLabel falls back to "Guide"', async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = new GuideController(
      { lessons: TUTORIAL_LESSONS, alreadyDone: ["how-to-win", "hero-and-alter-ego"] },
      observationOf(started.snapshot),
    );
    expect(controller.view().panel?.contextLabel).toBe("Guide");
  });

  test("the complete state shows once every lesson is done, and Close hides the guide for the rest of this game", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = new GuideController(
      { lessons: TUTORIAL_LESSONS, alreadyDone: TUTORIAL_LESSONS.map((lesson) => lesson.id), runLabel: "First game" },
      observationOf(started.snapshot),
    );

    const view = controller.view();
    expect(view.active).toBe(true);
    expect(view.step).toBeNull();
    expect(view.anchor).toBeNull();
    expect(view.gate).toBeNull();
    expect(view.panel?.contextLabel).toBe("First game");
    expect(view.panel?.title).toBe("Tutorial complete");
    expect(view.panel?.primaryLabel).toBe("Close");
    expect(view.panel?.lessons).toBeNull();

    // "Close" (the complete panel's own primary action, routed by `primary()`) hides the guide surface outright —
    // unlike `stop()`, this never marks the tutorial skipped in prefs, since it finished normally. `hidden` (not
    // the narrower `stopped`, which only reflects "Stop tutorial") is the shared "nothing should show" check.
    controller.primary();
    expect(controller.view().active).toBe(false);
    expect(controller.hidden).toBe(true);
    expect(guidePrefs().tutorial.skipped).toBe(false);
  });

  test("finishing the last lesson records markTutorialFinished in the live guide prefs, once", async () => {
    const core = new EngineSessionCore();
    const started = await core.start(TUTORIAL_CONFIG);
    const controller = new GuideController(
      { lessons: TUTORIAL_LESSONS, alreadyDone: TUTORIAL_LESSONS.slice(0, -1).map((lesson) => lesson.id) },
      observationOf(started.snapshot),
    );
    expect(guidePrefs().tutorial.finished).toBe(false);

    // The game starts mid-setup (a mulligan step), so lesson 5's own `when` (the player's turn) doesn't hold
    // until the mulligan resolves — same "waiting first" shape the rest of the tutorial script follows.
    run(core, controller, 0); // mulligan
    expect(controller.view().step?.id).toBe("spotlight-scheme");

    // Skipping the lesson's two steps finishes it, and finishing the last lesson is what finishes the run.
    controller.skip();
    controller.skip();

    expect(guidePrefs().tutorial.finished).toBe(true);
    expect(controller.view().panel?.title).toBe("Tutorial complete");
  });
});
