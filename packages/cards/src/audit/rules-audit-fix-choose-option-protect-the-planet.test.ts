/**
 * Protect the Planet 2B (16062b): "First Player Action: Exhaust the Milano -> choose to either remove 3 threat from
 * this scheme or deal 3 damage to a minion." RRG 1.8 "Choose (Option)" (p. 12): with no minion in play, the damage
 * option has no valid target; here the main scheme is an encounter card, so the first bullet applies the same way.
 */
import type { GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, inst, instancesOf, P1, patchInstance, settle, use, type Picker } from "../testing/harness.js";
import { wave3Scenario } from "../wave3/setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../wave3/testing.js";

describe("Protect the Planet 2B (16062b): an option with no valid target cannot be chosen", () => {
  it("with no minion in play, 'Deal 3 damage to a minion' is not offered", () => {
    const state = startWave3Game(
      wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
    );
    const scheme = state.mainScheme.instanceId;
    const atStage2: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } };
    const withThreat = patchInstance(atStage2, scheme, { threat: 5 });
    const [milano] = instancesOf(withThreat, "16142");
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") offered.push(...choice.options.map((o) => o.label ?? ""));
      return firstLegal(s);
    };
    const after = settle(
      runWave3(withThreat, use(P1, scheme, "16062b.protect-the-planet-constant", [], { exhausted: [milano!] })),
      pick,
      undefined,
      WAVE3_DEPS,
    );
    expect(offered).not.toContain("Deal 3 damage to a minion");
    expect(inst(after, scheme).threat).toBe(2);
  });
});
