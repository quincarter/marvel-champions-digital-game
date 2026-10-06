/**
 * Drives `MECHANIC_TRYIT_LESSONS` (guided mode §3.14) through `GuideController` against a real session core with the
 * real card scripts: each lesson is played to completion by dispatching the commands its steps ask for, the way
 * `aspect-lessons.test.ts` does for the aspect Try-its.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { activeVillain, choiceId, type InstanceId } from "@mc/engine";
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
async function run(id: MechanicTryItId, onComplete?: () => void, blocked?: () => boolean) {
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
    {
      lessons: [MECHANIC_TRYIT_LESSONS[id]],
      runLabel: `${id} · Try it`,
      ...(onComplete ? { onComplete } : {}),
      ...(blocked ? { blocked } : {}),
    },
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

describe("Phoenix: paying for one Firebird with the other (QB-11)", () => {
  const forceOf = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).find((i) => i.cardId.startsWith("34002"))!;

  test("a legal off-script spend does not strand the lesson: it says so, then carries on to what Unleashed means", async () => {
    const onComplete = vi.fn();
    const t = await run("phoenix", onComplete);
    t.controller.primary(); // intro
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34024"),
      payment: [{ ability: { instanceId: t.me().identity.instanceId, abilityId: "34001a.psionic-bond" as never } }],
      attachToInstanceId: null,
    });
    // The first Firebird paid for with the second Firebird instead of Energy.
    const [first, second] = t.me().hand.filter((id) => t.state().instances[id]!.cardId === "34013") as [
      InstanceId,
      InstanceId,
    ];
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: first,
      payment: [{ fromHand: second }],
      attachToInstanceId: null,
    });
    t.settle(/^Remove/);
    expect(forceOf(t).counters.power).toBe(2);
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.settle(/No defense/);
    expect(t.state().round).toBe(2);
    expect(t.me().hand.map((id) => t.state().instances[id]!.cardId)).not.toContain("34013");
    expect(t.controller.view().step?.id).toBe("firebird-spent");
    t.controller.primary();
    expect(t.controller.view().step?.id).toBe("unleashed");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("Shadowcat: Solid and Phased", () => {
  const massOf = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).find((i) => i.cardId.startsWith("32031"))!;

  test("opens as Kitty Pryde with the mass form Solid, on the intro step", async () => {
    const t = await run("shadowcat");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(massOf(t).flipped).toBe(false);
    expect(t.controller.view().step?.id).toBe("intro");
  });

  test("walks Phase Control, the hero flip, a defense while Phased and the flip back to Solid", async () => {
    const onComplete = vi.fn();
    const t = await run("shadowcat", onComplete);
    t.controller.primary();

    // Phase Control flips the mass form and nothing else: she stays an alter-ego, and the hero flip is still unused.
    expect(t.controller.view().step?.id).toBe("phase-control");
    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "32030b.kitty-pryde-constant" as never,
      payment: [],
    });
    expect(massOf(t).flipped).toBe(true);
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.me().identity.changedFormThisRound).toBe(false);

    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    expect(massOf(t).flipped).toBe(true); // the hero flip did not touch the mass form

    expect(t.controller.view().step?.id).toBe("end-turn");
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    // Rest of the turn's end: any discard choice, until Rhino's attack asks who defends.
    while (t.state().pendingChoice && t.state().pendingChoice!.prompt.kind !== "declareDefender") t.choose(/./);
    expect(t.state().pendingChoice?.prompt.kind).toBe("declareDefender");
    const view = t.controller.view();
    expect(view.step?.id).toBe("declare-defender");
    expect(view.anchor).toEqual({ kind: "choice", id: "defend" });

    const hp = t.state().instances[t.me().identity.instanceId]!.damage;
    t.settle(/Kitty|Shadowcat/);
    expect(t.state().instances[t.me().identity.instanceId]!.damage).toBe(hp); // Phased: no damage while defending
    expect(massOf(t).flipped).toBe(false); // and it flipped itself back to Solid
    expect(t.controller.view().step?.id).toBe("back-to-solid");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("Shadowcat: the last step waits for the villain-phase walkthrough", () => {
  test("the back-to-Solid step stays hidden while the walkthrough plays, then shows once it ends", async () => {
    let walkthrough = false;
    let waitingOnPlayer = (): boolean => false;
    // The board's own rule (`BoardGuideMount#walkthroughPlaying`): the walkthrough blocks only while nothing is
    // waiting on the player.
    const t = await run("shadowcat", undefined, () => walkthrough && !waitingOnPlayer());
    waitingOnPlayer = () => t.state().pendingChoice !== null;
    t.controller.primary();
    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "32030b.kitty-pryde-constant" as never,
      payment: [],
    });
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    while (t.state().pendingChoice && t.state().pendingChoice!.prompt.kind !== "declareDefender") t.choose(/./);
    // The walkthrough is up but waiting on the defend prompt: the step may show.
    walkthrough = true;
    expect(t.controller.view().step?.id).toBe("declare-defender");
    t.settle(/Kitty|Shadowcat/);
    // The defense is made, and the walkthrough is still auto-advancing: the next step must not show yet.
    expect(t.controller.view().step?.id).toBe("declare-defender");
    expect(t.controller.state.active?.stepIndex).toBe(5); // it is current underneath
    t.controller.primary(); // a held step's button does nothing
    expect(t.controller.state.active?.stepIndex).toBe(5);
    walkthrough = false;
    expect(t.controller.view().step?.id).toBe("back-to-solid");
  });
});

describe("Phoenix: round 2's step waits for the villain-phase walkthrough too", () => {
  test("the Firebird step stays hidden while the walkthrough plays at the top of round 2", async () => {
    let walkthrough = false;
    const t = await run("phoenix", undefined, () => walkthrough);
    t.controller.primary();
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34024"),
      payment: [{ ability: { instanceId: t.me().identity.instanceId, abilityId: "34001a.psionic-bond" as never } }],
      attachToInstanceId: null,
    });
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("34013"),
      payment: [{ fromHand: t.handId("34025") }],
      attachToInstanceId: null,
    });
    t.settle(/^Remove/);
    expect(t.controller.view().step?.id).toBe("end-turn");
    walkthrough = true; // the walkthrough opens the moment the turn ends and plays until the next player phase
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.settle(/No defense/);
    expect(t.state().round).toBe(2);
    expect(t.controller.view().step?.id).toBe("end-turn"); // round 2's step is current underneath, but held
    walkthrough = false;
    expect(t.controller.view().step?.id).toBe("firebird-flip");
  });
});

describe("Gambit: charge counters", () => {
  const charge = (t: Awaited<ReturnType<typeof run>>) =>
    t.state().instances[t.me().identity.instanceId]!.counters.charge ?? 0;

  test("opens as Remy LeBeau with no charge counters, holding the stacked hand", async () => {
    const t = await run("gambit");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(charge(t)).toBe(0);
    expect(
      t
        .me()
        .hand.map((id) => t.state().instances[id]!.cardId)
        .sort(),
    ).toEqual(["37006", "37010", "37010", "37022", "37023", "37024"].sort());
  });

  test("walks Charge de Card, Molecular Acceleration and Throw de Card (remove up to 3) to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("gambit", onComplete);
    t.controller.primary();
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    expect(t.controller.view().step?.id).toBe("charge-de-card");
    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "37001a.charge-de-card" as never,
      payment: [],
    });
    expect(charge(t)).toBe(1);

    const play = t.controller.view();
    expect(play.step?.id).toBe("charged-card");
    expect(play.anchor).toEqual({ kind: "card", code: "37006" });
    expect(currentStep(t.controller.state)?.copy.payWith?.map((p) => p.kind === "handCard" && p.code)).toEqual([
      "37010",
      "37022",
    ]);
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("37006"),
      payment: [{ fromHand: t.handId("37010") }, { fromHand: t.handId("37022") }],
      attachToInstanceId: null,
    });
    // Molecular Acceleration's interrupt places the second counter; then Throw de Card offers "up to 3".
    const accelerate = t.state().pendingChoice!;
    expect(accelerate.prompt.kind).toBe("chooseTriggers");
    t.dispatch({
      type: "resolveChoice",
      playerId: accelerate.playerId,
      choiceId: accelerate.choiceId,
      selectedOptionIds: accelerate.options.map((o) => o.optionId),
    });
    expect(charge(t)).toBe(2);
    const throwDeCard = t.state().pendingChoice!;
    expect(throwDeCard.options.map((o) => o.optionId)).toEqual([expect.stringContaining("37001a.throw-de-card")]);
    t.dispatch({
      type: "resolveChoice",
      playerId: throwDeCard.playerId,
      choiceId: throwDeCard.choiceId,
      selectedOptionIds: throwDeCard.options.map((o) => o.optionId),
    });
    // "Up to 3" with two counters on him offers 1 or 2, never 0 and never 3.
    const how = t.state().pendingChoice!;
    expect(how.prompt.kind).toBe("chooseCostCounters");
    expect(how.options.map((o) => o.label)).toEqual(["Remove 2 charge counters", "Remove 1 charge counter"]);
    expect(t.controller.view().step?.id).toBe("charged-card");
    t.choose(/Remove 2/);
    t.settle(/Rhino/);
    expect(charge(t)).toBe(0);
    const rhino = t.state().villains[0]!;
    expect(t.state().instances[rhino.instanceId]!.damage).toBe(6); // 4 base + 2 removed

    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("with no charge counters Throw de Card is not offered when an attack event is played", async () => {
    const t = await run("gambit");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("37006"),
      payment: [{ fromHand: t.handId("37022") }, { fromHand: t.handId("37023") }],
      attachToInstanceId: null,
    });
    const pending = t.state().pendingChoice!;
    expect(pending.prompt.kind).toBe("chooseTarget");
    expect(pending.options.some((o) => o.optionId.includes("throw-de-card"))).toBe(false);
  });
});

describe("Rogue: Touched", () => {
  const touchedOf = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).find((i) => i.cardId === "38002")!;

  test("opens as Anna Marie with Touched set aside, on the intro step", async () => {
    const t = await run("rogue");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(touchedOf(t).attachedTo).toBeNull();
    expect(t.controller.view().step?.id).toBe("intro");
  });

  test("walks the flip and Skin Contact onto Rhino to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("rogue", onComplete);
    t.controller.primary();

    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    const control = t.controller.view();
    expect(control.step?.id).toBe("skin-contact");
    expect(control.anchor).toEqual({ kind: "zone", id: "identity" });
    t.dispatch({
      type: "useAbility",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.me().identity.instanceId,
      abilityId: "38001a.skin-contact" as never,
      payment: [],
    });
    // The host is chosen after the action starts; the step waits for Touched to land.
    expect(t.controller.view().step?.id).toBe("skin-contact");
    const hosts = t.state().pendingChoice!;
    expect(hosts.options.map((o) => o.label)).toEqual(["Rhino"]);
    t.settle(/Rhino/);

    const rhino = t.state().villains[0]!.instanceId;
    expect(touchedOf(t).attachedTo).toBe(rhino);
    expect(t.controller.view().step?.id).toBe("villain-host");
    expect(t.controller.view().anchor).toEqual({ kind: "zone", id: "villain" });
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("Colossus: two tough cards", () => {
  const tough = (t: Awaited<ReturnType<typeof run>>) => t.state().instances[t.me().identity.instanceId]!.statuses.tough;

  test("opens as Piotr Rasputin with no tough cards and the stacked hand (plus setup's Organic Steel)", async () => {
    const t = await run("colossus");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(tough(t)).toBe(0);
    const hand = t.me().hand.map((id) => t.state().instances[id]!.cardId);
    expect(hand).toEqual(expect.arrayContaining(["32009", "32005", "32008", "32022", "32023", "32024"]));
  });

  test("walks Steel Skin, Bulletproof Protector (two tough cards), Titanium Muscles and the two-resource payment", async () => {
    const onComplete = vi.fn();
    const t = await run("colossus", onComplete);
    t.controller.primary();

    // The flip alone is not enough: Steel Skin is an optional trigger the player has to take.
    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });
    expect(t.controller.view().step?.id).toBe("flip");
    const steelSkin = t.state().pendingChoice!;
    expect(steelSkin.prompt.kind).toBe("chooseTriggers");
    t.dispatch({
      type: "resolveChoice",
      playerId: steelSkin.playerId,
      choiceId: steelSkin.choiceId,
      selectedOptionIds: steelSkin.options.map((o) => o.optionId),
    });
    expect(tough(t)).toBe(1);

    expect(t.controller.view().step?.id).toBe("bulletproof-protector");
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("32009"),
      payment: [],
      attachToInstanceId: null,
    });
    expect(t.controller.view().step?.id).toBe("bulletproof-protector"); // the choice is still open
    t.settle(/2 tough/);
    expect(tough(t)).toBe(2);

    const muscles = t.controller.view();
    expect(muscles.step?.id).toBe("titanium-muscles");
    expect(muscles.anchor).toEqual({ kind: "card", code: "32005" });
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("32005"),
      payment: [{ fromHand: t.handId("32022") }, { fromHand: t.handId("32023") }],
      attachToInstanceId: null,
    });

    expect(t.controller.view().step?.id).toBe("two-resources");
    const titanium = Object.values(t.state().instances).find((i) => i.cardId === "32005")!;
    // The guide can ring Titanium Muscles' own tile: the step names it as a payer.
    expect(currentStep(t.controller.state)?.copy.payWith).toEqual([
      expect.objectContaining({
        kind: "cardAbility",
        code: "32005",
        abilityId: "32005.titanium-muscles-resource",
      }),
    ]);
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("32008"),
      payment: [
        { ability: { instanceId: titanium.instanceId, abilityId: "32005.titanium-muscles-resource" as never } },
      ],
      attachToInstanceId: null,
    });
    expect(t.controller.view().step?.id).toBe("two-resources"); // Steel Fist's own choices are still open
    t.settle(/Do not discard|Rhino/);
    expect(tough(t)).toBe(2);

    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("Psylocke: Psi-Knife and Psi-Katana", () => {
  const blades = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).filter((i) => i.cardId.startsWith("41002") && i.attachedTo !== null);

  test("opens as Betsy Braddock with two Knife blades attached, on the intro step", async () => {
    const t = await run("psylocke");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(blades(t).map((i) => i.cardId)).toEqual(["41002a", "41002a"]);
    expect(t.controller.view().step?.id).toBe("intro");
  });

  test("walks the flip and a basic attack that accepts Psi-Energy Control and flips a blade to the Katana", async () => {
    const onComplete = vi.fn();
    const t = await run("psylocke", onComplete);
    t.controller.primary();
    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    const attack = t.controller.view();
    expect(attack.step?.id).toBe("attack");
    expect(attack.anchor).toEqual({ kind: "action", id: "attack" });
    t.dispatch({
      type: "basicAttack",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      attackerInstanceId: t.me().identity.instanceId,
      targetInstanceId: activeVillain(t.state() as never).instanceId,
    });
    // Psi-Energy Control is offered as an interrupt: accept it.
    expect(t.state().pendingChoice?.prompt.kind).toBe("chooseTriggers");
    const offer = t.state().pendingChoice!;
    t.dispatch({
      type: "resolveChoice",
      playerId: offer.playerId,
      choiceId: offer.choiceId,
      selectedOptionIds: offer.options
        .filter((o) => o.optionId.includes("41001a.star-psi-energy-control"))
        .map((o) => o.optionId),
    });
    // Both blades are Knives, so no blade choice is asked; Upside the Head's own optional response is still open
    // after the attack, and the step waits for it to settle (declined: a minimum of 0 takes no option).
    expect(t.controller.view().step?.id).toBe("attack");
    t.settle(/./);
    expect(
      blades(t)
        .map((i) => i.flipped)
        .sort(),
    ).toEqual([false, true]); // one Katana side up

    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("Angel: three faces", () => {
  test("opens as Warren Worthington III on the intro step", async () => {
    const t = await run("angel");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.controller.view().step?.id).toBe("intro");
  });

  test("walks Archangel, a round change and the switch to Angel to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("angel", onComplete);
    t.controller.primary();

    expect(t.controller.view().step?.id).toBe("to-archangel");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID, to: { heroForm: 1 } });
    expect(t.me().identity.heroFormIndex).toBe(1);

    expect(t.controller.view().step?.id).toBe("end-turn");
    t.dispatch({ type: "endTurn", playerId: MECHANIC_TRYIT_PLAYER_ID });
    t.settle(/No defense/);
    expect(t.state().round).toBe(2);

    expect(t.controller.view().step?.id).toBe("to-angel");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID, to: { heroForm: 0 } });
    expect(t.me().identity.heroFormIndex).toBe(0);

    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("a second change in the same round is refused by the engine, which is what the end-turn step teaches", async () => {
    const t = await run("angel");
    t.controller.primary();
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID, to: { heroForm: 1 } });
    const again = t.core.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID, to: { heroForm: 0 } });
    expect(again.ok).toBe(false);
  });
});

describe("Cable: player side schemes", () => {
  const schemes = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).filter(
      (i) => (i.cardId === "40018" || i.cardId === "40027") && t.state().villainArea.includes(i.instanceId),
    );

  test("opens as Nathan Summers with Call for Backup in play and Build Support and Psimitar in hand", async () => {
    const t = await run("cable");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(schemes(t).map((i) => i.cardId)).toEqual(["40018"]);
    expect(t.me().hand.map((id) => t.state().instances[id]!.cardId)).toEqual(
      expect.arrayContaining(["40027", "40029"]),
    );
    expect(t.controller.view().step?.id).toBe("intro");
  });

  test("walks the flip, a thwart and Build Support at the limit of one to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("cable", onComplete);
    t.controller.primary();
    expect(t.controller.view().step?.id).toBe("flip");
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    expect(t.controller.view().step?.id).toBe("thwart");
    const backup = schemes(t)[0]!;
    t.dispatch({
      type: "basicThwart",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      thwarterInstanceId: t.me().identity.instanceId,
      schemeInstanceId: backup.instanceId,
    });
    t.settle(/./);
    expect(t.state().instances[backup.instanceId]!.threat).toBe(1);

    const limit = t.controller.view();
    expect(limit.step?.id).toBe("limit");
    expect(limit.anchor).toEqual({ kind: "card", code: "40027" });
    expect(currentStep(t.controller.state)?.copy.payWith).toEqual([
      expect.objectContaining({ kind: "handCard", code: "40029" }),
    ]);
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("40027"),
      payment: [{ fromHand: t.handId("40029") }],
      attachToInstanceId: null,
    });
    // Two player side schemes at a limit of one: the engine asks which to discard, and the step waits for the answer.
    expect(t.state().pendingChoice?.prompt.kind).toBe("discardOverPlayerSideSchemeLimit");
    expect(t.controller.view().step?.id).toBe("limit");
    t.choose(/Call for Backup/);
    expect(schemes(t).map((i) => i.cardId)).toEqual(["40027"]);

    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("X-23: Specialists", () => {
  const specialists = (t: Awaited<ReturnType<typeof run>>) =>
    Object.values(t.state().instances).filter(
      (i) => ["43034", "43035", "43036", "43037"].includes(i.cardId as string) && i.controllerId !== null,
    );

  test("opens as Laura Kinney with Training, Claw Mastery and Animal Instinct in hand", async () => {
    const t = await run("x23");
    expect(t.me().identity.form).toBe("alterEgo");
    expect(t.me().hand.map((id) => t.state().instances[id]!.cardId)).toEqual(
      expect.arrayContaining(["43021", "43005", "43004"]),
    );
    expect(t.controller.view().step?.id).toBe("flip");
  });

  test("walks the flip, Training, Claw Mastery, one thwart with Animal Instinct and a Specialist to completion", async () => {
    const onComplete = vi.fn();
    const t = await run("x23", onComplete);
    t.dispatch({ type: "changeForm", playerId: MECHANIC_TRYIT_PLAYER_ID });

    expect(t.controller.view().step?.id).toBe("play-training");
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("43021"),
      payment: [{ fromHand: t.handId("43023") }],
      attachToInstanceId: null,
    });
    t.settle();
    const training = Object.values(t.state().instances).find((i) => i.cardId === "43021")!;
    expect(training.threat).toBe(5);

    expect(t.controller.view().step?.id).toBe("claw-mastery");
    t.dispatch({
      type: "playCard",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      cardInstanceId: t.handId("43005"),
      payment: [{ fromHand: t.handId("43022") }],
      attachToInstanceId: null,
    });
    t.settle();

    expect(t.controller.view().step?.id).toBe("thwart");
    t.dispatch({
      type: "basicThwart",
      playerId: MECHANIC_TRYIT_PLAYER_ID,
      thwarterInstanceId: t.me().identity.instanceId,
      schemeInstanceId: training.instanceId,
    });
    // The Animal Instinct interrupt is offered before the thwart resolves; accept it, then the Specialist prompt.
    const offer = t.state().pendingChoice!;
    expect(offer.prompt.kind).toBe("chooseTriggers");
    t.dispatch({
      type: "resolveChoice",
      playerId: offer.playerId,
      choiceId: offer.choiceId,
      selectedOptionIds: offer.options
        .filter((o) => o.optionId.includes("43004.animal-instinct"))
        .map((o) => o.optionId),
    });
    expect(t.state().pendingChoice?.prompt.kind).toBe("chooseCards");
    expect(t.state().instances[training.instanceId]!.threat).toBe(0);
    expect(t.controller.view().step?.id).toBe("pick-specialist");
    t.choose(/Surveillance|Combat|Defense|Front/);

    const taken = specialists(t);
    expect(taken).toHaveLength(1);
    expect(taken[0]!.attachedTo).toBe(t.me().identity.instanceId);
    expect(t.controller.view().step?.id).toBe("result");
    t.controller.primary();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
