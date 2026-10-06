/**
 * Drives `ASPECT_TRYIT_LESSONS` (guided mode G10d, `docs/guided-mode.md` §4 G10d) through `GuideController` against
 * a real session core — the same shape `guide/guide-controller.test.ts` uses for the tutorial's own five lessons.
 * One aspect (Justice) is driven in full detail (intro → play → a quiet round 1 → attack-or-thwart in round 2); the other three each get a lighter
 * smoke test proving the same predicate wiring holds for a different hero/precon/signature card.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { choiceId } from "@mc/engine";
import { EngineSessionCore, type Snapshot } from "../engine/session-core.js";
import { resetGuidePrefsCacheForTests } from "./guide-store.js";
import { GuideController } from "./guide-controller.js";
import { ASPECT_TRYIT_CONFIGS, ASPECT_TRYIT_PLAYER_ID, type AspectTryItId } from "./aspect-tryit-config.js";
import { ASPECT_TRYIT_LESSONS } from "./aspect-lessons.js";
import { currentStep, type LessonObservation } from "../view/lesson-model.js";

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

  test("walks Daredevil's play, a quiet round 1, then attack-or-thwart in round 2 to completion", async () => {
    const core = new EngineSessionCore();
    let snapshot = await setUp(core, "justice");
    const onComplete = vi.fn();
    const controller = new GuideController(
      { lessons: [ASPECT_TRYIT_LESSONS.justice], onComplete },
      observationOf(snapshot),
    );
    const dispatch = (command: Parameters<EngineSessionCore["dispatch"]>[0]): void => {
      const result = core.dispatch(command);
      if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`);
      snapshot = result.snapshot;
      controller.onObservation(observationOf(snapshot));
    };
    const handCard = (code: string) => {
      const player = snapshot.state.players.find((p) => p.playerId === ASPECT_TRYIT_PLAYER_ID)!;
      return player.hand.find((id) => snapshot.state.instances[id]!.cardId === code)!;
    };
    controller.primary(); // acknowledge the intro

    // Daredevil's payment walk names Strength, then Genius (`guide-mount.ts#syncPayingOverride`).
    expect(
      currentStep(controller.state)?.copy.payWith?.map((payer) => payer.kind === "handCard" && payer.code),
    ).toEqual(["01090", "01089"]);
    const daredevilId = handCard("01058");
    dispatch({
      type: "playCard",
      playerId: ASPECT_TRYIT_PLAYER_ID,
      cardInstanceId: daredevilId,
      payment: [{ fromHand: handCard("01090") }, { fromHand: handCard("01089") }],
      attachToInstanceId: null,
    });
    expect(controller.view().step?.id).toBe("daredevil-does-both");
    controller.primary();

    // Round 1: nothing on the scheme, so the lesson waits for the player to fight and end the turn.
    const quiet = controller.view();
    expect(quiet.step?.id).toBe("fight-while-its-quiet");
    expect(quiet.panel?.body).toContain("has 0 threat");
    expect(quiet.gate).toBeNull(); // a zone anchor locks nothing: the whole hand and every action stay live
    dispatch({ type: "endTurn", playerId: ASPECT_TRYIT_PLAYER_ID });
    for (let choice = snapshot.state.pendingChoice; choice; choice = snapshot.state.pendingChoice) {
      dispatch({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: [] });
    }

    // Round 2: Rhino's threat is on the scheme and the lesson asks the question.
    expect(snapshot.state.round).toBe(2);
    const question = controller.view();
    expect(question.step?.id).toBe("attack-or-thwart");
    expect(question.panel?.body).toContain("has 2 [[threat|threat]]");
    controller.primary();

    const thwart = controller.view();
    expect(thwart.step?.id).toBe("thwart-with-daredevil");
    expect(thwart.anchor).toEqual({ kind: "action", id: "thwart" });
    dispatch({
      type: "basicThwart",
      playerId: ASPECT_TRYIT_PLAYER_ID,
      thwarterInstanceId: daredevilId,
      schemeInstanceId: snapshot.state.mainScheme.instanceId,
    });
    for (let choice = snapshot.state.pendingChoice; choice; choice = snapshot.state.pendingChoice) {
      dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.minSelections > 0 ? [choice.options[0]!.optionId] : [],
      });
    }
    expect(snapshot.state.instances[snapshot.state.mainScheme.instanceId]!.threat).toBe(0);

    expect(controller.view().step?.id).toBe("balance");
    controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(controller.view().panel?.primaryLabel).toBe("Close");
  });
});

describe('ASPECT_TRYIT_LESSONS: \'Pool (Dogpool, then "I Got This")', () => {
  test("the game came with the Dreadpool set, and the lesson opens on the encounter deck", async () => {
    const core = new EngineSessionCore();
    const snapshot = await setUp(core, "pool");
    const dreadpoolSet = ["44037", "44038", "44039", "44040", "44041", "44042"];
    const inGame = Object.values(snapshot.state.instances).filter((i) => dreadpoolSet.includes(i.cardId as string));
    expect(inGame).toHaveLength(7);
    const controller = new GuideController({ lessons: [ASPECT_TRYIT_LESSONS.pool] }, observationOf(snapshot));
    const intro = controller.view();
    expect(intro.step?.id).toBe("intro");
    expect(intro.anchor).toEqual({ kind: "zone", id: "encounter" });
    expect(intro.panel?.title).toBe("You're playing Deadpool with 'Pool");
  });

  test('walks the flip, Dogpool, a round, then "I Got This" removing 2 threat, to completion', async () => {
    const core = new EngineSessionCore();
    let snapshot = await setUp(core, "pool");
    const onComplete = vi.fn();
    const controller = new GuideController(
      { lessons: [ASPECT_TRYIT_LESSONS.pool], onComplete },
      observationOf(snapshot),
    );
    const dispatch = (command: Parameters<EngineSessionCore["dispatch"]>[0]): void => {
      const result = core.dispatch(command);
      if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`);
      snapshot = result.snapshot;
      controller.onObservation(observationOf(snapshot));
    };
    const me = () => snapshot.state.players.find((p) => p.playerId === ASPECT_TRYIT_PLAYER_ID)!;
    const handCard = (code: string) => me().hand.find((id) => snapshot.state.instances[id]!.cardId === code)!;
    const threat = () => snapshot.state.instances[snapshot.state.mainScheme.instanceId]!.threat;
    const settle = (): void => {
      for (let choice = snapshot.state.pendingChoice; choice; choice = snapshot.state.pendingChoice) {
        dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.minSelections > 0 ? [choice.options[0]!.optionId] : [],
        });
      }
    };

    controller.primary(); // intro
    expect(controller.view().step?.id).toBe("flip");
    dispatch({ type: "changeForm", playerId: ASPECT_TRYIT_PLAYER_ID });

    expect(controller.view().step?.id).toBe("play-dogpool");
    expect(currentStep(controller.state)?.copy.payWith?.map((p) => p.kind === "handCard" && p.code)).toEqual([
      "44004",
      "44003",
      "44006",
    ]);
    dispatch({
      type: "playCard",
      playerId: ASPECT_TRYIT_PLAYER_ID,
      cardInstanceId: handCard("44013"),
      payment: [{ fromHand: handCard("44004") }, { fromHand: handCard("44003") }, { fromHand: handCard("44006") }],
      attachToInstanceId: null,
    });
    settle();

    expect(controller.view().step?.id).toBe("end-turn");
    dispatch({ type: "endTurn", playerId: ASPECT_TRYIT_PLAYER_ID });
    settle();
    expect(snapshot.state.round).toBe(2);
    expect(threat()).toBeGreaterThanOrEqual(2);

    expect(controller.view().step?.id).toBe("play-i-got-this");
    const before = threat();
    dispatch({
      type: "playCard",
      playerId: ASPECT_TRYIT_PLAYER_ID,
      cardInstanceId: handCard("44021"),
      payment: [{ fromHand: handCard("44005") }],
      attachToInstanceId: null,
    });
    settle();
    expect(threat()).toBe(before - 2);

    expect(controller.view().step?.id).toBe("result");
    controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("ASPECT_TRYIT_LESSONS: the other three aspects", () => {
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
    expect(step("aggression").copy.payWith).toEqual([
      { kind: "handCard", code: "01088", doThis: "Tap Energy, then Pay" }, // Energy pays Hulk
    ]);
    expect(step("leadership").copy.payWith).toEqual([
      { kind: "handCard", code: "01089", doThis: "Tap Genius, then Pay" }, // Genius pays Maria Hill
    ]);
    expect(step("protection").copy.payWith).toEqual([
      { kind: "handCard", code: "01042", doThis: "Tap Ancestral Knowledge, then Pay" }, // Ancestral Knowledge pays Armored Vest
    ]);
  });

  test("Justice walks two payers in order: Strength, then Genius (owner report, 2026-09-29)", () => {
    const step = ASPECT_TRYIT_LESSONS.justice.steps.find((s) => s.id === "play-signature")!;
    expect(step.copy.payWith?.map((payer) => payer.kind === "handCard" && payer.code)).toEqual(["01090", "01089"]);
  });
});

// `MULLIGAN_CHOICE_ID` documents the id `setUp`'s own loop answers first — asserted once here rather than in every
// test above, mirroring `aspect-tryit-config.test.ts`'s own use of the same constant.
test("the mulligan is always choice c1, the id every aspect config's own first setup step resolves", async () => {
  const core = new EngineSessionCore();
  const started = await core.start(ASPECT_TRYIT_CONFIGS.justice.config);
  expect(started.snapshot.state.pendingChoice?.choiceId).toBe(MULLIGAN_CHOICE_ID);
});
