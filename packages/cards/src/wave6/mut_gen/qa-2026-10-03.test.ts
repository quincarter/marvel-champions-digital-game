/**
 * Rules-QA 2026-10-03, commit 74b3d4ef: the final stage's "When Completed" resolves before the loss.
 *
 * RRG 1.8 "When Completed Abilities" (p. 48): "When a main scheme is complete, all 'When Completed' abilities on the
 * card resolve", equivalent to "Forced Interrupt: When this scheme is completed..."; "Main Scheme" (p. 27): "If the
 * villain completes the final stage of the main scheme deck, the villain wins the game."
 *
 * Mansion Attack's four stage 2s (32126b-32129b) each carry "When Completed: Add this scheme to the victory display ...
 * If there are 3 main schemes in the victory display, the players lose the game." Whichever of the four the shuffle puts
 * second completes into the third victory-display card and loses; every one of them must do so exactly once.
 * `mansion-attack.test.ts` proves it for one shuffle (Blob, seed 1); this walks a seed for each of the four stage cards.
 */
import { activeVillain, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { driveEventsPicking } from "../../testing/staging.js";
import { firstLegal, patchInstance } from "../../testing/harness.js";
import { WAVE6_DEPS } from "../index.js";
import { mansionAttackGame, withoutDealtCards } from "./mansion-attack-testing.js";

vi.setConfig({ testTimeout: 60_000 });

const NAMES: Readonly<Record<number, string>> = {
  1: "The Atrium (32126b)",
  2: "The Cafeteria (32127b)",
  3: "The Basketball Court (32128b)",
  4: "The Courtyard (32129b)",
};

/** One villain phase from a scheme one threat short of its target (acceleration 1 per hero reaches it). */
const completeStage = (state: GameState) => {
  const target = 7 * state.players.length;
  return driveEventsPicking(
    WAVE6_DEPS,
    patchInstance(withoutDealtCards(state), state.mainScheme.instanceId, {
      threat: target - state.players.length,
    }),
    firstLegal,
    ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
  );
};
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("each Mansion Attack stage 2 as the third main scheme in the victory display loses the game, once (RRG p. 48)", () => {
  it("finds a seed for each of the four stage cards in the completing position and loses on each", () => {
    const covered = new Set<number>();
    for (let seed = 1; seed <= 80 && covered.size < 4; seed++) {
      const start = mansionAttackGame({ villain: "Blob", seed });
      const order = start.mainScheme.stageOrder!;
      const completing = order[2]!;
      if (covered.has(completing)) continue;
      covered.add(completing);
      const afterOne = completeStage(start).state;
      expect(afterOne.outcome, NAMES[completing]).toBeNull();
      expect(afterOne.mainScheme.stageIndex).toBe(completing);
      const { state, events } = completeStage(afterOne);
      expect(state.outcome, NAMES[completing]).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
      expect(of(events, "gameEnded"), NAMES[completing]).toHaveLength(1);
      const toDisplay = events.findIndex((e) => e.type === "mainSchemeStageToVictoryDisplay");
      const ended = events.findIndex((e) => e.type === "gameEnded");
      expect(toDisplay).toBeGreaterThanOrEqual(0);
      // The When Completed ability resolved (the stage is in the display) before the game ended.
      expect(ended).toBeGreaterThan(toDisplay);
      expect(
        state.victoryDisplay.filter((id) => state.cardPool[state.instances[id]!.cardId]!.type === "main_scheme"),
      ).toHaveLength(3);
      expect(activeVillain(state)).toBeDefined();
    }
    expect([...covered].sort()).toEqual([1, 2, 3, 4]);
  });
});
