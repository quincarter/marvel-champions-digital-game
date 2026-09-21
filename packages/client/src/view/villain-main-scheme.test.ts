/**
 * Checked against a real Rhino game, patched to the two threat states the
 * canvases actually word (D11: one threat short; L02: threshold reached),
 * the same direct-patch pattern `game-over-win.test.ts` uses rather than
 * inventing a synthetic `GameState`.
 */
import { CORE_DEPS } from "@mc/cards";
import type { GameState } from "@mc/engine";
import { describe, expect, test } from "vitest";
import type { StateWithoutPool } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { mainSchemeCalloutOf } from "./villain-main-scheme.js";

async function rhinoState(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  return store.state.game!;
}

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
});
