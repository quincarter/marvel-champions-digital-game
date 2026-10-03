/**
 * Drives `MECHANIC_TRYIT_LESSONS` (guided mode §3.14) through `GuideController` against a real session core with the
 * real card scripts: each lesson is played to completion by dispatching the commands its steps ask for, the way
 * `aspect-lessons.test.ts` does for the aspect Try-its.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { choiceId } from "@mc/engine";
import { EngineSessionCore, type Snapshot } from "../engine/session-core.js";
import { resetGuidePrefsCacheForTests } from "./guide-store.js";
import { GuideController } from "./guide-controller.js";
import { MECHANIC_TRYIT_CONFIGS, MECHANIC_TRYIT_PLAYER_ID } from "./mechanic-tryit-config.js";
import { MECHANIC_TRYIT_LESSONS } from "./mechanic-lessons.js";
import { MECHANIC_TRYITS, type MechanicTryItId } from "./mechanic-tryits.js";
import { currentStep, type LessonObservation } from "../view/lesson-model.js";

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

const observationOf = (snapshot: Snapshot): LessonObservation => ({
  game: snapshot.state as unknown as LessonObservation["game"],
  lastEvents: snapshot.events,
  perspectiveId: MECHANIC_TRYIT_PLAYER_ID,
});

/** One lesson's game, with the helpers every lesson test below shares. */
async function run(id: MechanicTryItId, onComplete?: () => void) {
  const core = new EngineSessionCore();
  const started = await core.start(MECHANIC_TRYIT_CONFIGS[id].config);
  let snapshot = started.snapshot;
  // The same loop `guide/start-mechanic-tryit.ts` runs: keep the dealt hand, take the first option of any later choice.
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
  const controller = new GuideController(
    { lessons: [MECHANIC_TRYIT_LESSONS[id]], runLabel: `${id} · Try it`, ...(onComplete ? { onComplete } : {}) },
    observationOf(snapshot),
  );
  const dispatch = (command: Parameters<EngineSessionCore["dispatch"]>[0]): void => {
    const result = core.dispatch(command);
    if (!result.ok) throw new Error(`refused: ${result.error.code} ${result.error.message}`);
    snapshot = result.snapshot;
    controller.onObservation(observationOf(snapshot));
  };
  /** Resolves the open choice by the option whose label matches `label` (else the first). */
  const choose = (label: RegExp): void => {
    const choice = snapshot.state.pendingChoice!;
    const option = choice.options.find((o) => label.test(o.label)) ?? choice.options[0]!;
    dispatch({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.minSelections > 0 ? [option.optionId] : [],
    });
  };
  const state = () => snapshot.state;
  const me = () => snapshot.state.players.find((p) => p.playerId === MECHANIC_TRYIT_PLAYER_ID)!;
  const inPlay = () => me().playArea.map((id) => snapshot.state.instances[id]!.cardId as string);
  const handId = (code: string) => me().hand.find((id) => snapshot.state.instances[id]!.cardId === code)!;
  /** Answers every open choice with the first option whose label matches `label` (else the first; none if optional). */
  const settle = (label: RegExp = /./): void => {
    while (snapshot.state.pendingChoice) {
      const choice = snapshot.state.pendingChoice;
      const option = choice.options.find((o) => label.test(o.label)) ?? choice.options[0];
      dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.minSelections > 0 && option ? [option.optionId] : [],
      });
    }
  };
  return { core, controller, dispatch, choose, settle, handId, state, me, inPlay };
}

test("every catalog row has a lesson, a config and a distinct id", () => {
  const ids = MECHANIC_TRYITS.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(MECHANIC_TRYIT_LESSONS[id]).toBeDefined();
    expect(MECHANIC_TRYIT_CONFIGS[id]).toBeDefined();
  }
});

test("the mulligan is the first setup choice every mechanic config resolves", async () => {
  for (const { id } of MECHANIC_TRYITS) {
    const core = new EngineSessionCore();
    const started = await core.start(MECHANIC_TRYIT_CONFIGS[id].config);
    expect(started.snapshot.state.pendingChoice?.choiceId).toBe(choiceId("c1"));
  }
});

