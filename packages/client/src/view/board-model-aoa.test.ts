/**
 * `BoardModel` against real Age of Apocalypse games: Apocalypse's X target threat, the Four Horsemen's A/B version
 * letters, and En Sabah Nur's Pyramid power counters, all read from the engine's state rather than recomputed.
 */

import { describe, expect, test } from "vitest";
import { mainSchemeValue, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, compactVillainNote, type CharacterPanel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

const config = (scenarioId: string): SessionConfig => ({
  scenarioId,
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 41,
});

async function intoPlay(sessionConfig: SessionConfig, maxSteps = 60): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(sessionConfig);
  for (let step = 0; step < maxSteps; step++) {
    const legal = store.state.legal;
    if (!legal || legal.actions.kind !== "choice") break;
    const { choice } = legal.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  return store;
}

const modelOf = (store: SessionStore) => boardModel(store.state.game!, store.state.perspectiveId!, POOL_DEPS);

describe("boardModel on Age of Apocalypse scenarios", () => {
  test("Apocalypse's main scheme target is his hit points (X), not the printed 0", async () => {
    const store = await intoPlay(config("apocalypse"));
    const state = store.state.game!;
    const scheme = modelOf(store).mainScheme;
    const expected = mainSchemeValue(state, "targetThreat", POOL_DEPS);
    expect(expected).toBeGreaterThan(0);
    expect(scheme.target).toBe(expected);
    expect(scheme.meterMax).toBe(expected);
  });

  test("Four Horsemen tiles name the version letter, not a stage, and carry the compact note", async () => {
    const store = await intoPlay(config("four-horsemen"));
    const model = modelOf(store);
    expect(model.villains).toHaveLength(4);
    for (const villain of model.villains) {
      expect(villain.panel.subtitle).toMatch(/^Villain · Side [AB]/);
      expect(villain.panel.subtitle).not.toContain("Stage");
    }
  });

  test("compactVillainNote words statuses, attachments and counters", () => {
    const panel = {
      statuses: [{ status: "stunned", count: 1 }],
      attachments: [{ name: "Golden Horse", counters: [], exhausted: false, damage: 0, damageThreshold: null }],
      counters: [{ name: "power", count: 1 }],
    } as unknown as CharacterPanel;
    expect(compactVillainNote(panel)).toBe("Stunned · Golden Horse · 1 power counter");
    expect(compactVillainNote({ statuses: [], attachments: [], counters: [] } as unknown as CharacterPanel)).toBe("");
  });

  test("En Sabah Nur's Pyramid shows its power counters on the main scheme panel", async () => {
    const store = await intoPlay(config("en-sabah-nur"));
    const state: GameState = store.state.game!;
    const id = state.mainScheme.instanceId as InstanceId;
    const withCounter: GameState = {
      ...state,
      instances: { ...state.instances, [id]: { ...state.instances[id]!, counters: { power: 2 } } },
    };
    const scheme = boardModel(withCounter, store.state.perspectiveId!, POOL_DEPS).mainScheme;
    expect(scheme.counters).toEqual([{ name: "power", count: 2 }]);
  });
});
