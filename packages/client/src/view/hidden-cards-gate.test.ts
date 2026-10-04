/**
 * Owner decision Q74 / RRG 1.8 "Look, Looked-At" (p. 27): only the player resolving the ability may look at cards that
 * are otherwise hidden. Gambit's Thief Extraordinaire is a cost ("look at the top 2 cards of the encounter deck,
 * discard 1"), not a `lookAt` prompt: its two cards arrive on a plain card-choice sheet, and in a two-seat game that
 * sheet has to wait behind the cover too (QA playthrough C, defect C2). Real content, real commands.
 */
import { describe, expect, test } from "vitest";
import { applyCommand, legalActions, type Command, type GameState } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_DEPS } from "../content/pool.js";
import { lookAtGateOf, revealsDeckCards } from "./look-at-choice.js";

function run(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

function settle(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 40 && current.pendingChoice; guard++) {
    const choice = current.pendingChoice;
    current = run(current, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  return current;
}

async function gambitUsesThief(seats: readonly string[]): Promise<GameState> {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: seats.map((starterDeckId) => ({ starterDeckId })),
    seed: 11,
  });
  const state = settle({ ...started.snapshot.state, cardPool: started.cardPool } as GameState);
  const me = state.players[0]!.playerId;
  const legal = legalActions(state, me, POOL_DEPS);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  const thief = legal.legal.find(
    (e) => e.action.kind === "useAbility" && /thief-extraordinaire/.test(e.action.abilityId),
  );
  if (!thief) throw new Error("Thief Extraordinaire is not usable");
  return run(state, thief.example);
}

describe("a choice that shows one player hidden deck cards waits behind the privacy cover", () => {
  test("Thief Extraordinaire's look-and-discard cost: gated with two seats, open alone", async () => {
    const duo = await gambitUsesThief(["gambit-justice", "core-spider-man-justice"]);
    const choice = duo.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseCards");
    expect(choice.options).toHaveLength(2);
    expect(revealsDeckCards(duo, choice)).toBe(true);
    const gate = lookAtGateOf(duo, choice);
    expect(gate?.headline).toMatch(/^Only .+ may look\.$/);
    expect(gate?.looker).toBeTruthy();

    const solo = await gambitUsesThief(["gambit-justice"]);
    expect(solo.pendingChoice?.prompt.kind).toBe("chooseCards");
    expect(lookAtGateOf(solo, solo.pendingChoice!)).toBeNull();
  });
});
