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
import { boardModel, scenarioAreaPanels, scenarioAreaTag, schemeAreaNote } from "./board-model.js";

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

// Issue #173: The Grand Collection 1B loses at "at least 5[per_hero] cards in The Collection", and the phone keeps the
// pile tile on another tab from the scheme, so the count and its limit ride on the main scheme too.
describe("The Collection's limit", () => {
  test("is read from the main scheme's own text at 5 per hero", async () => {
    const { state, me } = await intoTurn(ROCKET_VS_BADOON);
    const model = boardModel(state, me, POOL_DEPS);
    expect(model.scenarioAreas[0]).toMatchObject({ count: 1, limit: 5 });
    expect(scenarioAreaTag(model.scenarioAreas[0]!)).toBe("1/5");
  });

  test("scales with the player count", async () => {
    const { state, me } = await intoTurn({
      ...ROCKET_VS_BADOON,
      players: [{ starterDeckId: "rocket-raccoon-aggression" }, { starterDeckId: "core-spider-man-justice" }],
    });
    const model = boardModel(state, me, POOL_DEPS);
    expect(model.scenarioAreas[0]).toMatchObject({ count: 2, limit: 10 });
  });

  test("the main scheme carries a line for it; no other scheme does", async () => {
    const { state, me } = await intoTurn(ROCKET_VS_BADOON);
    const model = boardModel(state, me, POOL_DEPS);
    expect(model.mainScheme.areaNotes).toEqual([
      expect.objectContaining({ count: 1, limit: 5, caption: "The Collection · lose at 5", urgent: false }),
    ]);
    expect(model.mainScheme.areaNotes![0]!.instanceIds).toEqual(model.scenarioAreas[0]!.instanceIds);
    for (const side of model.sideSchemes) expect(side.areaNotes).toBeUndefined();
  });

  test("turns urgent one card short of the limit", () => {
    const area = { name: "The Collection", instanceIds: [], topArt: null };
    expect(schemeAreaNote({ ...area, count: 3, limit: 5 }).urgent).toBe(false);
    expect(schemeAreaNote({ ...area, count: 4, limit: 5 }).urgent).toBe(true);
    expect(schemeAreaNote({ ...area, count: 4, limit: null })).toMatchObject({
      urgent: false,
      caption: "The Collection",
    });
    expect(scenarioAreaTag({ count: 4, limit: null })).toBe("4");
  });

  test("a scheme with no scenario area has no line", async () => {
    const { state, me } = await intoTurn(CORE_RHINO);
    expect(boardModel(state, me, POOL_DEPS).mainScheme.areaNotes).toBeUndefined();
  });
});
