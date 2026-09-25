/**
 * Tower Defense's own two main schemes and its Focused Defense attachment and Avengers Tower environment (`mts`
 * 21098a, MC21 p. 10: "Both main schemes are active each round"; docs/phase7-wave4.md §3.2). `BoardModel` used to
 * have no way to name a second main scheme at all, and `schemePanel`'s own "main scheme" branch read
 * `state.mainScheme` unconditionally regardless of which instance it was building a panel for, so a panel built
 * for the second main scheme would have drawn the first one's stage index and acceleration tokens instead of its
 * own. Also confirms Focused Defense itself — an attachment on a main scheme, a zone `SchemePanel` had no field
 * for before this wave — and damage on Avengers Tower — an environment `EnvironmentPanel` had no field for either
 * — actually show.
 */
import { describe, expect, test } from "vitest";
import { getInstance, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const TOWER_DEFENSE: SessionConfig = {
  scenarioId: "tower-defense",
  difficulty: "standard",
  players: [{ starterDeckId: "spectrum-leadership" }],
  seed: 3,
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

describe("Tower Defense: two main schemes, one attached", () => {
  test("the board names both main schemes, each with its own stage — not the first one's borrowed twice", async () => {
    const store = await afterSetup(TOWER_DEFENSE);
    const state = store.state.game!;
    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);

    expect(state.extraMainSchemes).toHaveLength(1);
    expect(model.extraMainSchemes).toHaveLength(1);
    const [extra] = model.extraMainSchemes;

    // Two distinct stages of the same main scheme card (Under Siege 1A/2A) — proof `schemePanel` reads each
    // scheme's own MainSchemeState rather than always `state.mainScheme`.
    expect(model.mainScheme.instanceId).not.toBe(extra!.instanceId);
    expect(model.mainScheme.subtitle).toContain("Main scheme 1");
    expect(extra!.subtitle).toContain("Main scheme 2");
    expect(model.mainScheme.name).not.toBe(extra!.name);
  });

  test("Focused Defense is attached to the second main scheme and shows on its panel", async () => {
    const store = await afterSetup(TOWER_DEFENSE);
    const state = store.state.game!;
    const model = boardModel(state, store.state.perspectiveId!, POOL_DEPS);
    const [extra] = model.extraMainSchemes;
    expect(extra!.attachments.map((a) => a.name)).toContain("Focused Defense");
    expect(extra!.subtitle).toContain("Focused Defense");
  });

  test("both villains are in play (Proxima Midnight and Corvus Glaive)", async () => {
    const store = await afterSetup(TOWER_DEFENSE);
    const state = store.state.game!;
    expect(state.villains).toHaveLength(2);
  });

  test("Avengers Tower's damage shows on its environment panel", async () => {
    const store = await afterSetup(TOWER_DEFENSE);
    const state = store.state.game!;
    const towerId = state.villainArea.find(
      (id) => getInstance(state, id) && cardNameOf(state, id) === "Avengers Tower",
    );
    expect(
      towerId,
      "Avengers Tower should already be in play at setup (wave4/setup.ts's own set-aside placement)",
    ).toBeDefined();

    const before = boardModel(state, store.state.perspectiveId!, POOL_DEPS);
    const panel = before.environments.find((e) => e.instanceId === towerId);
    expect(panel?.damage).toBe(getInstance(state, towerId as InstanceId)?.damage ?? 0);
    if (panel?.damage === 0) expect(panel.subtitle).toBe("Environment");

    // Damage is engine-owned state (already covered by packages/engine/src/damage-on-environment.test.ts); this
    // only checks the view model reads it once it's there.
    const bumped = (panel?.damage ?? 0) + 5;
    const damaged: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [towerId as InstanceId]: { ...state.instances[towerId as InstanceId]!, damage: bumped },
      },
    };
    const model = boardModel(damaged, store.state.perspectiveId!, POOL_DEPS);
    const damagedPanel = model.environments.find((e) => e.instanceId === towerId);
    expect(damagedPanel?.damage).toBe(bumped);
    expect(damagedPanel?.subtitle).toBe(`Environment · ${bumped} damage`);
  });
});

function cardNameOf(state: GameState, id: InstanceId): string | undefined {
  const instance = getInstance(state, id);
  return instance ? state.cardPool[instance.cardId]?.name : undefined;
}
