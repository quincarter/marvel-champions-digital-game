/**
 * The modular sets still set aside (MojoMania: Wheel of Genres loses the game when the deck resets with none
 * remaining). The board names them beside the encounter deck; every scenario that never set any aside shows nothing.
 */
import type { GameState } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";
import { boardModel, setAsidePanel } from "./board-model.js";
import { SET_ASIDE_FOOTER_HEIGHT, setAsideLine, splitSetAside } from "./encounter-pile-layout.js";

async function game(scenarioId: string): Promise<GameState> {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === scenarioId)!;
  const draft = initialSetupDraft({ scenarioId, seatDeckId: "precon:cap-leadership", seed: 4974 });
  const store = new SessionStore(new LocalEngineHost());
  await store.start(toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }], scenario));
  return store.state.game!;
}

describe("set-aside modular sets on the board", () => {
  test("Mojo names the genres still set aside, in the order they were chosen", async () => {
    const state = await game("mojo");
    const model = boardModel(state, state.players[0]!.playerId, CORE_DEPS);
    const ids = (state.setAsideModularSets ?? []).map((set) => set.encounterSetId);
    expect(ids.length).toBeGreaterThan(0);
    expect(model.setAside?.count).toBe(ids.length);
    expect(model.setAside?.names).toHaveLength(ids.length);
    // Printed names, not ids: "Sci-Fi", not "sci-fi".
    for (const name of model.setAside!.names) expect(name).toMatch(/^[A-Z]/);
  });

  test("shows 0 once the last set has been shuffled in, because the scenario had some", async () => {
    const state = await game("mojo");
    const none: GameState = { ...state, setAsideModularSets: [] };
    expect(setAsidePanel(none)).toEqual({ count: 0, names: [] });
  });

  test("a scenario that never set any aside shows nothing", async () => {
    const state = await game("rhino");
    expect(state.setAsideModularSets).toBeUndefined();
    expect(boardModel(state, state.players[0]!.playerId, CORE_DEPS).setAside).toBeNull();
  });

  test("the footer is one line taken from the log, so the deck and discard keep their size", () => {
    const encounter = { x: 1000, y: 70, width: 140, height: 140 };
    const log = { x: 1000, y: 216, width: 140, height: 130 };
    const split = splitSetAside(encounter, log);
    expect(split.encounter).toEqual(encounter);
    expect(split.footer).toEqual({ x: 1000, y: 216, width: 140, height: SET_ASIDE_FOOTER_HEIGHT });
    expect(split.log!.y).toBe(216 + SET_ASIDE_FOOTER_HEIGHT + 6);
    expect(split.log!.y + split.log!.height).toBe(log.y + log.height);
    // No log beside the piles (phone): the footer takes the foot of the strip.
    const strip = splitSetAside({ x: 0, y: 0, width: 360, height: 76 }, null);
    expect(strip.log).toBeNull();
    expect(strip.encounter.height + 6 + SET_ASIDE_FOOTER_HEIGHT).toBe(76);
  });

  test("the footer line keeps the count and cuts the names", () => {
    expect(setAsideLine(1, ["Sitcom"])).toBe("SET ASIDE 1 · SITCOM");
    expect(setAsideLine(2, ["Crime", "Sci-Fi"])).toBe("SET ASIDE 2 · CRIME, SCI-FI");
    expect(setAsideLine(2, ["Crime", "Sci-Fi"], 8)).toBe("SET ASIDE 2 · CRIME,…");
    expect(setAsideLine(0, [])).toBe("SET ASIDE 0 · NONE LEFT");
  });
});
