/**
 * Checked against a real Rhino game, patched to the two threat states the
 * canvases actually word (D11: one threat short; L02: threshold reached),
 * the same direct-patch pattern `game-over-win.test.ts` uses rather than
 * inventing a synthetic `GameState`.
 */
import { CORE_DEPS } from "@mc/cards";
import { POOL_DEPS } from "../content/pool.js";
import type { GameState } from "@mc/engine";
import { describe, expect, test } from "vitest";
import type { StateWithoutPool } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { mainSchemeCalloutOf } from "./villain-main-scheme.js";

async function stateOf(scenarioId: string, starterDeckId: string): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({ scenarioId, difficulty: "standard", players: [{ starterDeckId }], seed: 2026 });
  return store.state.game!;
}

const rhinoState = () => stateOf("rhino", "core-spider-man-justice");

const withThreat = (state: GameState, threat: number): GameState => {
  const id = state.mainScheme.instanceId;
  const patched: StateWithoutPool = {
    ...state,
    instances: { ...state.instances, [id]: { ...state.instances[id]!, threat } },
  };
  return { ...patched, cardPool: state.cardPool };
};

describe("mainSchemeCalloutOf", () => {
  test("no warning well short of the threshold", async () => {
    const state = await rhinoState();
    const callout = mainSchemeCalloutOf(withThreat(state, 1), CORE_DEPS);

    expect(callout.line).toBe(`1 / ${callout.panel.target} threat`);
    expect(callout.warning).toBeNull();
  });

  test("warns at exactly one threat short of the threshold", async () => {
    const state = await rhinoState();
    const target = mainSchemeCalloutOf(state, CORE_DEPS).panel.target!;
    const callout = mainSchemeCalloutOf(withThreat(state, target - 1), CORE_DEPS);

    expect(callout.line).toBe(`${target - 1} / ${target} threat`);
    expect(callout.warning).toBe("One more threat and the scenario is lost.");
  });

  test("says the threshold is reached once threat is at or past it", async () => {
    const state = await rhinoState();
    const target = mainSchemeCalloutOf(state, CORE_DEPS).panel.target!;
    const callout = mainSchemeCalloutOf(withThreat(state, target), CORE_DEPS);

    expect(callout.warning).toBe("Threshold reached — the scheme resolves at the end of this phase unless thwarted.");
  });

  test("a stage that advances rather than loses (Ebony Maw's Attack on Knowhere, stage 1 of 2) never says the scenario is lost", async () => {
    const state = await stateOf("ebony-maw", "spectrum-leadership");
    const target = mainSchemeCalloutOf(state, POOL_DEPS).panel.target!;

    expect(mainSchemeCalloutOf(withThreat(state, target - 1), POOL_DEPS).warning).toBe(
      "One more threat completes this stage, and the main scheme advances.",
    );
    expect(mainSchemeCalloutOf(withThreat(state, target), POOL_DEPS).warning).toBe(
      "Threshold reached — the main scheme advances to its next stage.",
    );
  });
});
