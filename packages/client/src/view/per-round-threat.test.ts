/** "+N per round" on a main scheme (issue #765): the engine's step-one threat, and sources that add up to it. */

import { describe, expect, test } from "vitest";
import { stepOneThreatOf, type GameState } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { perRoundHoverLine, perRoundThreatOf } from "./per-round-threat.js";

async function rhinoGame(): Promise<{ state: GameState; store: SessionStore }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  return { state: store.state.game!, store };
}

const sumOf = (sources: readonly string[]): number =>
  sources.reduce((total, line) => total + Number(/\+(\d+)$/.exec(line)?.[1] ?? 0), 0);

describe("perRoundThreatOf (#765)", () => {
  test("matches the engine's step one, and its sources add up to the total", async () => {
    const { state } = await rhinoGame();
    const id = state.mainScheme.instanceId;
    const perRound = perRoundThreatOf(state, POOL_DEPS, id)!;
    expect(perRound.total).toBe(stepOneThreatOf(state, POOL_DEPS, id)!.total);
    expect(perRound.total).toBeGreaterThan(0);
    expect(sumOf(perRound.sources)).toBe(perRound.total);
  });

  test("counts acceleration tokens, and the main scheme's subtitle says it", async () => {
    const { state, store } = await rhinoGame();
    const id = state.mainScheme.instanceId;
    const before = perRoundThreatOf(state, POOL_DEPS, id)!.total;
    const withTokens: GameState = { ...state, mainScheme: { ...state.mainScheme, accelerationTokens: 2 } };
    const perRound = perRoundThreatOf(withTokens, POOL_DEPS, id)!;
    expect(perRound.total).toBe(before + 2);
    expect(perRound.sources).toContain("2 acceleration tokens +2");
    expect(perRoundHoverLine(perRound).startsWith(`+${before + 2} per round: `)).toBe(true);
    const model = boardModel(withTokens, store.state.perspectiveId!, POOL_DEPS);
    expect(model.mainScheme.subtitle).toContain(`+${before + 2} per round`);
  });

  test("a side scheme gains none", async () => {
    const { state } = await rhinoGame();
    const villain = state.villains[0]!.instanceId;
    expect(perRoundThreatOf(state, POOL_DEPS, villain)).toBeNull();
  });
});
