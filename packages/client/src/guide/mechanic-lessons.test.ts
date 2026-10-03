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
  return { core, controller, dispatch, choose, state, me, inPlay };
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
