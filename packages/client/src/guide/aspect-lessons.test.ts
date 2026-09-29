/**
 * Drives `ASPECT_TRYIT_LESSONS` (guided mode G10d, `docs/guided-mode.md` §4 G10d) through `GuideController` against
 * a real session core — the same shape `guide/guide-controller.test.ts` uses for the tutorial's own five lessons.
 * One aspect (Justice) is driven in full detail (intro → play → complete); the other three each get a lighter
 * smoke test proving the same predicate wiring holds for a different hero/precon/signature card.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { choiceId } from "@mc/engine";
import { EngineSessionCore, type Snapshot } from "../engine/session-core.js";
import { resetGuidePrefsCacheForTests } from "./guide-store.js";
import { GuideController } from "./guide-controller.js";
import { ASPECT_TRYIT_CONFIGS, ASPECT_TRYIT_PLAYER_ID, type AspectTryItId } from "./aspect-tryit-config.js";
import { ASPECT_TRYIT_LESSONS } from "./aspect-lessons.js";
import type { LessonObservation } from "../view/lesson-model.js";

const MULLIGAN_CHOICE_ID = choiceId("c1");

/** A minimal `Storage` stand-in, matching `guide-controller.test.ts`'s own fake. */
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

function observationOf(snapshot: Snapshot): LessonObservation {
  return {
    game: snapshot.state as unknown as LessonObservation["game"],
    lastEvents: snapshot.events,
    perspectiveId: ASPECT_TRYIT_PLAYER_ID,
  };
}

/** Starts `aspect`'s own game and resolves every pending setup choice (the mulligan kept as dealt, any later one
 * answered with its first option — the same loop `guide/start-aspect-tryit.ts` runs, and its own header explains
 * why that's fine for a "Try it" run). Returns the resulting snapshot. */
async function setUp(core: EngineSessionCore, aspect: AspectTryItId): Promise<Snapshot> {
  const started = await core.start(ASPECT_TRYIT_CONFIGS[aspect].config);
  let snapshot = started.snapshot;
  for (let choice = snapshot.state.pendingChoice; choice; choice = snapshot.state.pendingChoice) {
    const answer = choice.minSelections > 0 ? [choice.options[0]!.optionId] : [];
    const result = core.dispatch({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: answer,
    });
    if (!result.ok) throw new Error(`setup choice refused: ${result.error.code} ${result.error.message}`);
    snapshot = result.snapshot;
  }
  return snapshot;
}

describe("ASPECT_TRYIT_LESSONS — Justice (Daredevil)", () => {
  test("starts on the intro step, then opens on Daredevil once acknowledged", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "justice");
    const controller = new GuideController(
      { lessons: [ASPECT_TRYIT_LESSONS.justice], runLabel: "Justice · Try it" },
      observationOf(snapshot),
    );

    const intro = controller.view();
    expect(intro.step?.id).toBe("intro");
    expect(intro.panel?.title).toBe("You're playing Spider-Man with Justice");
    expect(intro.panel?.primaryLabel).toBe("Got it");

    controller.primary();
    const play = controller.view();
    expect(play.step?.id).toBe("play-signature");
    expect(play.anchor).toEqual({ kind: "card", code: "01058" });
    expect(play.tagVariant).toBe("tryThis");
    // The soft gate stays loose (this lesson's own header: "don't gate input heavily") — every basic action stays
    // live alongside the signature card's own hand-wide gate (`guide/guide-controller.ts#gateFor`).
    expect(play.gate?.actions.has("attack")).toBe(true);
    expect(play.gate?.actions.has("thwart")).toBe(true);
    expect(play.gate?.actions.has("endTurn")).toBe(true);
  });

  test("playing Daredevil completes the lesson and marks it done via onComplete", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "justice");
    const onComplete = vi.fn();
    const controller = new GuideController(
      { lessons: [ASPECT_TRYIT_LESSONS.justice], onComplete },
      observationOf(snapshot),
    );
    controller.primary(); // acknowledge the intro

    const player = snapshot.state.players.find((p) => p.playerId === ASPECT_TRYIT_PLAYER_ID)!;
    const daredevilId = player.hand.find((id) => snapshot.state.instances[id]!.cardId === "01058")!;
    const strengthId = player.hand.find((id) => snapshot.state.instances[id]!.cardId === "01090")!;
    const geniusId = player.hand.find((id) => snapshot.state.instances[id]!.cardId === "01089")!;

    const played = core.dispatch({
      type: "playCard",
      playerId: ASPECT_TRYIT_PLAYER_ID,
      cardInstanceId: daredevilId,
      payment: [{ fromHand: strengthId }, { fromHand: geniusId }],
      attachToInstanceId: null,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    controller.onObservation(observationOf(played.snapshot));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const view = controller.view();
    expect(view.step).toBeNull();
    expect(view.panel?.primaryLabel).toBe("Close");
  });
});

describe("ASPECT_TRYIT_LESSONS — the other three aspects", () => {
  test("Aggression opens on Hulk", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "aggression");
    const controller = new GuideController({ lessons: [ASPECT_TRYIT_LESSONS.aggression] }, observationOf(snapshot));
    controller.primary();
    expect(controller.view().anchor).toEqual({ kind: "card", code: "01050" });
  });

  test("Leadership opens on Maria Hill", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "leadership");
    const controller = new GuideController({ lessons: [ASPECT_TRYIT_LESSONS.leadership] }, observationOf(snapshot));
    controller.primary();
    expect(controller.view().anchor).toEqual({ kind: "card", code: "01067" });
  });

  test("Protection opens on Armored Vest", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "protection");
    const controller = new GuideController({ lessons: [ASPECT_TRYIT_LESSONS.protection] }, observationOf(snapshot));
    controller.primary();
    expect(controller.view().anchor).toEqual({ kind: "card", code: "01081" });
  });
});

describe("play-signature's own payWith (guided mode G10d fix)", () => {
  test("Aggression, Leadership and Protection each name the single card that pays their signature card exactly", () => {
    const step = (aspect: AspectTryItId) => ASPECT_TRYIT_LESSONS[aspect].steps.find((s) => s.id === "play-signature")!;
    expect(step("aggression").copy.payWith).toBe("01088"); // Energy pays Hulk
    expect(step("aggression").copy.payWithDoThis).toBe("Tap Energy, then Pay");
    expect(step("leadership").copy.payWith).toBe("01089"); // Genius pays Maria Hill
    expect(step("leadership").copy.payWithDoThis).toBe("Tap Genius, then Pay");
    expect(step("protection").copy.payWith).toBe("01042"); // Ancestral Knowledge pays Armored Vest
    expect(step("protection").copy.payWithDoThis).toBe("Tap Ancestral Knowledge, then Pay");
  });

  test("Justice has none — Daredevil's cost needs two cards together, not a single payer", () => {
    const step = ASPECT_TRYIT_LESSONS.justice.steps.find((s) => s.id === "play-signature")!;
    expect(step.copy.payWith).toBeUndefined();
  });
});

// `MULLIGAN_CHOICE_ID` documents the id `setUp`'s own loop answers first — asserted once here rather than in every
// test above, mirroring `aspect-tryit-config.test.ts`'s own use of the same constant.
test("the mulligan is always choice c1, the id every aspect config's own first setup step resolves", async () => {
  const core = new EngineSessionCore();
  const started = await core.start(ASPECT_TRYIT_CONFIGS.justice.config);
  expect(started.snapshot.state.pendingChoice?.choiceId).toBe(MULLIGAN_CHOICE_ID);
});
