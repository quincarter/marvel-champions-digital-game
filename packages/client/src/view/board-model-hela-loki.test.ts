/**
 * Odin attached to the main scheme (Hela, `mts` 21139a, "Attach Odin to the main scheme, captive side faceup",
 * docs/phase7-wave4.md §3.8) and Loki's own victory count (docs/phase7-wave4.md §3.7: "If the number of Lokis in
 * the victory display is equal to the victory condition, the players win the game", 21165b). Neither
 * `SchemePanel` (no `attachments` field at all before this wave) nor `BoardModel` (no reader for
 * `ScenarioRules.victoryCondition`/`GameState.victoryDisplay` at all) could show either.
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const HELA: SessionConfig = {
  scenarioId: "hela",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 6,
};

const LOKI: SessionConfig = {
  scenarioId: "loki",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 7,
};

const RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
};

async function afterSetup(config: SessionConfig, maxSteps = 10): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    break;
  }
  return store;
}

describe("Hela: Odin attached to the main scheme", () => {
  test("the main scheme's panel shows Odin among its attachments", async () => {
    const store = await afterSetup(HELA);
    const model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
    expect(model.mainScheme.attachments.map((a) => a.name)).toContain("Odin");
    expect(model.mainScheme.subtitle).toContain("Odin");
  });
});

describe("Loki: the victory count", () => {
  test("the villain panel shows Victory 0/N at setup, and BoardModel.victoryCondition names it", async () => {
    const store = await afterSetup(LOKI);
    const state = store.state.game!;
    expect(state.scenarioRules.victoryCondition).toBe(2); // standard difficulty (docs/phase7-wave4.md §3.7)

    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);
    expect(model.victoryCondition).toEqual({ count: 0, target: 2 });
    expect(model.villain.subtitle).toContain("Victory 0/2");
  });

  test("a defeated Loki in the victory display advances the count, by patching engine-owned state (the swap-to-a-random-Loki mechanic itself is engine-tested)", async () => {
    const store = await afterSetup(LOKI);
    const state = store.state.game!;
    const [someLoki] = state.villains;
    const patched = { ...state, victoryDisplay: [someLoki!.instanceId] };
    const model = boardModel(patched, store.state.perspectiveId!, POOL_DEPS);
    expect(model.victoryCondition).toEqual({ count: 1, target: 2 });
    expect(model.villain.subtitle).toContain("Victory 1/2");
  });
});

describe("a scenario with no victory count at all", () => {
  test("model.victoryCondition is null, and the villain subtitle names no victory count", async () => {
    const store = await afterSetup(RHINO);
    const model = boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);
    expect(model.victoryCondition).toBeNull();
    expect(model.villain.subtitle).not.toContain("Victory");
  });
});
