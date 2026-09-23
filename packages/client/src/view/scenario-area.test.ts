/**
 * The Collection, as a real scenario area (docs/phase7-wave3.md §3.14) — Infiltrate the Museum's own Setup puts the
 * top card of each player's deck faceup into it (`packages/cards/src/wave3/gmw/museum.ts`), so it holds one card
 * per player from the very first turn, with no further play needed to pose the "has content" case.
 */

import { describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel, scenarioAreaPanels } from "./board-model.js";

const ROCKET_VS_BADOON: SessionConfig = {
  scenarioId: "infiltrate-the-museum",
  difficulty: "standard",
  players: [{ starterDeckId: "rocket-raccoon-aggression" }],
  seed: 5,
};

const CORE_RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 5,
};

async function intoTurn(config: SessionConfig): Promise<{ state: GameState; me: PlayerId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  return { state: store.state.game!, me: store.state.perspectiveId! };
}

describe("scenarioAreaPanels", () => {
  test("The Collection holds one card per player from Infiltrate the Museum's own Setup", async () => {
    const { state } = await intoTurn(ROCKET_VS_BADOON);
    const areas = scenarioAreaPanels(state);
    expect(areas).toHaveLength(1);
    const collection = areas[0]!;
    expect(collection.name.toLowerCase()).toContain("collection");
    expect(collection.count).toBe(1); // one seat
    expect(collection.instanceIds).toHaveLength(1);
    expect(collection.topArt).not.toBeNull();
  });

  test("a scenario with no scenario area (Core's Rhino) reports none, not a missing/undefined field", async () => {
    const { state } = await intoTurn(CORE_RHINO);
    expect(scenarioAreaPanels(state)).toEqual([]);
  });

  test("the board model carries it too, for the scene to draw", async () => {
    const { state, me } = await intoTurn(ROCKET_VS_BADOON);
    const model = boardModel(state, me, POOL_DEPS);
    expect(model.scenarioAreas).toHaveLength(1);
  });
});
