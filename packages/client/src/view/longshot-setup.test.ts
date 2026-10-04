/**
 * Longshot on Table setup (MojoMania insert p. 2: a one-card extra modular set "that can be included in any scenario"
 * and "does not count as one of those sets"): its own on/off chip beside the modular picker, sent as an extra set.
 */
import { describe, expect, test } from "vitest";
import { buildScenario, CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { modularHeaderRightLabel } from "./modular-summary.js";
import { modularCardLabel, modularSetOptionsFor, pickedSetCount, toggleModularSet } from "./modular-sets.js";
import { initialSetupDraft, setScenario, toSessionConfig, type SetupDraft } from "./setup-draft.js";

const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const draftFor = (id: string): SetupDraft =>
  initialSetupDraft({ scenarioId: id, seatDeckId: "precon:cap-leadership", seed: 11 });
const players = [{ starterDeckId: "core-spider-man-justice" }];
const options = (draft: SetupDraft, id: string) => modularSetOptionsFor(draft, scenarioOf(id), CARDS_BY_ID);
const longshot = (draft: SetupDraft, id: string) => options(draft, id).find((o) => o.id === "longshot")!;

describe("the Longshot toggle", () => {
  test.each(["rhino", "magog", "spiral", "mojo", "breakout"])(
    "%s offers Longshot, off by default, as an extra chip",
    (id) => {
      const chip = longshot(draftFor(id), id);
      expect(chip.kind).toBe("extra");
      expect(chip.name).toBe("Longshot");
      expect(chip.selected).toBe(false);
      expect(modularCardLabel(chip)).toBe("Optional · not counted");
    },
  );

  test("toggling it never touches the modular picks or their count, and a second toggle turns it off", () => {
    const spiral = scenarioOf("spiral");
    let draft = toggleModularSet(draftFor("spiral"), spiral, "crime");
    draft = toggleModularSet(draft, spiral, "longshot");
    expect(draft.extraModularSetIds).toEqual(["longshot"]);
    expect(draft.modularSetIds).toEqual(["crime"]);
    expect(longshot(draft, "spiral").selected).toBe(true);
    expect(pickedSetCount(options(draft, "spiral"))).toBe(1);
    expect(modularHeaderRightLabel(spiral, 1, 1, pickedSetCount(options(draft, "spiral")))).toBe(
      "1 required · 1 of 3 chosen, or pick Random",
    );
    draft = toggleModularSet(draft, spiral, "longshot");
    expect(draft.extraModularSetIds).toEqual([]);
    expect(draft.modularSetIds).toEqual(["crime"]);
  });

  test("it survives a change of scenario and is sent only when on", () => {
    const rhino = scenarioOf("rhino");
    expect(toSessionConfig(draftFor("rhino"), players, rhino).extraModularSetIds).toBeUndefined();
    const on = toggleModularSet(draftFor("rhino"), rhino, "longshot");
    expect(toSessionConfig(on, players, rhino).extraModularSetIds).toEqual(["longshot"]);
    expect(setScenario(on, scenarioOf("mojo"), "mojo").extraModularSetIds).toEqual(["longshot"]);
  });

  test.each(["rhino", "mojo", "mansion-attack"])(
    "%s: the dealt game has Longshot in the encounter deck once",
    async (id) => {
      const scenario = scenarioOf(id);
      const draft = toggleModularSet(draftFor(id), scenario, "longshot");
      const config = toSessionConfig(draft, players, scenario);
      expect(buildScenario(id, config).encounterDeck?.filter((card) => (card as string) === "39071")).toHaveLength(1);
      const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
      const { snapshot } = await core.start(config);
      const state = snapshot.state as { instances: Record<string, { cardId: string }> };
      expect(Object.values(state.instances).filter((i) => i.cardId === "39071")).toHaveLength(1);
    },
  );
});
