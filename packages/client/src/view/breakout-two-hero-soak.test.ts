/**
 * A soak over real two-hero Breakout (The Wrecking Crew) games: a scripted pair of players who mostly just end their
 * turns, across a spread of seeds, with every pure view model the Board and the villain-phase walkthrough run on a
 * state run on every state. It exists because of a 2026-09-21 report — "Hawkeye/Spider-Woman froze against Wrecker
 * in the villain phase as it tries to auto-advance" — that turned out to be the engine, not the walkthrough: a Boost
 * that makes the same villain scheme again (I've Been Waiting For This!) re-flipped its own boost card forever
 * (`engine/src/resolve/enemy-activation.ts`'s `stepBoostCard`), the command was rejected for never settling, and the
 * client sat on a state that never changed. Ten of the first sixty seeds hit it; the same run is what this test is.
 *
 * Three things are asserted for every command of every game:
 *  - the engine accepts it (a scripted answer to a real choice is always legal) and never throws;
 *  - the game never sits in a state nobody can act on (`actingPlayer` null with no choice open and no outcome);
 *  - `boardModel`, `appendEvents`, `appendWalkthrough`/`revealOf` and the choice labels never throw on it.
 *
 * Odd seeds flip both heroes to hero form on their first turn so the villains attack (boost cards, defend prompts,
 * Thunderball's and Radioactive Buildup's forced responses); even seeds stay in alter-ego so they scheme.
 */
import { describe, expect, test } from "vitest";
import type { Command, GameEvent, GameState, PlayerId } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { actingPlayer } from "../engine/acting-player.js";
import { POOL_DEPS } from "../content/pool.js";
import {
  appendWalkthrough,
  emptyWalkthrough,
  pauseFor,
  inlineInterruptFor,
  decisionLabel,
} from "./villain-walkthrough.js";
import { revealOf } from "./villain-phase-reveal.js";
import { boardModel } from "./board-model.js";
import { appendEvents, emptyLog } from "./log-lines.js";

const SEEDS = 24;
const ROUNDS = 5;

interface Failure {
  readonly seed: number;
  readonly label: string;
  readonly what: string;
}

async function soak(seed: number): Promise<readonly Failure[]> {
  const failures: Failure[] = [];
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "breakout",
    difficulty: "standard",
    players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
    seed,
  });
  const cardPool = started.cardPool;
  let state: GameState = { ...started.snapshot.state, cardPool };
  let events: readonly GameEvent[] = started.snapshot.events;
  let walk = emptyWalkthrough(1);
  let log = emptyLog();
  const flipped = new Set<PlayerId>();

  const check = (label: string): void => {
    if (!state.outcome && !state.pendingChoice && actingPlayer(state) === null) {
      failures.push({ seed, label, what: `engine stall at ${state.step.phase}/${state.step.kind}` });
    }
    const viewer = state.pendingChoice?.playerId ?? state.players[0]!.playerId;
    try {
      for (const player of state.players) boardModel(state, player.playerId, POOL_DEPS);
      log = appendEvents(log, events, state, viewer, POOL_DEPS);
      const villainPhase =
        state.step.phase === "villain" || events.some((e) => e.type === "stepChanged" && e.to.phase === "villain");
      if (villainPhase || !walk.complete) {
        walk = appendWalkthrough(walk, events, state, viewer, POOL_DEPS);
        const total = walk.steps.reduce((n, step) => n + step.beats.length, 0);
        for (let revealed = 0; revealed <= total; revealed++) revealOf(walk, revealed);
      }
      if (walk.complete && state.step.phase === "player") walk = emptyWalkthrough(state.round);
      if (state.pendingChoice) {
        pauseFor(state.pendingChoice, state, viewer);
        decisionLabel(state.pendingChoice, state, viewer);
        inlineInterruptFor(state.pendingChoice, viewer);
      }
    } catch (cause) {
      failures.push({ seed, label, what: `view model threw: ${(cause as Error).message}` });
    }
  };

  const dispatch = (command: Command, label: string): boolean => {
    const result = core.dispatch(command);
    if (!result.ok) {
      failures.push({ seed, label, what: `rejected: ${result.error.message.slice(0, 160)}` });
      return false;
    }
    state = { ...result.snapshot.state, cardPool };
    events = result.snapshot.events;
    check(label);
    return true;
  };

  check("start");
  for (let step = 0; step < 240; step++) {
    if (state.outcome) break;
    const toAct = actingPlayer(state);
    if (toAct === null) break;
    const legal = core.legalActions(toAct);
    if (legal.kind === "choice") {
      const { choice } = legal;
      const selectedOptionIds = choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
      const command: Command = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds,
      };
      if (!dispatch(command, `${choice.prompt.kind} in round ${state.round}`)) break;
      continue;
    }
    if (legal.kind !== "turn") break;
    if (state.round > ROUNDS) break;
    if (seed % 2 === 1 && !flipped.has(toAct)) {
      flipped.add(toAct);
      const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip && dispatch(flip.example, `flip in round ${state.round}`)) continue;
    }
    const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) {
      failures.push({ seed, label: `round ${state.round}`, what: "no legal endTurn" });
      break;
    }
    if (!dispatch(end.example, `endTurn in round ${state.round}`)) break;
  }
  return failures;
}

describe("two-hero Breakout soak", () => {
  test(`${SEEDS} seeded games, ${ROUNDS} rounds each: every command accepted, nobody ever stuck, no view model throws`, async () => {
    const failures: Failure[] = [];
    for (let seed = 1; seed <= SEEDS; seed++) failures.push(...(await soak(seed)));
    expect(failures).toEqual([]);
    // ~20s on a fast Mac; a Windows CI runner sharing its cores with the other test files needs well over 60s.
  }, 180_000);
});
