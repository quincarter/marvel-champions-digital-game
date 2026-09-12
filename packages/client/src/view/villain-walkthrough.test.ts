/**
 * The walkthrough is rebuilt from a real villain phase's event stream, played
 * by real Core content — the whole reason it exists is that the engine runs the
 * phase inside one command, so a synthetic event list would prove nothing.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { appendWalkthrough, decisionLabel, emptyWalkthrough, pauseFor, VILLAIN_STEPS, type Walkthrough } from "./villain-walkthrough.js";

interface Played {
  readonly walkthrough: Walkthrough;
  readonly state: GameState;
  readonly viewer: PlayerId;
  /** Every pause seen across the phase, in order. */
  readonly pauses: readonly string[];
}

/**
 * Plays a Rhino solo game by ending every turn as fast as possible, which is
 * the quickest route into a full villain phase, and folds each update onto the
 * walkthrough exactly as the Board scene would.
 */
async function playThroughVillainPhase(): Promise<Played> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  const viewer = store.state.game!.players[0]!.playerId;

  let walkthrough = emptyWalkthrough(store.state.game!.round);
  const pauses: string[] = [];
  let sawVillainPhase = false;

  for (let step = 0; step < 80 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await store.dispatch(end.example);
    } else break;

    walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer);
    if (walkthrough.pausedAt) pauses.push(walkthrough.pausedAt.label);
    if (walkthrough.activeStep !== null) sawVillainPhase = true;
    // Stop once a whole villain phase has been walked.
    if (sawVillainPhase && walkthrough.complete) break;
    if (store.state.game!.outcome) break;
  }

  return { walkthrough, state: store.state.game!, viewer, pauses };
}

describe("villain phase walkthrough", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  test("rebuilds all five RRG steps, in order, from the event stream alone", () => {
    const { steps } = played.walkthrough;

    expect(steps.map((step) => step.kind)).toEqual([...VILLAIN_STEPS]);
    expect(steps.map((step) => step.number)).toEqual([1, 2, 3, 4, 5]);
    for (const step of steps) expect(step.title.length).toBeGreaterThan(0);
  });

  test("the phase actually produced beats, so the screen has something to advance through", () => {
    const total = played.walkthrough.steps.reduce((sum, step) => sum + step.beats.length, 0);

    expect(total).toBeGreaterThan(0);
    // Threat placement is step one, so it can never be empty in a real phase.
    expect(played.walkthrough.steps[0]!.beats.length).toBeGreaterThan(0);
    expect(played.walkthrough.steps[0]!.beats.some((beat) => /threat/i.test(beat.text))).toBe(true);
    // Step two ran the villain's activation against the seat.
    expect(played.walkthrough.steps[1]!.beats.some((beat) => /Rhino/.test(beat.text))).toBe(true);
  });

  test("records only the villain phase: no player-turn beats leak in", () => {
    const texts = played.walkthrough.steps.flatMap((step) => step.beats.map((beat) => beat.text));

    // "You take a turn." and the end-of-phase discard belong to the player
    // phase; the walkthrough is a villain-phase screen and must ignore them.
    expect(texts.some((text) => /take a turn/.test(text))).toBe(false);
    expect(texts.length).toBeGreaterThan(0);
  });

  test("shows one phase at a time rather than accumulating rounds", () => {
    // Every beat recorded belongs to the round the walkthrough reports.
    const perStep = played.walkthrough.steps.map((step) => step.beats.length);
    // A single Rhino villain phase places threat once in step one.
    expect(perStep[0]).toBeLessThanOrEqual(3);
  });

  /**
   * Regression: the engine hands over round 1's whole villain phase *and*
   * `roundStarted(2)` in one command, so reading the last round seen — or
   * `state.round`, which has already moved on — labelled the screen "Round 2"
   * while it narrated round 1. Caught in the browser, not in a unit test, which
   * is why the assertion is against a real game rather than a crafted stream.
   */
  test("labels the phase with the round it belongs to, not the round that follows it", () => {
    expect(played.walkthrough.round).toBe(1);
    // The phase ran to its end, so the next round really had begun by now:
    // the label is frozen deliberately, not merely stale.
    expect(played.walkthrough.complete).toBe(true);
    expect(played.state.round).toBe(2);
  });

  test("beat ids are unique, so the screen can key and animate them", () => {
    const ids = played.walkthrough.steps.flatMap((step) => step.beats.map((beat) => beat.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("marks the phase complete once the engine leaves it", () => {
    expect(played.walkthrough.complete).toBe(true);
    expect(played.walkthrough.steps.every((step) => step.status === "done")).toBe(true);
  });

  test("every pause it does record is labeled in the design's words", () => {
    // A given villain phase need not pause at all — in this Rhino game the
    // hero is in alter-ego form, so Rhino schemes and nobody declares a
    // defender. What must hold is that any pause is labeled, and that pauses
    // from the player phase (the end-of-phase discard) never appear here.
    for (const label of played.pauses) {
      expect(label).toMatch(/^Auto-advance paused/);
    }
  });
});

describe("a villain phase that really does pause", () => {
  /**
   * Klaw with two seats parks a trigger window inside the phase, so this
   * exercises the whole path: the engine emits `choiceRequested` mid-command,
   * the walkthrough stops on it, and the beat carries the rule that put it
   * there. `pauseFor`'s own cases are unit-tested below.
   */
  test("stops on the engine's choice and attaches it to the step it happened in", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "klaw",
      difficulty: "standard",
      players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
      seed: 77,
    });
    const viewer = store.state.game!.players[0]!.playerId;
    let walkthrough = emptyWalkthrough(store.state.game!.round);
    let paused: { step: number; promptKind: string; authority: string; label: string } | null = null;

    for (let step = 0; step < 60 && !store.state.game!.outcome && !paused; step++) {
      const legal = store.state.legal;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      } else if (legal.actions.kind === "turn") {
        const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
        if (!end) break;
        await store.dispatch(end.example);
      } else break;

      walkthrough = appendWalkthrough(walkthrough, store.state.lastEvents, store.state.game!, viewer);
      for (const view of walkthrough.steps) {
        for (const beat of view.beats) {
          if (beat.pause && !paused) {
            paused = {
              step: view.number,
              promptKind: beat.pause.promptKind,
              authority: beat.pause.authority,
              label: beat.pause.label,
            };
          }
        }
      }
    }

    expect(paused, "no villain-phase choice was reached in 60 commands").not.toBeNull();
    expect(paused!.step).toBeGreaterThanOrEqual(1);
    expect(paused!.step).toBeLessThanOrEqual(5);
    expect(paused!.promptKind.length).toBeGreaterThan(0);
    expect(["player", "firstPlayerTargets", "firstPlayerOrders"]).toContain(paused!.authority);
    expect(paused!.label).toMatch(/^Auto-advance paused/);
  }, 60_000);
});