describe("Storm: the Weather deck", () => {
  test("opens in alter-ego form with a Weather already in play, on the intro step", async () => {
    const t = await run("storm");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.inPlay()).toEqual(["36002"]); // Clear Skies, setup's first pick
    const intro = t.controller.view();
    expect(intro.step?.id).toBe("intro");
    expect(intro.panel?.primaryLabel).toBe("Got it");
  });

  test("walks flip, Weather Control (Thunderstorm, aimed at Rhino) and the Special to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("storm", onComplete);
    t.controller.primary(); // acknowledge the intro

    const flip = t.controller.view();
    expect(flip.step?.id).toBe("flip");
    expect(flip.anchor).toEqual({ kind: "action", id: "flip" });
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    const control = t.controller.view();
    expect(control.step?.id).toBe("weather-control");
    expect(control.anchor).toEqual({ kind: "zone", id: "identity" });
    // A zone anchor locks nothing: every action and the whole hand stay live while this step waits.
    expect(control.gate).toBeNull();

    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "36001a.weather-control" as never,
      payment: [],
    });
    // The swap is not done until the player picks the Weather.
    expect(t.controller.view().step?.id).toBe("weather-control");
    t.choose(/Thunderstorm/);
    expect(t.inPlay()).toEqual(["36004"]);
    // Thunderstorm's Special asks for a target: the step stays until it is answered, so the Special has happened.
    expect(t.state().pendingChoice?.prompt.kind).toBe("chooseTarget");
    expect(t.controller.view().step?.id).toBe("weather-control");
    const rhino = t.state().villains[0]!.instanceId;
    const damageBefore = t.state().instances[rhino]!.damage;
    t.choose(/Rhino/);
    expect(t.state().instances[rhino]!.damage).toBe(damageBefore + 2);

    expect(t.controller.view().step?.id).toBe("special-resolved");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(t.controller.view().panel?.primaryLabel).toBe("Close");
  });

  test("Hurricane: the step settles once its Special's own choices are answered", async () => {
    const t = await run("storm");
    t.controller.primary();
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "36001a.weather-control" as never,
      payment: [],
    });
    t.choose(/Hurricane/);
    expect(t.inPlay()).toEqual(["36003"]);
    while (t.state().pendingChoice) t.choose(/./);
    expect(currentStep(t.controller.state)?.id).toBe("special-resolved");
  });
});

describe("Phoenix: Restrained and Unleashed", () => {
  const BOND = "34001a.psionic-bond" as never;
  const forceOf = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).find((i) => i.cardId.startsWith("34002"))!;

  test("opens in alter-ego form with Phoenix Force Restrained and holding 4 power counters", async () => {
    const t = await run("phoenix");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(forceOf(t).cardId).toBe("34002a");
    expect(forceOf(t).counters.power).toBe(4);
    expect(t.controller.view().step?.id).toBe("intro");
    // The hand is the stacked one: Down Time, both Firebirds and the three resources.
    expect(
      t
        .me()
        .hand.map((id) => t.state().instances[id]!.cardId)
        .sort(),
    ).toEqual(["34013", "34013", "34024", "34025", "34026", "34027"].sort());
  });

  test("walks Psionic Bond, a Firebird, a round change and the last counter to the flip", async () => {
    const onComplete = vi.fn();
    const t = await run("phoenix", onComplete);
    t.controller.primary(); // intro

    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    // Psionic Bond pays Down Time with a counter (4 to 3).
    const bond = t.controller.view();
    expect(bond.step?.id).toBe("psionic-bond");
    expect(bond.anchor).toEqual({ kind: "card", code: "34024" });
    expect(currentStep(t.controller.state)?.copy.payWith).toEqual([
      expect.objectContaining({ kind: "identityAbility", abilityId: "34001a.psionic-bond" }),
    ]);
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34024"),
      payment: [{ ability: { instanceId: t.me().identity.instanceId, abilityId: BOND } }],
      attachToInstanceId: null,
    });
    expect(forceOf(t).counters.power).toBe(3);

    // The first Firebird, paid by Energy: the step waits for the player to choose Remove (3 to 2).
    expect(t.controller.view().step?.id).toBe("firebird-remove");
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34013"),
      payment: [{ fromHand: t.handId("34025") }],
      attachToInstanceId: null,
    });
    expect(t.controller.view().step?.id).toBe("firebird-remove"); // the choice is still open
    t.settle(/^Remove/);
    expect(forceOf(t).counters.power).toBe(2);
    expect(forceOf(t).flipped).toBe(false);

    // End the turn: the lesson waits for round 2's player phase.
    expect(t.controller.view().step?.id).toBe("end-turn");
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.settle(/No defense/);
    expect(t.state().round).toBe(2);
    expect(t.controller.view().step?.id).toBe("firebird-flip");
    expect(t.me().hand.map((id) => t.state().instances[id]!.cardId)).toContain("34013");

    // The second Firebird paid by Psionic Bond takes the last two counters and flips the card.
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34013"),
      payment: [{ ability: { instanceId: t.me().identity.instanceId, abilityId: BOND } }],
      attachToInstanceId: null,
    });
    t.settle(/^Remove/);
    expect(forceOf(t).counters.power).toBe(0);
    expect(forceOf(t).flipped).toBe(true);

    expect(t.controller.view().step?.id).toBe("unleashed");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
