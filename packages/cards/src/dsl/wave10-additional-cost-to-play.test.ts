import type { AbilityDefinition } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { additionalCostToPlay, constant, exhaustThis, searchEncounterIntoPlayCost } from "./abilities.js";
import { stun } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query } from "./values.js";

/**
 * docs/phase7-wave10-box-heroes.md B3.1: the DSL surface of an additional cost to play a card and of the cost that
 * searches the encounter deck for a card and puts it into play (Hunted, `cw` 56007). The engine's behavior is tested in
 * `packages/engine/src/encounter-search-cost.test.ts` and with the card in `wave10/cw/tigra`.
 */
describe("B3.1 additionalCostToPlay and searchEncounterIntoPlayCost", () => {
  const hunted = additionalCostToPlay(
    searchEncounterIntoPlayCost(query("minion"), "hunted"),
    { attachTo: "hunted" },
    stun(chosen("hunted")),
  );

  it("builds a constant with the cost, the slot its upgrade attaches to and the effects of entering play", () => {
    expect(hunted.trigger).toEqual({ kind: "constant", additionalCostToPlay: { attachToSlot: "hunted" } });
    expect(hunted.cost).toEqual({
      searchEncounterIntoPlay: { slot: "hunted", query: { categories: ["minion"] }, zones: ["deck", "discard"] },
    });
    expect(hunted.effects).toEqual([
      { kind: "giveStatus", target: { kind: "slot", slot: "hunted" }, status: "stunned" },
    ]);
    expect(validateDefinition(hunted)).toEqual([]);
  });

  it("the zones may be narrowed, and no host slot is needed for a card that is no upgrade", () => {
    const fromDiscard = additionalCostToPlay(searchEncounterIntoPlayCost(query("minion"), "found", ["discard"]));
    expect(fromDiscard.cost?.searchEncounterIntoPlay?.zones).toEqual(["discard"]);
    expect(fromDiscard.trigger).toEqual({ kind: "constant", additionalCostToPlay: {} });
    expect(validateDefinition(fromDiscard)).toEqual([]);
  });

  it("the effects may read only the slots the cost binds", () => {
    const wrong = additionalCostToPlay(
      searchEncounterIntoPlayCost(query("minion"), "hunted"),
      { attachTo: "hunted" },
      stun(chosen("other")),
    );
    expect(validateDefinition(wrong).join("\n")).toContain("other");
  });

  it("is rejected when it attaches to a slot the cost does not put into play, with no slot, with no zone, or with resources", () => {
    const search = searchEncounterIntoPlayCost(query("minion"), "hunted");
    expect(validateDefinition(additionalCostToPlay(search, { attachTo: "host" }))).toContain(
      "an additional cost to play attaches to a slot its cost puts into play (host)",
    );
    expect(validateDefinition(additionalCostToPlay(exhaustThis, { attachTo: "hunted" }))).toContain(
      "an additional cost to play attaches to a slot its cost puts into play (hunted)",
    );
    expect(validateDefinition(additionalCostToPlay(searchEncounterIntoPlayCost(query("minion"), "")))).toContain(
      "cost searchEncounterIntoPlay: needs a slot for the card found",
    );
    expect(
      validateDefinition(additionalCostToPlay(searchEncounterIntoPlayCost(query("minion"), "found", []))),
    ).toContain("cost searchEncounterIntoPlay: names the encounter deck, its discard pile or both");
    expect(validateDefinition(additionalCostToPlay({ ...search, resources: 1 }))).toContain(
      "an additional cost to play has no resources",
    );
  });

  it("every other constant still has no cost and no effects", () => {
    const withCost: AbilityDefinition = { ...constant(), cost: exhaustThis };
    expect(validateDefinition(withCost)).toContain("a constant ability has no cost, limit or label");
    const withEffects: AbilityDefinition = { ...constant(), effects: [stun(chosen("x"))] };
    expect(validateDefinition(withEffects)).toContain("a constant ability has no effects");
    const marked: AbilityDefinition = { trigger: { kind: "constant", additionalCostToPlay: {} }, effects: [] };
    expect(validateDefinition(marked)).toContain("an additional cost to play needs the cost");
  });
});