describe("pauseFor", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  const choice = (authority: "player" | "firstPlayerTargets" | "firstPlayerOrders", kind = "chooseTarget", soleDecider = false) => ({
    playerId: played.viewer,
    prompt: { kind },
    authority,
    soleDecider,
  });

  test("names the rule that made this player the decider", () => {
    expect(pauseFor(choice("firstPlayerTargets"), played.state, played.viewer).label).toContain("as first player, you pick the target");
    expect(pauseFor(choice("firstPlayerOrders"), played.state, played.viewer).label).toContain("order these effects");
    expect(pauseFor(choice("player"), played.state, played.viewer).label).toBe("Auto-advance paused for your interrupt");
  });

  test("addresses another seat by name rather than in the second person", () => {
    const other = "player-does-not-exist" as PlayerId;
    const pause = pauseFor({ ...choice("firstPlayerTargets"), playerId: other }, played.state, played.viewer);

    expect(pause.label).not.toContain("you");
    expect(pause.playerId).toBe(other);
  });

  test("a defend prompt says so instead of calling it an interrupt", () => {
    expect(pauseFor(choice("player", "declareDefender"), played.state, played.viewer).label).toContain("declare your defender");
  });

  test("Peril says only that player may decide", () => {
    const pause = pauseFor(choice("player", "chooseTarget", true), played.state, played.viewer);

    expect(pause.soleDecider).toBe(true);
    expect(pause.label).toContain("Peril — only");
  });
});

describe("decisionLabel", () => {
  let played: Played;

  beforeAll(async () => {
    played = await playThroughVillainPhase();
  }, 60_000);

  const choice = (authority: "player" | "firstPlayerTargets" | "firstPlayerOrders", kind = "chooseTarget") => ({
    playerId: played.viewer,
    prompt: { kind },
    authority,
    soleDecider: false,
  });

  test("never says 'auto-advance' — that wording belongs to the villain-phase screen", () => {
    // The overlay can be open during setup or a player turn, where nothing is
    // auto-advancing; calling a mulligan an "interrupt" was a real bug.
    for (const authority of ["player", "firstPlayerTargets", "firstPlayerOrders"] as const) {
      expect(decisionLabel(choice(authority), played.state, played.viewer)).not.toMatch(/auto-advance/i);
    }
    expect(decisionLabel(choice("player", "mulligan"), played.state, played.viewer)).toBe("Your decision");
  });

  test("still names the rule that made this player the decider", () => {
    expect(decisionLabel(choice("firstPlayerTargets"), played.state, played.viewer)).toBe("As first player, you pick the target");
    expect(decisionLabel(choice("firstPlayerOrders"), played.state, played.viewer)).toBe("As first player, you order these effects");
    expect(decisionLabel(choice("player", "declareDefender"), played.state, played.viewer)).toBe("Declare your defender");
  });

  test("addresses another seat in the third person", () => {
    const other = "player-nobody" as PlayerId;
    expect(decisionLabel({ ...choice("player"), playerId: other }, played.state, played.viewer)).toMatch(/decides$/);
  });
});
