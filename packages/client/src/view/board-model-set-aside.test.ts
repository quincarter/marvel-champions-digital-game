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
import {
  SET_ASIDE_FOOTER_HEIGHT,
  setAsideFooterHeight,
  setAsideLines,
  splitSetAside,
} from "./encounter-pile-layout.js";

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

  test("the footer is taken from the log, so the deck and discard keep their size", () => {
    const encounter = { x: 1000, y: 70, width: 140, height: 140 };
    const log = { x: 1000, y: 216, width: 140, height: 130 };
    const split = splitSetAside(encounter, log);
    expect(split.encounter).toEqual(encounter);
    expect(split.footer).toEqual({ x: 1000, y: 216, width: 140, height: SET_ASIDE_FOOTER_HEIGHT });
    expect(split.log!.y).toBe(216 + SET_ASIDE_FOOTER_HEIGHT + 6);
    expect(split.log!.y + split.log!.height).toBe(log.y + log.height);
    // A taller footer (more names) takes more of the log, never of the piles.
    const tall = splitSetAside(encounter, log, 62);
    expect(tall.footer.height).toBe(62);
    expect(tall.log!.y).toBe(216 + 62 + 6);
    // No log beside the piles (phone): the footer takes the foot of the strip.
    const strip = splitSetAside({ x: 0, y: 0, width: 360, height: 76 }, null);
    expect(strip.log).toBeNull();
    expect(strip.encounter.height + 6 + SET_ASIDE_FOOTER_HEIGHT).toBe(76);
  });

  test("the footer keeps the count and wraps the names, never cutting one", () => {
    expect(setAsideLines(1, ["Sitcom"], 140)).toEqual(["SET ASIDE 1", "SITCOM"]);
    expect(setAsideLines(2, ["Crime", "Sci-Fi"], 140)).toEqual(["SET ASIDE 2", "CRIME, SCI-FI"]);
    expect(setAsideLines(0, [], 140)).toEqual(["SET ASIDE 0", "NONE LEFT"]);
    // A wide strip (the phone's) keeps the count and the names on one line.
    expect(setAsideLines(2, ["Crime", "Sci-Fi"], 360)).toEqual(["SET ASIDE 2 · CRIME, SCI-FI"]);
    expect(setAsideLines(0, [], 360)).toEqual(["SET ASIDE 0 · NONE LEFT"]);
    // Narrow panel: names move to their own lines instead of ending in an ellipsis.
    const narrow = setAsideLines(3, ["Western", "Sitcom", "Sci-Fi"], 110);
    expect(narrow.length).toBeGreaterThan(2);
    expect(narrow.join(" ")).not.toContain("…");
    expect(narrow.slice(1).join(" ").replace(/,/g, "")).toBe("WESTERN SITCOM SCI-FI");
    // The panel grows with the lines and never goes below the two-line minimum.
    expect(setAsideFooterHeight(["SET ASIDE 1 · SITCOM"])).toBe(SET_ASIDE_FOOTER_HEIGHT);
    expect(setAsideFooterHeight(["SET ASIDE 1", "SITCOM"])).toBeGreaterThan(SET_ASIDE_FOOTER_HEIGHT);
    expect(setAsideFooterHeight(narrow)).toBeGreaterThan(SET_ASIDE_FOOTER_HEIGHT);
    // All six genres still fit within the line cap on the narrowest panel, so nothing is dropped.
    const all = ["Crime", "Fantasy", "Horror", "Sci-Fi", "Sitcom", "Western"];
    expect(setAsideLines(6, all, 100).slice(1).join(" ").replace(/,/g, "")).toBe(all.join(" ").toUpperCase());
  });
});
